from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..schemas import PlanoTecnicoCreate, PlanoTecnicoUpdate, PlanoRevisionCreate
from ...db import get_db
from ...models import PlanoTecnico, PlanoRevision, Cliente, Presupuesto, PresupuestoLinea, Material, Lote
from ...auth import get_current_user, require_roles
import datetime
import json

router = APIRouter(dependencies=[Depends(get_current_user)])

# COMENTADO - Función eliminada (módulo Producción eliminado)
# def ensure_trabajo(db: Session, presupuesto: Presupuesto, plano: PlanoTecnico) -> Trabajo:
#     # 1. Buscar trabajo existente para este presupuesto
#     # Priorizamos 'pendiente' o 'pendiente_visita'
#     trabajos = db.query(Trabajo).filter(Trabajo.presupuesto_id == presupuesto.id).all()
#     for t in trabajos:
#         if t.estado in ["pendiente", "pendiente_visita"]:
#             return t
#     
#     # Si hay trabajos pero ninguno pendiente, tomamos el último creado
#     if trabajos:
#         return trabajos[-1]
#
#     # 2. Si no existe, creamos uno nuevo
#     cliente_nombre = "Cliente General"
#     if presupuesto.cliente_id:
#         c = db.query(Cliente).filter(Cliente.id == presupuesto.cliente_id).first()
#         if c and c.nombre:
#             cliente_nombre = c.nombre
#
#     # Intentar deducir material
#     material_id = None
#     notas = None
#     
#     # a) Desde el plano
#     if plano.contenido_json:
#         try:
#             datos = plano.contenido_json
#             if isinstance(datos, str):
#                 datos = json.loads(datos)
#             
#             mat_data = datos.get("material")
#             if mat_data and isinstance(mat_data, dict):
#                 mat_nombre = mat_data.get("nombre")
#                 if mat_nombre:
#                     mat = db.query(Material).filter(Material.nombre.ilike(mat_nombre)).first()
#                     if mat:
#                         material_id = mat.id
#         except:
#             pass
#
#     # b) Desde el presupuesto (primera línea)
#     if not material_id:
#         linea = db.query(PresupuestoLinea).filter(PresupuestoLinea.presupuesto_id == presupuesto.id).first()
#         if linea:
#             if getattr(linea, "lote_id", None):
#                 lote = db.query(Lote).filter(Lote.id == linea.lote_id).first()
#                 if lote:
#                     material_id = lote.material_id
#             
#             if not material_id and getattr(linea, "material", None):
#                 mat = db.query(Material).filter(Material.nombre.ilike(str(linea.material))).first()
#                 if mat:
#                     material_id = mat.id
#                 else:
#                     notas = f"Material sugerido: {linea.material}"
#
#     # c) Fallback
#     if not material_id:
#         mat = db.query(Material).first()
#         if mat:
#             material_id = mat.id
#             notas = (notas or "") + " (Material asignado por defecto)"
#     
#     if not material_id:
#         raise HTTPException(status_code=400, detail="No se pudo determinar un material para crear la orden de trabajo")
#
#     nuevo_trabajo = Trabajo(
#         cliente=cliente_nombre,
#         material_id=material_id,
#         presupuesto_id=presupuesto.id,
#         notas=notas,
#         estado="pendiente", # Lo creamos directamente en pendiente para producción
#         prioridad="media"
#     )
#     db.add(nuevo_trabajo)
#     db.flush() # Para obtener ID
#     return nuevo_trabajo

@router.post("/api/planos-tecnicos/{id}/aprobar-produccion")
def aprobar_plano_produccion(id: str, db: Session = Depends(get_db)):
    # 1. Buscar el plano
    plano = db.query(PlanoTecnico).filter(PlanoTecnico.id == id).first()
    if not plano:
        raise HTTPException(status_code=404, detail="Plano no encontrado")
    
    # 2. Buscar el trabajo asociado (Antes de aprobar)
    # Buscamos el presupuesto más reciente del cliente
    presupuesto = db.query(Presupuesto).filter(
        Presupuesto.cliente_id == plano.cliente_id
    ).order_by(Presupuesto.id.desc()).first()

    if not presupuesto:
        # No aprobamos si no hay presupuesto
        return {"id": plano.id, "status": plano.estado, "warning": "No se encontró un presupuesto para este cliente. El plano no ha sido aprobado."}

    try:
        # COMENTADO - Funcion eliminada (módulo Producción eliminado)
        # trabajo = ensure_trabajo(db, presupuesto, plano)
        pass
    except Exception as e:
        return {"id": plano.id, "status": plano.estado, "warning": f"Error al vincular trabajo: {str(e)}"}

    # 3. Procesar contenido_json para extraer piezas
    try:
        if not plano.contenido_json:
            return {"id": plano.id, "status": plano.estado, "warning": "El plano no tiene contenido visual. No se puede aprobar."}

        datos = plano.contenido_json
        if isinstance(datos, str):
            datos = json.loads(datos)
        
        # El editor puede guardar en 'placements' o en la raíz
        placements = datos.get("placements", [])
        if not placements and isinstance(datos, list):
            placements = datos

        if not placements:
            return {"id": plano.id, "status": plano.estado, "warning": "No se encontraron piezas en el diseño. No se puede aprobar."}

        # 4. Todo OK -> Aplicar cambios
        plano.estado = "aprobado"
        
        # COMENTADO - Clases eliminadas (módulo Producción eliminado)
        # db.query(PiezaTrabajo).filter(PiezaTrabajo.trabajo_id == trabajo.id).delete()
        # counts = {}
        # for p in placements:
        #     w = int(p.get("wCm") or p.get("w") or 0)
        #     h = int(p.get("hCm") or p.get("h") or 0)
        #     if w <= 0 or h <= 0:
        #         continue
        #     key = (w, h)
        #     counts[key] = counts.get(key, 0) + 1
        # for (w, h), qty in counts.items():
        #     pieza = PiezaTrabajo(
        #         trabajo_id=trabajo.id,
        #         w=w,
        #         h=h,
        #         qty=qty,
        #         tipo="principal",
        #     )
        #     db.add(pieza)

        # 5. Integration with Finanzas: Ensure Presupuesto/Lead is visible
        # if trabajo.presupuesto_id:
        #     presupuesto = db.query(Presupuesto).filter(Presupuesto.id == trabajo.presupuesto_id).first()
        if presupuesto:
                # Mark as accepted by sales if not already (logic: plan approved = sale confirmed)
                if not getattr(presupuesto, "aceptado_venta", False):
                    setattr(presupuesto, "aceptado_venta", True)
                    setattr(presupuesto, "fecha_aceptado", datetime.datetime.now().isoformat())
                    db.add(presupuesto)
                    
                # Update Lead if exists to ensure visibility in Finanzas
                if presupuesto.cliente_id:
                     c = db.query(Cliente).filter(Cliente.id == presupuesto.cliente_id).first()
                     if c:
                         from ...models import Lead
                         from sqlalchemy import or_
                         filters = []
                         if c.email: filters.append(Lead.email == c.email)
                         if c.telefono: filters.append(Lead.telefono == c.telefono)
                         if filters:
                             lead = db.query(Lead).filter(or_(*filters)).order_by(Lead.id.desc()).first()
                             if lead and lead.estado not in ["convertido", "ganado"]:
                                 lead.estado = "ganado" 
                                 db.add(lead)
            
        db.commit()
        return {
            "id": plano.id, 
            "status": "aprobado", 
            # "trabajo_id": trabajo.id,  # COMENTADO - trabajo eliminado
            # "piezas_creadas": len(placements)  # COMENTADO - trabajo eliminado
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al procesar el plano: {str(e)}")

@router.post("/api/planos-tecnicos")
def crear_plano_tecnico(payload: PlanoTecnicoCreate, db: Session = Depends(get_db)):
    fecha = datetime.datetime.now().isoformat()
    p = PlanoTecnico(
        nombre=payload.nombre,
        cliente_id=payload.cliente_id,
        proyecto=payload.proyecto,
        categoria=payload.categoria,
        estado=payload.estado,
        tipo=payload.tipo,
        contenido_json=payload.contenido_json,
        fecha_creacion=fecha
    )
    db.add(p)
    db.commit()
    return {"id": p.id, "nombre": p.nombre}

@router.get("/api/planos-tecnicos")
def listar_planos_tecnicos(cliente_id: str | None = None, proyecto: str | None = None, estado: str | None = None, db: Session = Depends(get_db)):
    q = db.query(PlanoTecnico)
    if cliente_id:
        q = q.filter(PlanoTecnico.cliente_id == cliente_id)
    if proyecto:
        q = q.filter(PlanoTecnico.proyecto.ilike(f"%{proyecto}%"))
    if estado and estado != "todos":
         q = q.filter(PlanoTecnico.estado == estado)
    
    rows = q.all()
    out = []
    
    # COMENTADO - VisitaTecnica eliminada (módulo Producción eliminado)
    # from ...models import VisitaTecnica 

    for r in rows:
        cliente_nombre = None
        cliente_direccion = None
        visita_status = "no_requerida"
        visita_fecha = None

        if r.cliente_id:
            c = db.query(Cliente).filter(Cliente.id == r.cliente_id).first()
            if c:
                cliente_nombre = c.nombre
                cliente_direccion = c.direccion
            
            # Check Visit Status - COMENTADO: VisitaTecnica eliminada
            presupuesto = db.query(Presupuesto).filter(
                Presupuesto.cliente_id == r.cliente_id
            ).order_by(Presupuesto.id.desc()).first()
            
            # if presupuesto:
            #     visita = db.query(VisitaTecnica).filter(
            #         VisitaTecnica.presupuesto_id == presupuesto.id
            #     ).order_by(VisitaTecnica.id.desc()).first()
            #     
            #     if visita:
            #         visita_status = visita.estado 
            #         visita_fecha = visita.fecha
            #     else:
            #         visita_status = "pendiente_solicitud"
            visita_status = "pendiente_solicitud"
            visita_fecha = None

        # Get latest revision date
        last_rev = db.query(PlanoRevision).filter(PlanoRevision.plano_id == r.id).order_by(PlanoRevision.version.desc()).first()
        fecha_revision = last_rev.fecha_subida if last_rev else r.fecha_creacion
                
        out.append({
            "id": r.id,
            "nombre": r.nombre,
            "cliente_id": r.cliente_id,
            "cliente_nombre": cliente_nombre,
            "cliente_direccion": cliente_direccion,
            "proyecto": r.proyecto,
            "categoria": r.categoria,
            "estado": r.estado,
            "tipo": r.tipo,
            "contenido_json": r.contenido_json,
            "fecha_creacion": r.fecha_creacion,
            "ultimo_archivo": r.ultimo_archivo,
            "visita_estado": visita_status,
            "visita_fecha": visita_fecha,
            "fecha_revision": fecha_revision
        })
    return out

@router.get("/api/planos-tecnicos/{id}")
def obtener_plano_tecnico(id: str, db: Session = Depends(get_db)):
    r = db.query(PlanoTecnico).filter(PlanoTecnico.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Plano no encontrado")
    
    cliente_nombre = None
    if r.cliente_id:
        c = db.query(Cliente).filter(Cliente.id == r.cliente_id).first()
        if c:
            cliente_nombre = c.nombre

    revisions = db.query(PlanoRevision).filter(PlanoRevision.plano_id == id).order_by(PlanoRevision.version.desc()).all()
    
    return {
        "id": r.id,
        "nombre": r.nombre,
        "cliente_id": r.cliente_id,
        "cliente_nombre": cliente_nombre,
        "proyecto": r.proyecto,
        "categoria": r.categoria,
        "estado": r.estado,
        "tipo": r.tipo,
        "contenido_json": r.contenido_json,
        "fecha_creacion": r.fecha_creacion,
        "ultimo_archivo": r.ultimo_archivo,
        "revisiones": [{
            "id": rev.id,
            "version": rev.version,
            "archivo_url": rev.archivo_url,
            "fecha_subida": rev.fecha_subida,
            "comentarios": rev.comentarios,
            "subido_por": rev.subido_por
        } for rev in revisions]
    }

@router.put("/api/planos-tecnicos/{id}")
def actualizar_plano_tecnico(id: str, payload: PlanoTecnicoUpdate, db: Session = Depends(get_db)):
    p = db.query(PlanoTecnico).filter(PlanoTecnico.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plano no encontrado")
    
    data = payload.dict(exclude_none=True)
    for k, v in data.items():
        if hasattr(p, k):
            setattr(p, k, v)
    
    db.commit()
    return {"id": p.id}

@router.post("/api/planos-tecnicos/{id}/revisiones")
def agregar_revision(id: str, payload: PlanoRevisionCreate, db: Session = Depends(get_db)):
    p = db.query(PlanoTecnico).filter(PlanoTecnico.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plano no encontrado")
    
    fecha = datetime.datetime.now().isoformat()
    rev = PlanoRevision(
        plano_id=id,
        version=payload.version,
        archivo_url=payload.archivo_url,
        fecha_subida=fecha,
        comentarios=payload.comentarios,
        subido_por=payload.subido_por
    )
    db.add(rev)
    
    # Update latest file in main record
    p.ultimo_archivo = payload.archivo_url
    
    db.commit()
    return {"id": rev.id, "version": rev.version}


