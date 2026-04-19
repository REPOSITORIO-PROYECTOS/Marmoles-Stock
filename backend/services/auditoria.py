"""
Servicio centralizado para auditoría de cambios de estado.

Proporciona funciones para registrar automáticamente transiciones de estado
en cualquier tabla del sistema (Trabajo, AcumuladoProduccion, Retazo, etc).
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


def registrar_cambio_estado(
    db: Session,
    tabla: str,
    registro_id: str,
    estado_anterior: Optional[str],
    estado_nuevo: str,
    usuario_id: Optional[str],
    razon: str,
    detalles: Optional[Dict[str, Any]] = None
) -> str:
    """
    Registra un cambio de estado en la tabla de auditoría.
    
    Args:
        db: Sesión SQLAlchemy
        tabla: Nombre de la tabla afectada (Ej: "trabajo", "acumulado_produccion")
        registro_id: ID del registro que cambió
        estado_anterior: Estado anterior (puede ser None si es creación)
        estado_nuevo: Nuevo estado
        usuario_id: ID del usuario que realizó el cambio
        razon: Descripción de por qué cambió (Ej: "corte_lienzo", "manual_operario")
        detalles: Dict opcional con detalles adicionales
    
    Returns:
        ID del registro de auditoría creado
    
    Ejemplo:
        >>> registrar_cambio_estado(
        ...     db=db,
        ...     tabla="trabajo",
        ...     registro_id="abc123",
        ...     estado_anterior="pendiente",
        ...     estado_nuevo="en_proceso",
        ...     usuario_id="user456",
        ...     razon="manual_operario"
        ... )
    """
    
    try:
        # Importar acá para evitar circular imports
        from app.models import CambioEstadoAuditoria
        
        # Crear registro de auditoría
        auditoria = CambioEstadoAuditoria(
            tabla_afectada=tabla,
            registro_id=registro_id,
            estado_anterior=estado_anterior,
            estado_nuevo=estado_nuevo,
            usuario_id=usuario_id,
            timestamp=datetime.utcnow(),
            razon=razon,
            detalles_json=detalles
        )
        
        db.add(auditoria)
        db.flush()  # Obtener ID sin commitear aún
        
        logger.info(
            f"Auditoría: {tabla}#{registro_id} {estado_anterior}→{estado_nuevo} por {usuario_id} ({razon})"
        )
        
        return auditoria.id
        
    except Exception as e:
        logger.error(f"Error registrando auditoría: {str(e)}")
        # NO lanzar excepción; auditoría nunca debe romper la lógica principal
        raise


def obtener_historial_cambios(
    db: Session,
    tabla: str,
    registro_id: str,
    limit: int = 100
) -> list:
    """
    Obtiene el historial de cambios de estado de un registro.
    
    Args:
        db: Sesión SQLAlchemy
        tabla: Nombre de la tabla
        registro_id: ID del registro
        limit: Máximo de registros a retornar
    
    Returns:
        Lista de CambioEstadoAuditoria ordenados por timestamp desc
    """
    
    from app.models import CambioEstadoAuditoria
    
    return db.query(CambioEstadoAuditoria).filter(
        CambioEstadoAuditoria.tabla_afectada == tabla,
        CambioEstadoAuditoria.registro_id == registro_id
    ).order_by(CambioEstadoAuditoria.timestamp.desc()).limit(limit).all()


def obtener_auditoria_reciente(
    db: Session,
    tabla: str,
    limit: int = 50
) -> list:
    """
    Obtiene los cambios de estado más recientes de una tabla.
    
    Útil para dashboards de auditoría global.
    
    Args:
        db: Sesión SQLAlchemy
        tabla: Nombre de la tabla
        limit: Máximo de registros
    
    Returns:
        Lista de cambios recientes, ordenados por timestamp desc
    """
    
    from app.models import CambioEstadoAuditoria
    
    return db.query(CambioEstadoAuditoria).filter(
        CambioEstadoAuditoria.tabla_afectada == tabla
    ).order_by(CambioEstadoAuditoria.timestamp.desc()).limit(limit).all()


def resumen_cambios_por_usuario(
    db: Session,
    usuario_id: str,
    tabla: Optional[str] = None,
    limit: int = 100
) -> list:
    """
    Obtiene todos los cambios realizados por un usuario específico.
    
    Útil para auditorías de usuario.
    
    Args:
        db: Sesión SQLAlchemy
        usuario_id: ID del usuario
        tabla: (Optional) Filtrar por tabla específica
        limit: Máximo de registros
    
    Returns:
        Lista de cambios ordenados por timestamp desc
    """
    
    from app.models import CambioEstadoAuditoria
    
    query = db.query(CambioEstadoAuditoria).filter(
        CambioEstadoAuditoria.usuario_id == usuario_id
    )
    
    if tabla:
        query = query.filter(CambioEstadoAuditoria.tabla_afectada == tabla)
    
    return query.order_by(CambioEstadoAuditoria.timestamp.desc()).limit(limit).all()
