"""
Servicio para crear automáticamente Retazos a partir de cortes.

Transforma ResultadoCorte en registros Retazo en BD, con auditoría completa.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)


def crear_retazos_desde_corte(
    db: Session,
    resultado_corte,  # ResultadoCorte (importar para evitar circular)
    acumulado_produccion_id: str,
    material_id: str,
    espesor_mm: Optional[int] = None,
    usuario_id: Optional[str] = None,
    notas: Optional[str] = None
) -> Dict[str, Any]:
    """
    Crea registros Retazo en la BD basados en un ResultadoCorte.
    
    Crea un Retazo para CADA remanente, con:
    - Dimensiones calculadas
    - Posición en plancha original
    - FK a AcumuladoProduccion
    - Estado: disponible
    - Auditoría de creación
    
    Args:
        db: Sesión SQLAlchemy
        resultado_corte: ResultadoCorte (output de MotorGeometriaCorte)
        acumulado_produccion_id: ID del AcumuladoProduccion que generó los cortes
        material_id: ID del Material
        espesor_mm: (Optional) Espesor en mm
        usuario_id: (Optional) ID del usuario que realizó el corte
        notas: (Optional) Notas generales sobre los retazos
    
    Returns:
        {
            'exito': bool,
            'retazos_creados': List[str],  # IDs de Retazo creados
            'cantidad': int,
            'area_total_mm2': float,
            'errores': List[str]  # Si hubo problemas
        }
    """
    
    from app.models import Retazo, AcumuladoProduccion
    from services.auditoria import registrar_cambio_estado
    
    retazos_creados = []
    errores = []
    area_total = 0.0
    
    try:
        # Verificar que AcumuladoProduccion existe
        acumulado = db.query(AcumuladoProduccion).filter(
            AcumuladoProduccion.id == acumulado_produccion_id
        ).first()
        
        if not acumulado:
            return {
                'exito': False,
                'retazos_creados': [],
                'cantidad': 0,
                'area_total_mm2': 0.0,
                'errores': [f"AcumuladoProduccion {acumulado_produccion_id} no encontrado"]
            }
        
        # Crear Retazo para cada remanente
        for idx, remanente in enumerate(resultado_corte.remanentes):
            try:
                area_mm2 = remanente.area_mm2()
                
                retazo = Retazo(
                    material_id=material_id,
                    lote_id=acumulado.id,  # Link al acumulado (puede ser NULL si lo prefieren)
                    largo=int(remanente.alto),
                    ancho=int(remanente.ancho),
                    espesor=espesor_mm,
                    ubicacion=None,  # El operario lo asignará luego
                    estado="disponible",
                    en_venta=False,
                    estado_inventario="disponible",
                    
                    # Campos de corte
                    acumulado_produccion_id=acumulado_produccion_id,
                    origen_x_mm=remanente.origen_x,
                    origen_y_mm=remanente.origen_y,
                    area_mm2=area_mm2,
                    fecha_creacion=datetime.utcnow(),
                    notas_retazo=f"Remanente #{idx+1} de corte automático" + (
                        f". {notas}" if notas else ""
                    )
                )
                
                db.add(retazo)
                db.flush()  # Obtener ID
                retazos_creados.append(retazo.id)
                area_total += area_mm2
                
                logger.info(
                    f"Retazo creado: {retazo.id} ({remanente.ancho:.0f}x{remanente.alto:.0f}mm, "
                    f"{area_mm2:.0f}mm²) de acumulado {acumulado_produccion_id}"
                )
                
            except IntegrityError as e:
                db.rollback()
                error_msg = f"Error creando retazo #{idx+1}: {str(e)}"
                errores.append(error_msg)
                logger.error(error_msg)
            except Exception as e:
                error_msg = f"Error inesperado creando retazo #{idx+1}: {str(e)}"
                errores.append(error_msg)
                logger.error(error_msg)
        
        # Registrar en auditoría
        if retazos_creados:
            try:
                registrar_cambio_estado(
                    db=db,
                    tabla="acumulado_produccion",
                    registro_id=acumulado_produccion_id,
                    estado_anterior=acumulado.estado,
                    estado_nuevo="cortado",
                    usuario_id=usuario_id,
                    razon="generacion_automatica_retazos",
                    detalles={
                        'retazos_creados': len(retazos_creados),
                        'area_total_mm2': area_total,
                        'invariante_valida': resultado_corte.invariante_valida,
                        'error_invariante_mm2': resultado_corte.error_invariante_mm2
                    }
                )
            except Exception as e:
                logger.error(f"Error registrando auditoría: {str(e)}")
                # No fallar el proceso por auditoría
        
        return {
            'exito': len(errores) == 0,
            'retazos_creados': retazos_creados,
            'cantidad': len(retazos_creados),
            'area_total_mm2': area_total,
            'errores': errores
        }
        
    except Exception as e:
        logger.error(f"Error crítico creando retazos: {str(e)}")
        return {
            'exito': False,
            'retazos_creados': retazos_creados,
            'cantidad': len(retazos_creados),
            'area_total_mm2': area_total,
            'errores': [f"Error crítico: {str(e)}"]
        }


def buscar_retazos_compatibles(
    db: Session,
    material_id: str,
    ancho_min_mm: float,
    alto_min_mm: float,
    espesor_mm: Optional[int] = None,
    estado: str = "disponible"
) -> List[Dict[str, Any]]:
    """
    Busca retazos existentes que podrían usarse para una pieza nueva.
    
    Útil para reutilizar material antes de comprar nuevo.
    
    Args:
        db: Sesión SQLAlchemy
        material_id: ID del material
        ancho_min_mm: Ancho mínimo requerido
        alto_min_mm: Alto mínimo requerido
        espesor_mm: (Optional) Espesor exacto requerido
        estado: Estado del retazo (default "disponible")
    
    Returns:
        List de retazos compatibles, ordenados por área (menor primero, para optimizar)
    """
    
    from app.models import Retazo
    
    query = db.query(Retazo).filter(
        Retazo.material_id == material_id,
        Retazo.ancho >= ancho_min_mm,
        Retazo.largo >= alto_min_mm,
        Retazo.estado_inventario == estado
    )
    
    if espesor_mm is not None:
        query = query.filter(Retazo.espesor == espesor_mm)
    
    # Ordenar por área (menor primero): preferimos usar retazos más pequeños
    query = query.order_by(Retazo.area_mm2.asc())
    
    retazos = query.all()
    
    return [
        {
            'id': r.id,
            'ancho_mm': r.ancho,
            'alto_mm': r.largo,
            'area_mm2': r.area_mm2,
            'ubicacion': r.ubicacion,
            'origen_corte': f"Acumulado {r.acumulado_produccion_id}" if r.acumulado_produccion_id else "Manual",
            'en_venta': r.en_venta,
            'precio': r.precio
        }
        for r in retazos
    ]


def marcar_retazo_usado(
    db: Session,
    retazo_id: str,
    usuario_id: Optional[str] = None,
    trabajo_id: Optional[str] = None
) -> bool:
    """
    Marca un retazo como used/reserved.
    
    Args:
        db: Sesión SQLAlchemy
        retazo_id: ID del Retazo
        usuario_id: (Optional) Usuario que lo usó
        trabajo_id: (Optional) Trabajo que lo usó
    
    Returns:
        True si success, False otherwise
    """
    
    from app.models import Retazo
    from services.auditoria import registrar_cambio_estado
    
    retazo = db.query(Retazo).filter(Retazo.id == retazo_id).first()
    
    if not retazo:
        logger.error(f"Retazo {retazo_id} no encontrado")
        return False
    
    estado_anterior = retazo.estado_inventario
    retazo.estado_inventario = "reservado"
    retazo.reservado_por = usuario_id
    retazo.updated_at = datetime.utcnow()
    
    db.commit()
    
    # Auditoría
    try:
        registrar_cambio_estado(
            db=db,
            tabla="retazo",
            registro_id=retazo_id,
            estado_anterior=estado_anterior,
            estado_nuevo="reservado",
            usuario_id=usuario_id,
            razon=f"uso_trabajo_{trabajo_id}" if trabajo_id else "manual_reserva"
        )
    except Exception as e:
        logger.error(f"Error registrando cambio: {str(e)}")
    
    logger.info(f"Retazo {retazo_id} marcado como reservado por {usuario_id}")
    return True
