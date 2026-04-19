from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..schemas import LeadCreate, LeadUpdate, LeadBulkDeletePayload, ClienteCreate, ClienteUpdate
from ...db import get_db
from ...models import Lead as LeadModel
from ...models import Cliente as ClienteModel
from ...models import Presupuesto as PresupuestoModel
from ...models import PresupuestoLinea as PresupuestoLineaModel
from ...models import PresupuestoMeta as PresupuestoMetaModel
from ...models.finanzas_produccion import Pago
from ...models.servicios import PrestacionServicio
from ...models.finanzas import Suscripcion, CuentaCorrienteMovimiento
from ...auth import get_current_user, require_roles

print("DEBUG: LOADING CRM ROUTER")

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.get("/api/leads")
def listar_leads(db: Session = Depends(get_db)):
    from ...models import Presupuesto as PresupuestoModel
    rows = db.query(LeadModel).all()
    result = []
    for r in rows:
        lead_dict = {
            "id": r.id, 
            "nombre": r.nombre, 
            "telefono": r.telefono, 
            "email": r.email, 
            "dni": getattr(r, 'dni', None), 
            "direccion": r.direccion, 
            "coordenadas": getattr(r, 'coordenadas', None), 
            "estado": r.estado,
            "fecha_creacion": getattr(r, 'fecha_creacion', None),
            "cliente_id": getattr(r, 'cliente_id', None)  # Incluir vinculación directa
        }
        
        # Si el lead tiene cliente_id vinculado directamente, usar eso
        if lead_dict.get('cliente_id'):
            cliente = db.query(ClienteModel).filter(ClienteModel.id == lead_dict['cliente_id']).first()
            if cliente:
                # Buscar último presupuesto del cliente
                presupuestos = db.query(PresupuestoModel).filter(
                    PresupuestoModel.cliente_id == cliente.id
                ).all()
                
                if presupuestos:
                    ultimo_presupuesto = presupuestos[-1]
                    lead_dict["presupuesto_relacionado_id"] = ultimo_presupuesto.id
                    
                    # Extraer detalles de la primera línea (material y metros)
                    from ...models import PresupuestoLinea
                    lineas = db.query(PresupuestoLinea).filter(
                        PresupuestoLinea.presupuesto_id == ultimo_presupuesto.id
                    ).all()
                    
                    if lineas:
                        primera_linea = lineas[0]
                        lead_dict["presupuesto_info"] = {
                            "material": primera_linea.material,
                            "metros": primera_linea.metros_cuadrados,
                            "total": ultimo_presupuesto.total
                        }
        else:
            # Si no hay cliente_id directo, buscar por email/teléfono como fallback
            if r.email or r.telefono:
                query = db.query(ClienteModel)
                filters = []
                if r.email:
                    filters.append(ClienteModel.email == r.email)
                if r.telefono:
                    filters.append(ClienteModel.telefono == r.telefono)
                
                if filters:
                    from sqlalchemy import or_
                    cliente = query.filter(or_(*filters)).first()
                    
                    if cliente:
                        # Buscar ultimo Presupuesto
                        presupuestos = db.query(PresupuestoModel).filter(
                            PresupuestoModel.cliente_id == cliente.id
                        ).all()
                        
                        if presupuestos:
                            ultimo_presupuesto = presupuestos[-1]
                            lead_dict["presupuesto_relacionado_id"] = ultimo_presupuesto.id
                            
                            # Extraer detalles de la primera línea (material y metros)
                            from ...models import PresupuestoLinea
                            lineas = db.query(PresupuestoLinea).filter(
                                PresupuestoLinea.presupuesto_id == ultimo_presupuesto.id
                            ).all()
                            
                            if lineas:
                                primera_linea = lineas[0]
                                lead_dict["presupuesto_info"] = {
                                    "material": primera_linea.material,
                                    "metros": primera_linea.metros_cuadrados,
                                    "total": ultimo_presupuesto.total
                                }

        result.append(lead_dict)
    return result

@router.post("/api/leads")
def crear_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    # Evitar duplicados: Si ya existe un lead abierto (no ganado/perdido) con mismo email/telefono, retornarlo
    from sqlalchemy import or_
    filters = []
    if payload.email:
        filters.append(LeadModel.email == payload.email)
    if payload.telefono:
        filters.append(LeadModel.telefono == payload.telefono)
    
    if filters:
        existente = db.query(LeadModel).filter(or_(*filters)).filter(LeadModel.estado.notin_(["ganado", "perdido", "convertido"])).first()
        if existente:
            # Opcional: Actualizar datos si vienen nuevos
            return {
                "id": existente.id,
                "nombre": existente.nombre,
                "estado": existente.estado,
                "mensaje": "Lead existente retornado",
                "fecha_creacion": getattr(existente, 'fecha_creacion', None)
            }

    from datetime import datetime
    l = LeadModel(
        nombre=payload.nombre, 
        telefono=payload.telefono, 
        email=payload.email, 
        dni=payload.dni,
        direccion=payload.direccion,
        coordenadas=payload.coordenadas,
        fecha_creacion=datetime.utcnow().isoformat()
    )
    db.add(l)
    db.commit()
    db.refresh(l)
    return {
        "id": l.id,
        "nombre": l.nombre,
        "telefono": l.telefono,
        "email": l.email,
        "dni": l.dni,
        "direccion": l.direccion,
        "coordenadas": l.coordenadas,
        "estado": l.estado,
        "fecha_creacion": getattr(l, 'fecha_creacion', None)
    }

@router.patch("/api/leads/{leadId}")
def actualizar_lead(leadId: str, payload: LeadUpdate, db: Session = Depends(get_db), user = Depends(require_roles(["admin"]))):
    l = db.query(LeadModel).filter(LeadModel.id == leadId).first()
    if not l:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
    
    print(f"DEBUG: PATCH /api/leads/{leadId} - Payload: {payload.dict(exclude_none=True)} - Current State: {l.estado}")

    # Lógica de Conversión Automática
    if payload.estado == "convertido" and l.estado != "convertido":
        print("DEBUG: Entrando a lógica de conversión automática")
        from ...models import Presupuesto as PresupuestoModel
        from sqlalchemy import or_
        
        # 1. Buscar o Crear Cliente - Asegurar vinculación 1:1
        cliente = None
        
        # Primero, buscar por email o teléfono
        filtros = []
        if l.email: filtros.append(ClienteModel.email == l.email)
        if l.telefono: filtros.append(ClienteModel.telefono == l.telefono)
        
        if filtros:
            cliente = db.query(ClienteModel).filter(or_(*filtros)).first()
            if cliente:
                print(f"DEBUG: Cliente existente encontrado: {cliente.id}")
            
        if not cliente:
            print("DEBUG: Creando nuevo cliente...")
            cliente = ClienteModel(
                nombre=l.nombre,
                telefono=l.telefono,
                email=l.email,
                dni=l.dni,
                direccion=l.direccion,
                coordenadas=l.coordenadas
            )
            db.add(cliente)
            db.flush()
            print(f"DEBUG: Cliente creado automáticamente desde Lead: {cliente.id}")
        
        # IMPORTANTE: Vincular el lead con el cliente (relación 1:1)
        l.cliente_id = cliente.id
        print(f"DEBUG: Lead {l.id} vinculado a Cliente {cliente.id}")
            
        # 2. Verificar si existe presupuesto. Si no, crear uno vacío para iniciar flujo financiero.
        pres = db.query(PresupuestoModel).filter(PresupuestoModel.cliente_id == cliente.id).first()
        if not pres:
            print("DEBUG: Creando presupuesto para cliente...")
            pres = PresupuestoModel(
                cliente_id=cliente.id,
                observaciones="Generado automáticamente al convertir Lead.",
                total=0.0,
                estado_pago="pendiente",
                aceptado_venta=True # Asumimos que si se convierte es porque hay intención firme
            )
            db.add(pres)
            print(f"DEBUG: Presupuesto creado automáticamente para cliente: {cliente.id}")
        else:
            print(f"DEBUG: Presupuesto ya existe para cliente: {pres.id}")

    data = payload.dict(exclude_none=True)
    for k, v in data.items():
        if hasattr(l, k):
            setattr(l, k, v)
    db.commit()
    return {"id": l.id}

@router.post("/api/leads/bulk-delete")
def borrar_leads(payload: LeadBulkDeletePayload, db: Session = Depends(get_db), user = Depends(require_roles(["admin"]))):
    if not payload.ids:
        return {"deleted": 0}
    updated = db.query(LeadModel).filter(LeadModel.id.in_(payload.ids)).update(
        {"estado": "archivado"},
        synchronize_session=False
    )
    db.commit()
    return {"deleted": updated}

@router.post("/api/clientes")
def crear_cliente(payload: ClienteCreate, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    print(f"DEBUG: POST /api/clientes called with payload: {payload.dict()}")
    
    # Normalization function - same as frontend
    def normalize(s: str) -> str:
        if not s:
            return ""
        normalized = s.lower().strip()
        # Remove whitespace and special characters
        normalized = normalized.replace(" ", "").replace("-", "").replace(".", "").replace("/", "")
        return normalized
    
    # Build normalized key from payload (email > phone > name)
    norm_key = normalize(payload.email or payload.telefono or payload.nombre or "")
    
    if norm_key:
        # Check if a client with same normalized key exists
        existing = db.query(ClienteModel).all()
        for existing_client in existing:
            existing_key = normalize(
                existing_client.email or existing_client.telefono or existing_client.nombre or ""
            )
            if existing_key == norm_key and existing_key:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=409,
                    detail=f"Ya existe un cliente con estos datos (nombre/email/teléfono similar): {existing_client.nombre}"
                )
    
    c = ClienteModel(
        nombre=payload.nombre,
        telefono=payload.telefono,
        email=payload.email,
        direccion=payload.direccion,
        coordenadas=payload.coordenadas
    )
    db.add(c)
    db.commit()
    db.refresh(c) # Refresh to get any default values or generated IDs
    print(f"DEBUG: Client created with ID: {c.id}")

    return {"id": c.id, "nombre": c.nombre, "telefono": c.telefono, "email": c.email, "direccion": c.direccion, "coordenadas": c.coordenadas}

@router.get("/api/clientes")
def listar_clientes(db: Session = Depends(get_db)):
    print("DEBUG: GET /api/clientes called")
    rows = db.query(ClienteModel).all()
    print(f"DEBUG: Retrieved {len(rows)} clients")
    result = []
    for r in rows:
        print(f"DEBUG: Processing client ID: {r.id}, Nombre: {r.nombre}")
        result.append({"id": r.id, "nombre": r.nombre, "telefono": r.telefono, "email": r.email, "direccion": r.direccion, "coordenadas": getattr(r, 'coordenadas', None)})
    return result

@router.patch("/api/clientes/{clienteId}")
def actualizar_cliente(clienteId: str, payload: ClienteUpdate, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    c = db.query(ClienteModel).filter(ClienteModel.id == clienteId).first()
    if not c:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")
    data = payload.dict(exclude_none=True)
    for k, v in data.items():
        if hasattr(c, k):
            setattr(c, k, v)
    db.commit()
    return {"id": c.id}

@router.delete("/api/clientes/{clienteId}")
def eliminar_cliente(clienteId: str, db: Session = Depends(get_db), user = Depends(require_roles(["admin"]))):
    c = db.query(ClienteModel).filter(ClienteModel.id == clienteId).first()
    if not c:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")

    presupuestos = db.query(PresupuestoModel).filter(PresupuestoModel.cliente_id == clienteId).all()
    for p in presupuestos:
        pid = p.id
        db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id == pid).delete(synchronize_session=False)
        db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == pid).delete(synchronize_session=False)
        db.query(Pago).filter(Pago.presupuesto_id == pid).delete(synchronize_session=False)
        # COMENTADO - Clases eliminadas (módulo Producción eliminado)
        # db.query(VisitaTecnica).filter(VisitaTecnica.presupuesto_id == pid).delete(synchronize_session=False)
        # db.query(OrdenProduccion).filter(OrdenProduccion.presupuesto_id == pid).delete(synchronize_session=False)
        db.query(PrestacionServicio).filter(PrestacionServicio.presupuesto_id == pid).delete(synchronize_session=False)
        db.query(Suscripcion).filter(Suscripcion.presupuesto_id == pid).delete(synchronize_session=False)
        db.query(CuentaCorrienteMovimiento).filter(CuentaCorrienteMovimiento.referencia_id == pid).delete(synchronize_session=False)

        # COMENTADO - Clases eliminadas (módulo Producción eliminado)
        # trabajos = db.query(Trabajo).filter(Trabajo.presupuesto_id == pid).all()
        # for t in trabajos:
        #     db.query(PiezaTrabajo).filter(PiezaTrabajo.trabajo_id == t.id).delete(synchronize_session=False)
        #     db.delete(t)

        db.delete(p)

    db.delete(c)
    db.commit()
    return {"deleted": True, "id": clienteId}
