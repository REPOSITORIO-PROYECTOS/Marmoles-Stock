from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import ServicioCreate, ServicioUpdate, PrestacionServicioCreate, PrestacionServicioUpdate
from ...db import get_db
from ...models import Servicio, PrestacionServicio, Proveedor, Cliente
from ...auth import get_current_user, require_roles
import datetime
import uuid

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/api/servicios")
def crear_servicio(payload: ServicioCreate, db: Session = Depends(get_db)):
    s = Servicio(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        categoria=payload.categoria,
        precio_base=payload.precio_base,
        unidad=payload.unidad,
        proveedor_id=payload.proveedor_id,
        tiempo_estimado=payload.tiempo_estimado,
        disponible=payload.disponible,
        detalles_tecnicos=payload.detalles_tecnicos,
        observaciones=payload.observaciones
    )
    db.add(s)
    db.commit()
    return {"id": s.id, "nombre": s.nombre}

@router.get("/api/servicios")
def listar_servicios(categoria: str | None = None, disponible: bool | None = None, db: Session = Depends(get_db)):
    q = db.query(Servicio)
    if categoria:
        q = q.filter(Servicio.categoria == categoria)
    if disponible is not None:
        q = q.filter(Servicio.disponible == disponible)
    
    rows = q.all()
    out = []
    for r in rows:
        prov_nombre = None
        if r.proveedor_id:
            prov = db.query(Proveedor).filter(Proveedor.id == r.proveedor_id).first()
            prov_nombre = prov.nombre if prov else None
            
        out.append({
            "id": r.id,
            "nombre": r.nombre,
            "descripcion": r.descripcion,
            "categoria": r.categoria,
            "precio_base": r.precio_base,
            "unidad": r.unidad,
            "proveedor_id": r.proveedor_id,
            "proveedor_nombre": prov_nombre,
            "tiempo_estimado": r.tiempo_estimado,
            "disponible": r.disponible
        })
    return out

@router.put("/api/servicios/{id}")
def actualizar_servicio(id: str, payload: ServicioUpdate, db: Session = Depends(get_db)):
    s = db.query(Servicio).filter(Servicio.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        if hasattr(s, k):
            setattr(s, k, v)
    db.commit()
    return {"id": s.id}


@router.delete("/api/servicios/{id}")
def eliminar_servicio(id: str, db: Session = Depends(get_db), user = Depends(require_roles(["admin"]))):
    s = db.query(Servicio).filter(Servicio.id == id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    db.delete(s)
    db.commit()
    return {"deleted": True, "id": id}

# Prestaciones (Reporte de Servicios)

@router.post("/api/prestaciones")
def crear_prestacion(payload: PrestacionServicioCreate, db: Session = Depends(get_db)):
    # Generate unique code
    year = datetime.datetime.now().year
    count = db.query(PrestacionServicio).count() + 1
    code = f"SRV-{year}-{count:04d}"
    
    # Get service name snapshot
    serv = db.query(Servicio).filter(Servicio.id == payload.servicio_id).first()
    serv_nombre = serv.nombre if serv else "Desconocido"

    p = PrestacionServicio(
        codigo_unico=code,
        servicio_id=payload.servicio_id,
        servicio_nombre=serv_nombre,
        presupuesto_id=payload.presupuesto_id,
        cliente_id=payload.cliente_id,
        fecha_prestacion=payload.fecha_prestacion or datetime.datetime.now().isoformat(),
        costo=payload.costo,
        estado=payload.estado or "pendiente",
        notas=payload.notas
    )
    db.add(p)
    db.commit()
    return {"id": p.id, "codigo_unico": p.codigo_unico}

@router.get("/api/prestaciones")
def listar_prestaciones(cliente_id: str | None = None, fecha_inicio: str | None = None, fecha_fin: str | None = None, db: Session = Depends(get_db)):
    q = db.query(PrestacionServicio)
    if cliente_id:
        q = q.filter(PrestacionServicio.cliente_id == cliente_id)
    if fecha_inicio:
        q = q.filter(PrestacionServicio.fecha_prestacion >= fecha_inicio)
    if fecha_fin:
        q = q.filter(PrestacionServicio.fecha_prestacion <= fecha_fin)
        
    rows = q.order_by(PrestacionServicio.fecha_prestacion.desc()).all()
    out = []
    for r in rows:
        cliente_nombre = None
        if r.cliente_id:
            c = db.query(Cliente).filter(Cliente.id == r.cliente_id).first()
            cliente_nombre = c.nombre if c else None
            
        out.append({
            "id": r.id,
            "codigo_unico": r.codigo_unico,
            "servicio_id": r.servicio_id,
            "servicio_nombre": r.servicio_nombre,
            "presupuesto_id": r.presupuesto_id,
            "cliente_id": r.cliente_id,
            "cliente_nombre": cliente_nombre,
            "fecha_prestacion": r.fecha_prestacion,
            "costo": r.costo,
            "estado": r.estado,
            "aprobado_por": r.aprobado_por,
            "firma_digital": r.firma_digital,
            "notas": r.notas
        })
    return out

@router.patch("/api/prestaciones/{id}")
def actualizar_prestacion(id: str, payload: PrestacionServicioUpdate, db: Session = Depends(get_db)):
    p = db.query(PrestacionServicio).filter(PrestacionServicio.id == id).first()
    if not p:
        raise HTTPException(status_code=404)
    
    data = payload.dict(exclude_none=True)
    for k, v in data.items():
        if hasattr(p, k):
            setattr(p, k, v)
    db.commit()
    return {"id": p.id}
