from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict
from datetime import datetime

from ...db import get_db
from ...models.finanzas_produccion import Pago
from ...models.finanzas import Suscripcion
from ...models.presupuestos import Presupuesto, PresupuestoLinea
from ...models.crm import Cliente
from ...models.inventario import Material
from ...models.inventario import Lote
from ...auth import get_current_user
from ..schemas import (
    PagoCreate, PagoUpdate, PagoResponse, ClienteCreditoUpdate
)

router = APIRouter(prefix="/api/finanzas", tags=["finanzas"], dependencies=[Depends(get_current_user)])


# COMENTADO - Función eliminada (módulo Producción eliminado)
# def _ensure_trabajo_for_presupuesto(db: Session, presupuesto: Presupuesto) -> Trabajo:
#     trabajo = db.query(Trabajo).filter(Trabajo.presupuesto_id == presupuesto.id).first()
#     if trabajo:
#         return trabajo
#
#     cliente_nombre = "Cliente General"
#     if presupuesto.cliente_id:
#         c = db.query(Cliente).filter(Cliente.id == presupuesto.cliente_id).first()
#         if c and c.nombre:
#             cliente_nombre = c.nombre
#
#     linea = db.query(PresupuestoLinea).filter(PresupuestoLinea.presupuesto_id == presupuesto.id).first()
#     material_id = None
#     notas = None
#     if linea and getattr(linea, "lote_id", None):
#         lote = db.query(Lote).filter(Lote.id == linea.lote_id).first()
#         if lote:
#             material_id = lote.material_id
#     if not material_id and linea and getattr(linea, "material", None):
#         mat = db.query(Material).filter(Material.nombre.ilike(str(linea.material))).first()
#         if mat:
#             material_id = mat.id
#         else:
#             notas = f"Material no encontrado: {linea.material}"
#     if not material_id:
#         mat = db.query(Material).first()
#         if mat:
#             material_id = mat.id
#             if linea and getattr(linea, "material", None):
#                 notas = f"Material no encontrado: {linea.material}"
#
#     if not material_id:
#         raise HTTPException(status_code=400, detail="No hay materiales cargados para crear la orden")
#
#     # Estado inicial: pendiente_visita (para que no aparezca en Taller inmediatamente)
#     trabajo = Trabajo(cliente=cliente_nombre, material_id=material_id, presupuesto_id=presupuesto.id, notas=notas, estado="pendiente_visita")
#     db.add(trabajo)
#     db.flush()
#     return trabajo

@router.put("/presupuestos/{presupuesto_id}/aceptar")
def aceptar_presupuesto(presupuesto_id: str, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    presupuesto.aceptado_venta = True
    db.commit()
    db.refresh(presupuesto)
    return {"id": presupuesto.id, "aceptado_venta": presupuesto.aceptado_venta}

@router.post("/pagos", response_model=PagoResponse)
def registrar_pago(pago: PagoCreate, db: Session = Depends(get_db)):
    print(f"DEBUG: Registrando pago para presupuesto {pago.presupuesto_id}")
    print(f"DEBUG: Cliente ID: {pago.cliente_id}, Monto: {pago.monto}")
    # 1. Verify Presupuesto
    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == pago.presupuesto_id).first()
    if not presupuesto:
        print(f"ERROR: Presupuesto {pago.presupuesto_id} no encontrado")
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    aceptado = bool(getattr(presupuesto, "aceptado_venta", False))
    print(f"DEBUG: Presupuesto aceptado_venta = {aceptado}")
    
    if not aceptado:
        print(f"ERROR: Presupuesto {pago.presupuesto_id} no está aceptado (aceptado_venta=False)")
        raise HTTPException(status_code=400, detail="Presupuesto no aceptado - Primero debe aceptar el presupuesto antes de registrar pagos")
    
    # 1b. Verify Cliente
    if not pago.cliente_id:
        print(f"ERROR: Cliente ID no proporcionado en el pago")
        raise HTTPException(status_code=400, detail="Cliente ID es requerido para registrar un pago")

    now = datetime.now().isoformat()
    nuevo_pago = Pago(
        presupuesto_id=pago.presupuesto_id,
        cliente_id=pago.cliente_id,
        monto=pago.monto,
        metodo_pago=pago.metodo_pago,
        referencia=pago.referencia,
        nota=pago.nota,
        fecha=now,
        fecha_registro=now,
        estado="pendiente"
    )
    db.add(nuevo_pago)
    
    # 3. Update Presupuesto totals
    presupuesto.monto_cobrado = (presupuesto.monto_cobrado or 0.0) + pago.monto
    
    if presupuesto.monto_cobrado >= presupuesto.total:
        presupuesto.estado_pago = "pagado"
    elif presupuesto.monto_cobrado > 0:
        presupuesto.estado_pago = "parcial"
    else:
        presupuesto.estado_pago = "pendiente"

    # COMENTADO - Funcion eliminada (módulo Producción eliminado)
    # trabajo = _ensure_trabajo_for_presupuesto(db, presupuesto)
    # if presupuesto.total and (presupuesto.monto_cobrado / presupuesto.total) >= 0.4:
    #     trabajo.sena_abonada = True
        
    # 4. Update Cliente Balance (if applicable)
    if pago.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == pago.cliente_id).first()
        if cliente:
            cliente.saldo_actual = (cliente.saldo_actual or 0.0) - pago.monto
            if cliente.saldo_actual < 0:
                cliente.saldo_actual = 0.0

    # 5. Handle Recurring
    if pago.recurrente:
        # Simple string to datetime conversion if proximo_cobro is string
        prox_cobro = pago.recurrente.proximo_cobro
        if isinstance(prox_cobro, str):
            try:
                prox_cobro = datetime.fromisoformat(prox_cobro.replace('Z', '+00:00'))
            except:
                prox_cobro = datetime.utcnow() # Fallback

        nueva_suscripcion = Suscripcion(
            presupuesto_id=pago.presupuesto_id,
            cliente_id=pago.cliente_id or "",
            monto_cuota=pago.monto,
            frecuencia=pago.recurrente.frecuencia,
            dia_cobro=pago.recurrente.dia_cobro,
            proximo_cobro=prox_cobro
        )
        db.add(nueva_suscripcion)

    db.commit()
    db.refresh(nuevo_pago)
    return nuevo_pago

@router.put("/pagos/{pago_id}", response_model=PagoResponse)
def actualizar_pago(pago_id: str, payload: PagoUpdate, db: Session = Depends(get_db)):
    pago = db.query(Pago).filter(Pago.id == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == pago.presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if not bool(getattr(presupuesto, "aceptado_venta", False)):
        raise HTTPException(status_code=400, detail="Presupuesto no aceptado")

    old_monto = float(pago.monto or 0.0)
    new_monto = float(payload.monto if payload.monto is not None else old_monto)
    delta = new_monto - old_monto

    if payload.monto is not None:
        pago.monto = new_monto
    if payload.metodo_pago is not None:
        pago.metodo_pago = payload.metodo_pago
    if payload.referencia is not None:
        pago.referencia = payload.referencia
    if payload.nota is not None:
        pago.nota = payload.nota

    presupuesto.monto_cobrado = float(presupuesto.monto_cobrado or 0.0) + delta
    if presupuesto.monto_cobrado >= presupuesto.total:
        presupuesto.estado_pago = "pagado"
    elif presupuesto.monto_cobrado > 0:
        presupuesto.estado_pago = "parcial"
    else:
        presupuesto.estado_pago = "pendiente"

    if pago.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == pago.cliente_id).first()
        if cliente:
            cliente.saldo_actual = float(cliente.saldo_actual or 0.0) - delta
            if cliente.saldo_actual < 0:
                cliente.saldo_actual = 0.0

    # COMENTADO - Funcion eliminada (módulo Producción eliminado)
    # trabajo = _ensure_trabajo_for_presupuesto(db, presupuesto)
    # if presupuesto.total and (presupuesto.monto_cobrado / presupuesto.total) >= 0.4:
    #     trabajo.sena_abonada = True
    # else:
    #     trabajo.sena_abonada = False

    db.commit()
    db.refresh(pago)
    return pago

@router.delete("/pagos/{pago_id}")
def borrar_pago(pago_id: str, db: Session = Depends(get_db)):
    pago = db.query(Pago).filter(Pago.id == pago_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == pago.presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if not bool(getattr(presupuesto, "aceptado_venta", False)):
        raise HTTPException(status_code=400, detail="Presupuesto no aceptado")

    monto = float(pago.monto or 0.0)
    presupuesto.monto_cobrado = float(presupuesto.monto_cobrado or 0.0) - monto
    if presupuesto.monto_cobrado >= presupuesto.total:
        presupuesto.estado_pago = "pagado"
    elif presupuesto.monto_cobrado > 0:
        presupuesto.estado_pago = "parcial"
    else:
        presupuesto.estado_pago = "pendiente"

    if pago.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == pago.cliente_id).first()
        if cliente:
            cliente.saldo_actual = float(cliente.saldo_actual or 0.0) + monto

    # COMENTADO - Clases eliminadas (módulo Producción eliminado)
    # trabajo = db.query(Trabajo).filter(Trabajo.presupuesto_id == presupuesto.id).first()
    # if trabajo:
    #     if presupuesto.total and (presupuesto.monto_cobrado / presupuesto.total) >= 0.4:
    #         trabajo.sena_abonada = True
    #     else:
    #         trabajo.sena_abonada = False

    db.delete(pago)
    db.commit()
    return {"deleted": True}

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Total Presupuestado (Sum of all Presupuestos)
    total_presupuestado = db.query(func.sum(Presupuesto.total)).filter(Presupuesto.aceptado_venta == True).scalar() or 0.0
    
    # Total Recaudado (Sum of all Pagos)
    total_recaudado = (
        db.query(func.sum(Pago.monto))
        .join(Presupuesto, Presupuesto.id == Pago.presupuesto_id)
        .filter(Presupuesto.aceptado_venta == True)
        .scalar()
        or 0.0
    )
    
    # Total Pendiente
    # Ideally: Sum(Presupuesto.total - Presupuesto.monto_cobrado)
    # But since we have the aggregates, let's just diff them for the global view
    # Note: If there are deleted budgets, this might drift, but for now it's okay.
    total_pendiente = total_presupuestado - total_recaudado
    
    return {
        "total_presupuestado": total_presupuestado,
        "total_recaudado": total_recaudado,
        "total_pendiente": total_pendiente
    }

@router.get("/presupuestos/{id}/pagos", response_model=List[PagoResponse])
def get_pagos_presupuesto(id: str, db: Session = Depends(get_db)):
    pagos = db.query(Pago).filter(Pago.presupuesto_id == id).all()
    return pagos

@router.put("/clientes/{id}/credito")
def update_cliente_credito(id: str, data: ClienteCreditoUpdate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    cliente.es_cuenta_corriente = data.es_cuenta_corriente
    cliente.limite_credito = data.limite_credito
    
    db.commit()
    return {"message": "Crédito actualizado correctamente"}

@router.get("/pagos", response_model=List[PagoResponse])
def listar_pagos_v2(presupuesto_id: str = None, estado: str = None, db: Session = Depends(get_db)):
    q = db.query(Pago)
    if presupuesto_id:
        q = q.filter(Pago.presupuesto_id == presupuesto_id)
    if estado:
        q = q.filter(Pago.estado == estado)
    return q.all()

@router.get("/historial-descuentos")
def obtener_historial_descuentos(
    cliente_id: str = None, 
    presupuesto_id: str = None,
    fecha_desde: str = None,
    fecha_hasta: str = None,
    db: Session = Depends(get_db)
):
    """Obtiene el historial de descuentos aplicados en presupuestos"""
    from ...models.finanzas import HistorialDescuentos
    
    q = db.query(HistorialDescuentos)
    
    if cliente_id:
        q = q.filter(HistorialDescuentos.cliente_id == cliente_id)
    
    if presupuesto_id:
        q = q.filter(HistorialDescuentos.presupuesto_id == presupuesto_id)
    
    if fecha_desde:
        q = q.filter(HistorialDescuentos.fecha_aplicacion >= fecha_desde)
    
    if fecha_hasta:
        q = q.filter(HistorialDescuentos.fecha_aplicacion <= fecha_hasta)
    
    descuentos = q.order_by(HistorialDescuentos.fecha_aplicacion.desc()).all()
    
    result = []
    for d in descuentos:
        # Obtener info del cliente y presupuesto
        presupuesto = db.query(Presupuesto).filter(Presupuesto.id == d.presupuesto_id).first()
        cliente = None
        if d.cliente_id:
            cliente = db.query(Cliente).filter(Cliente.id == d.cliente_id).first()
        
        result.append({
            "id": d.id,
            "presupuesto_id": d.presupuesto_id,
            "cliente_id": d.cliente_id,
            "cliente_nombre": cliente.nombre if cliente else "N/A",
            "usuario_id": d.usuario_id,
            "tipo_descuento": d.tipo_descuento,
            "valor_descuento": d.valor_descuento,
            "monto_original": d.monto_original,
            "monto_con_descuento": d.monto_con_descuento,
            "monto_descontado": d.monto_descontado,
            "motivo": d.motivo,
            "fecha_aplicacion": d.fecha_aplicacion,
            "estado": d.estado
        })
    
    return result
