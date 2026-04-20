from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..schemas import MaterialCreate, CompraProveedor, RetazoUpdate, VentaRetazo, ProveedorCreate, ProveedorUpdate, LoteCreate, LoteUpdate, RetazoCreate, PlacaCreate, ArticuloCreate, ArticuloUpdate
from ...db import get_db
from ...models import Material as MaterialModel
from ...models import Placa as PlacaModel
from ...models import Retazo as RetazoModel
from ...models import User as UserModel
from ...models import Proveedor as ProveedorModel
from ...models import Compra as CompraModel
from ...models import MovimientoInventario as MovModel
from ...models import Lote as LoteModel
from ...auth import require_roles, get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/api/materiales")
def crear_material(payload: MaterialCreate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["ventas", "admin"]))):
    m = MaterialModel(
        nombre=payload.nombre,
        precio_m2=payload.precio_m2,
        espesor_mm=payload.espesor_mm,
        color=payload.color,
        ancho_m=payload.ancho_m,
        largo_m=payload.largo_m,
        stock_actual=float(payload.stock_actual or 0.0),
        unidad=payload.unidad or "m²",
        stock_minimo=float(payload.stock_minimo or 0.0),
        ultima_actualizacion=None,
    )
    # Set mayorista si el modelo lo soporta
    try:
        if hasattr(m, "precio_mayor_m2") and payload.precio_mayor_m2 is not None:
            m.precio_mayor_m2 = float(payload.precio_mayor_m2 or 0.0)
    except Exception:
        pass
    db.add(m)
    db.commit()
    return {"id": m.id, "nombre": m.nombre, "precio_m2": m.precio_m2, "espesor_mm": m.espesor_mm, "color": m.color, "ancho_m": m.ancho_m, "largo_m": m.largo_m, "stock_actual": m.stock_actual, "unidad": m.unidad, "stock_minimo": m.stock_minimo, "ultima_actualizacion": m.ultima_actualizacion, "disponible_para_venta": m.disponible_para_venta}

@router.get("/api/materiales")
def listar_materiales(solo_disponibles: bool = False, db: Session = Depends(get_db)):
    if solo_disponibles:
        # Solo materiales activos que tienen al menos una placa o retazo disponible
        from ...models import Placa as PlacaModel, Retazo as RetazoModel
        
        # Subquery para materiales con placas disponibles
        placas_mats = db.query(PlacaModel.material_id).filter(PlacaModel.estado == "disponible").distinct().all()
        # Subquery para materiales con retazos disponibles
        retazos_mats = db.query(RetazoModel.material_id).filter(RetazoModel.estado == "disponible").distinct().all()
        
        mats_ids = set([m[0] for m in placas_mats] + [m[0] for m in retazos_mats])
        rows = db.query(MaterialModel).filter(MaterialModel.id.in_(mats_ids), MaterialModel.activo == True).all()
    else:
        # Mostrar solo materiales activos
        rows = db.query(MaterialModel).filter(MaterialModel.activo == True).all()
        
    return [{"id": r.id, "nombre": r.nombre, "precio_m2": r.precio_m2, "precio_mayor_m2": getattr(r, "precio_mayor_m2", None), "espesor_mm": r.espesor_mm, "color": r.color, "ancho_m": r.ancho_m, "largo_m": r.largo_m, "stock_actual": r.stock_actual, "unidad": r.unidad, "stock_minimo": r.stock_minimo, "ultima_actualizacion": r.ultima_actualizacion, "disponible_para_venta": r.disponible_para_venta, "activo": r.activo} for r in rows]

@router.patch("/api/materiales/{materialId}")
def actualizar_material(materialId: str, nombre: str | None = None, precio_m2: float | None = None, precio_mayor_m2: float | None = None, espesor_mm: int | None = None, color: str | None = None, ancho_m: float | None = None, largo_m: float | None = None, stock_actual: float | None = None, unidad: str | None = None, stock_minimo: float | None = None, ultima_actualizacion: str | None = None, disponible_para_venta: bool | None = None, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    m = db.query(MaterialModel).filter(MaterialModel.id == materialId).first()
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    updates = {"nombre": nombre, "precio_m2": precio_m2, "precio_mayor_m2": precio_mayor_m2, "espesor_mm": espesor_mm, "color": color, "ancho_m": ancho_m, "largo_m": largo_m, "stock_actual": stock_actual, "unidad": unidad, "stock_minimo": stock_minimo, "ultima_actualizacion": ultima_actualizacion, "disponible_para_venta": disponible_para_venta}
    for k, v in updates.items():
        if v is not None:
            setattr(m, k, v)
    db.commit()
    return {"id": m.id}

@router.delete("/api/materiales/{materialId}")
def eliminar_material(materialId: str, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    m = db.query(MaterialModel).filter(MaterialModel.id == materialId).first()
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    
    # Soft delete: marcar como inactivo en lugar de eliminar
    m.activo = False
    db.add(m)
    db.commit()
    return {"status": "archived", "id": materialId, "message": "Material archivado correctamente"}

@router.post("/api/egresos")
def registrar_egreso(payload: CompraProveedor, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    mat = db.query(MaterialModel).filter(MaterialModel.nombre == payload.material).first()
    if not mat:
        return {"error": "material_no_encontrado", "material": payload.material}
    mv = MovModel(tipo="compra", proveedor=payload.proveedor, material_id=mat.id, cantidad=int(payload.cantidad), monto=float(payload.monto), fecha=payload.fecha or None, estado="activo", retazo_id=None)
    db.add(mv)
    db.commit()
    return {"id": mv.id, "tipo": mv.tipo}

@router.get("/api/egresos")
def listar_egresos(db: Session = Depends(get_db)):
    rows = db.query(MovModel).filter(MovModel.tipo == "compra").all()
    out = []
    for r in rows:
        m = db.query(MaterialModel).filter(MaterialModel.id == r.material_id).first()
        out.append({
            "id": r.id,
            "proveedor": r.proveedor,
            "material_id": r.material_id,
            "material_nombre": m.nombre if m else None,
            "cantidad": r.cantidad,
            "monto": r.monto,
            "fecha": r.fecha,
        })
    return out

@router.post("/api/compras")
def registrar_compra(payload: CompraProveedor, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    from sqlalchemy import func
    import math
    
    mat = db.query(MaterialModel).filter(func.lower(MaterialModel.nombre) == func.lower(payload.material)).first()
    if not mat:
        mat = MaterialModel(
            nombre=payload.material, 
            precio_m2=float(payload.precio_m2 or 0.0),
            precio_mayor_m2=float(payload.precio_mayor_m2 or 0.0) if payload.precio_mayor_m2 is not None else None,
            ancho_m=payload.ancho_m,
            largo_m=payload.largo_m
        )
        db.add(mat)
        db.flush()
    else:
        # No actualizamos dimensiones del material para mantenerlas "estándar" (0/genéricas)
        # Las dimensiones específicas se guardarán en el lote
        pass
        
    # Obtener o crear proveedor para el lote
    prov_obj = db.query(ProveedorModel).filter(ProveedorModel.nombre == payload.proveedor).first()
    
    # Si no existe el proveedor, lo creamos
    if not prov_obj and payload.proveedor:
        prov_obj = ProveedorModel(nombre=payload.proveedor)
        db.add(prov_obj)
        db.flush()
    
    prov_id = prov_obj.id if prov_obj else None

    # Crear el nuevo lote
    # Calculamos el área de una placa individual (usando dimensiones de la compra)
    try:
        a = float(payload.ancho_m or mat.ancho_m or 0.0)
        l = float(payload.largo_m or mat.largo_m or 0.0)
        area_m2_individual = a * l if a > 0 and l > 0 else 1.0
    except Exception:
        area_m2_individual = 1.0
    
    # payload.cantidad es la cantidad de placas compradas
    # Usamos math.ceil() para redondear hacia arriba y asegurar número entero
    cantidad_placas = int(math.ceil(float(payload.cantidad or 1.0)))
    
    # El stock en m² es igual a la cantidad de placas × área de cada placa
    stock_lote_m2 = round(float(cantidad_placas) * area_m2_individual, 3)
    
    # Buscar lote existente con mismo material, código, ancho y largo
    codigo_busqueda = payload.lote or f"L-{datetime.now().strftime('%Y%m%d%H%M')}"
    ancho_busqueda = float(payload.ancho_m) if payload.ancho_m else mat.ancho_m
    largo_busqueda = float(payload.largo_m) if payload.largo_m else mat.largo_m

    lote_existente = db.query(LoteModel).filter(
        LoteModel.material_id == mat.id,
        LoteModel.codigo_lote == codigo_busqueda,
        LoteModel.ancho_m == ancho_busqueda,
        LoteModel.largo_m == largo_busqueda
    ).first()

    costo_m2_compra = None
    try:
        if payload.costo_m2 is not None and payload.costo_m2 > 0:
            costo_m2_compra = float(payload.costo_m2)
        elif payload.monto and payload.cantidad:
            costo_m2_compra = float(payload.monto) / (float(cantidad_placas) * area_m2_individual)
    except Exception:
        costo_m2_compra = None

    if lote_existente:
        # Si existe, sumamos la cantidad de placas y recalculamos el stock en m²
        lote_existente.cantidad = int(lote_existente.cantidad or 0) + int(cantidad_placas)
        lote_existente.stock_actual = round(float(lote_existente.cantidad) * area_m2_individual, 3)
        lote_existente.fecha_ingreso = payload.fecha or lote_existente.fecha_ingreso
        if costo_m2_compra is not None:
            lote_existente.costo_m2 = round(float(costo_m2_compra), 2)
        db.add(lote_existente)
        lote_retorno = lote_existente
    else:
        # Si no existe, creamos uno nuevo
        nuevo_lote = LoteModel(
            material_id=mat.id,
            codigo_lote=codigo_busqueda,
            proveedor_id=prov_id,
            fecha_ingreso=payload.fecha or datetime.now().strftime("%Y-%m-%d"),
            cantidad_inicial=stock_lote_m2,
            stock_actual=stock_lote_m2,
            cantidad=int(cantidad_placas),
            costo_m2=round(float(costo_m2_compra or 0.0), 2),
            ancho_m=ancho_busqueda,
            largo_m=largo_busqueda,
            ubicacion=payload.ubicacion or None,
            notas=f"Compra registrada el {datetime.now().strftime('%Y-%m-%d')}"
        )
        db.add(nuevo_lote)
        lote_retorno = nuevo_lote
    
    db.flush() # Para obtener el ID si es nuevo

    # Crear registro de compra con asociación al lote
    # IMPORTANTE: Guardar cantidad_placas (la cantidad calculada), no payload.cantidad
    # Esto asegura consistencia entre el lote y el registro de compra
    c = CompraModel(
        proveedor=payload.proveedor, 
        material_id=mat.id, 
        cantidad=float(cantidad_placas),  # Usar cantidad_placas calculada, no payload.cantidad
        monto=float(payload.monto), 
        fecha=payload.fecha or None,
        lote_id=lote_retorno.id,
        precio_m2=float(payload.precio_m2) if payload.precio_m2 is not None else None,
        precio_mayor_m2=float(payload.precio_mayor_m2) if payload.precio_mayor_m2 is not None else None,
        costo_m2=round(float(costo_m2_compra), 2) if costo_m2_compra is not None else None
    )
    db.add(c)
    
    # Actualizar stock del material sumando todos sus lotes
    total_stock_lotes = db.query(func.sum(LoteModel.stock_actual)).filter(LoteModel.material_id == mat.id).scalar() or 0.0
    mat.stock_actual = round(float(total_stock_lotes), 3)
    
    # Actualizar metadatos del material
    mat.ultima_actualizacion = payload.fecha or None
    if payload.precio_m2 is not None and payload.precio_m2 > 0:
        mat.precio_m2 = round(float(payload.precio_m2), 2)
    if payload.precio_mayor_m2 is not None and payload.precio_mayor_m2 > 0:
        mat.precio_mayor_m2 = round(float(payload.precio_mayor_m2), 2)
    
    db.add(mat)
    db.commit()
    return {"id": c.id, "lote_id": lote_retorno.id}

@router.get("/api/compras")
def listar_compras(db: Session = Depends(get_db)):
    rows = db.query(CompraModel).all()
    out = []
    for r in rows:
        m = db.query(MaterialModel).filter(MaterialModel.id == r.material_id).first()
        l = db.query(LoteModel).filter(LoteModel.id == r.lote_id).first() if r.lote_id else None
        
        # Separar claramente: precio_venta_menor, precio_venta_mayor y costo_m2
        # - costo_m2: costo por m² de compra (lote.costo_m2 si existe; fallback a monto/cantidad/área)
        # - precio_m2: precio de venta por menor m² (material.precio_m2 si está set; fallback al costo)
        # - precio_mayor_m2: precio de venta por mayor m² (material.precio_mayor_m2 si existe; fallback null)
        costo_m2 = 0.0
        try:
            if getattr(r, "costo_m2", None) is not None:
                costo_m2 = round(float(getattr(r, "costo_m2", 0.0) or 0.0), 2)
            elif l and getattr(l, "costo_m2", None) is not None:
                costo_m2 = round(float(getattr(l, "costo_m2", 0.0) or 0.0), 2)
            elif r.cantidad and r.cantidad > 0:
                a = float((l.ancho_m if l else None) or (m.ancho_m if m else 0.0) or 0.0)
                l_m = float((l.largo_m if l else None) or (m.largo_m if m else 0.0) or 0.0)
                area_m2 = a * l_m if a > 0 and l_m > 0 else 1.0
                if r.monto and r.monto > 0:
                    costo_m2 = round(float(r.monto) / (float(r.cantidad) * area_m2), 2)
        except Exception:
            costo_m2 = 0.0

        precio_venta_menor = None
        try:
            precio_venta_menor = getattr(r, "precio_m2", None)
            if precio_venta_menor is None:
                precio_venta_menor = (getattr(m, "precio_m2", None) if m else None)
            if precio_venta_menor is None:
                precio_venta_menor = costo_m2
            precio_venta_menor = round(float(precio_venta_menor or 0.0), 2)
        except Exception:
            precio_venta_menor = costo_m2

        precio_venta_mayor = None
        try:
            precio_venta_mayor = getattr(r, "precio_mayor_m2", None)
            if precio_venta_mayor is None and m and getattr(m, "precio_mayor_m2", None) is not None:
                precio_venta_mayor = round(float(getattr(m, "precio_mayor_m2", 0.0) or 0.0), 2)
        except Exception:
            precio_venta_mayor = None
        
        out.append({
            "id": r.id,
            "proveedor": r.proveedor,
            "material_id": r.material_id,
            "material": m.nombre if m else None,
            "material_nombre": m.nombre if m else None,
            "cantidad": r.cantidad,
            "monto": r.monto,
            "fecha": r.fecha,
            "precio_m2": precio_venta_menor,
            "precio_mayor_m2": precio_venta_mayor,
            "costo_m2": costo_m2,
            "lote": l.codigo_lote if l else None
        })
    return out

@router.post("/api/proveedores")
def crear_proveedor(payload: ProveedorCreate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    p = ProveedorModel(nombre=payload.nombre, contacto=payload.contacto, telefono=payload.telefono, email=payload.email, direccion=payload.direccion)
    db.add(p)
    db.commit()
    return {"id": p.id, "nombre": p.nombre, "contacto": p.contacto}

@router.get("/api/proveedores")
def listar_proveedores(db: Session = Depends(get_db)):
    rows = db.query(ProveedorModel).all()
    return [{"id": r.id, "nombre": r.nombre, "contacto": r.contacto, "telefono": r.telefono, "email": r.email, "direccion": r.direccion} for r in rows]

@router.put("/api/proveedores/{proveedorId}")
def actualizar_proveedor(proveedorId: str, payload: ProveedorUpdate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    p = db.query(ProveedorModel).filter(ProveedorModel.id == proveedorId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    data = payload.dict(exclude_none=True)
    for k, v in data.items():
        if hasattr(p, k):
            setattr(p, k, v)
    db.commit()
    return {"id": p.id}

@router.post("/api/proveedores/{proveedorId}/delete")
def eliminar_proveedor(proveedorId: str, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    p = db.query(ProveedorModel).filter(ProveedorModel.id == proveedorId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    db.delete(p)
    db.commit()
    return {"status": "deleted", "id": proveedorId}

@router.delete("/api/proveedores/{proveedorId}")
def eliminar_proveedor_delete(proveedorId: str, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    p = db.query(ProveedorModel).filter(ProveedorModel.id == proveedorId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    db.delete(p)
    db.commit()
    return {"status": "deleted", "id": proveedorId}

@router.post("/api/placas")
def crear_placa(material_id: str, ancho: int, largo: int, precio: float | None = None, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    p = PlacaModel(material_id=material_id, ancho=ancho, largo=largo, precio=precio, estado="disponible")
    db.add(p)
    db.commit()
    return {"id": p.id, "material_id": p.material_id, "ancho": p.ancho, "largo": p.largo, "estado": p.estado, "precio": p.precio}

@router.get("/api/placas")
def listar_placas(material_id: str | None = None, estado: str | None = None, reservado_por: str | None = None, db: Session = Depends(get_db)):
    q = db.query(PlacaModel)
    if material_id:
        q = q.filter(PlacaModel.material_id == material_id)
    if estado:
        q = q.filter(PlacaModel.estado == estado)
    if reservado_por:
        q = q.filter(PlacaModel.reservado_por == reservado_por)
    rows = q.all()
    if not rows:
        return []
    mat_ids = list({r.material_id for r in rows})
    lote_ids = list({r.lote_id for r in rows if r.lote_id})
    mats = {m.id: m.nombre for m in db.query(MaterialModel).filter(MaterialModel.id.in_(mat_ids)).all()}
    lotes: dict[str, str] = {}
    if lote_ids:
        lotes = {l.id: l.codigo_lote for l in db.query(LoteModel).filter(LoteModel.id.in_(lote_ids)).all()}
    out: list[dict] = []
    for r in rows:
        lid = r.lote_id
        m2 = (float(r.largo) * float(r.ancho)) / 1_000_000.0 if r.largo and r.ancho else 0.0
        out.append({
            "id": r.id,
            "material_id": r.material_id,
            "material_nombre": mats.get(r.material_id) or "—",
            "ancho": r.ancho,
            "largo": r.largo,
            "espesor": r.espesor,
            "estado": r.estado,
            "precio": r.precio,
            "codigo": r.codigo,
            "ubicacion": r.ubicacion,
            "lote_id": r.lote_id,
            "lote_codigo": lotes.get(lid) if lid else None,
            "plano_tecnico_id": r.plano_tecnico_id,
            "reservado_por": r.reservado_por,
            "reservado_hasta": r.reservado_hasta,
            "m2": round(m2, 4),
        })
    return out

@router.patch("/api/placas/{placaId}")
def actualizar_placa(placaId: str, payload: dict | None = None, estado: str | None = None, reservado_por: str | None = None, reservado_hasta: str | None = None, precio: float | None = None, codigo: str | None = None, plano_tecnico_id: str | None = None, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    p = db.query(PlacaModel).filter(PlacaModel.id == placaId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    
    # Support both explicit args and payload dict (for compatibility/extensibility)
    data = payload or {}
    
    # Merge args into data if provided
    if estado is not None: data['estado'] = estado
    if reservado_por is not None: data['reservado_por'] = reservado_por
    if reservado_hasta is not None: data['reservado_hasta'] = reservado_hasta
    if precio is not None: data['precio'] = precio
    if codigo is not None: data['codigo'] = codigo
    if plano_tecnico_id is not None: data['plano_tecnico_id'] = plano_tecnico_id

    for k, v in data.items():
        if hasattr(p, k):
            setattr(p, k, v)
            
    db.commit()
    return {"id": p.id}

@router.post("/api/inventario/retazos")
def crear_retazo(payload: RetazoCreate, db: Session = Depends(get_db)):
    r = RetazoModel(
        material_id=payload.material_id, 
        ancho=payload.ancho, 
        largo=payload.largo, 
        espesor=payload.espesor,
        lote_id=payload.lote_id,
        ubicacion=payload.ubicacion,
        estado="disponible", 
        en_venta=False, 
        precio=payload.precio
    )
    db.add(r)
    db.commit()
    return {"id": r.id}

@router.get("/api/inventario/retazos")
def listar_retazos(material_id: str | None = None, lote_id: str | None = None, estado: str | None = None, db: Session = Depends(get_db)):
    from sqlalchemy import text
    
    # Construir query base
    sql_query = """
    SELECT r.id, r.material_id, r.lote_id, r.ancho, r.largo, r.estado, r.en_venta, r.precio, l.codigo_lote
    FROM retazos r
    LEFT JOIN lotes l ON r.lote_id = l.id
    WHERE 1=1
    """
    params = {}
    
    if material_id:
        sql_query += " AND r.material_id = :material_id"
        params["material_id"] = material_id
    
    if lote_id:
        sql_query += " AND r.lote_id = :lote_id"
        params["lote_id"] = lote_id
        
    if estado:
        sql_query += " AND r.estado = :estado"
        params["estado"] = estado
        
    rows = db.execute(text(sql_query), params).mappings().all()
    
    return [
        {
            "id": r.id, 
            "material_id": r.material_id, 
            "lote_id": r.lote_id,
            "lote_codigo": r.codigo_lote,
            "ancho": r.ancho, 
            "largo": r.largo, 
            "espesor": None, # La columna no existe en DB
            "ubicacion": None, # La columna no existe en DB
            "estado": r.estado, 
            "en_venta": r.en_venta, 
            "precio": r.precio
        } for r in rows
    ]

@router.get("/api/inventario/retazos/sugerencias")
def sugerencias_retazos(material_id: str, w: int, h: int, lote_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(RetazoModel).filter(RetazoModel.material_id == material_id, RetazoModel.estado == "disponible")
    if lote_id:
        q = q.filter(RetazoModel.lote_id == lote_id)
    
    rows = q.all()
    out = []
    for r in rows:
        fits = (int(r.ancho) >= int(w) and int(r.largo) >= int(h)) or (int(r.ancho) >= int(h) and int(r.largo) >= int(w))
        if fits:
            out.append({
                "id": r.id, 
                "material_id": r.material_id, 
                "lote_id": r.lote_id,
                "ancho": r.ancho, 
                "largo": r.largo,
                "espesor": r.espesor,
                "ubicacion": r.ubicacion
            })
    out.sort(key=lambda x: x["ancho"] * x["largo"])
    return out

@router.get("/api/materiales/tipos")
def tipos_materiales(db: Session = Depends(get_db)):
    rows = db.query(MaterialModel).all()
    tipos = sorted({r.nombre for r in rows})
    return [{"tipo": t} for t in tipos]

@router.put("/api/inventario/retazos/{retazoId}")
def actualizar_retazo(retazoId: str, payload: RetazoUpdate, db: Session = Depends(get_db)):
    r = db.query(RetazoModel).filter(RetazoModel.id == retazoId).first()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    data = payload.dict(exclude_none=True)
    for k, v in data.items():
        if hasattr(r, k):
            setattr(r, k, v)
    db.commit()
    return {"id": r.id}

@router.delete("/api/inventario/retazos/{retazoId}")
def eliminar_retazo(retazoId: str, db: Session = Depends(get_db)):
    r = db.query(RetazoModel).filter(RetazoModel.id == retazoId).first()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Retazo no encontrado")
    db.delete(r)
    db.commit()
    return {"ok": True, "id": retazoId}

@router.post("/api/inventario/retazos/{retazoId}/vender")
def vender_retazo(retazoId: str, payload: VentaRetazo, db: Session = Depends(get_db)):
    r = db.query(RetazoModel).filter(RetazoModel.id == retazoId).first()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    r.estado = "vendido"
    r.en_venta = True
    r.precio = payload.precio
    # registrar movimiento de venta
    from ...models import MovimientoInventario as MovModel
    meta = f"{payload.cliente or ''}|{payload.telefono or ''}|{payload.forma_pago or ''}"
    mv = MovModel(
        tipo="venta_retazo",
        proveedor=meta,
        material_id=r.material_id,
        cantidad=1,
        monto=float(payload.precio or 0.0),
        fecha=None,
        estado="activo",
        retazo_id=retazoId,
    )
    db.add(mv)
    from ...models import MovimientoInventario as MovModel
    rows = db.query(MovModel).filter(MovModel.retazo_id == retazoId, MovModel.tipo == "orden_retazo").all()
    for mv in rows:
        mv.estado = "desactivado"
        db.add(mv)
    db.commit()
    return {"id": r.id, "estado": r.estado}

@router.get("/api/inventario/retazos/ventas")
def listar_ventas_retazos(db: Session = Depends(get_db)):
    from ...models import MovimientoInventario as MovModel
    rows = db.query(MovModel).filter(MovModel.tipo == "venta_retazo").all()
    out = []
    from ...models import Retazo as RetazoModel, Material as MaterialModel
    for mv in rows:
        ret = db.query(RetazoModel).filter(RetazoModel.id == mv.retazo_id).first()
        mat = db.query(MaterialModel).filter(MaterialModel.id == (ret.material_id if ret else mv.material_id)).first()
        cliente, telefono, forma_pago = (mv.proveedor or "||").split("|", 2)
        out.append({
            "id": mv.id,
            "retazo_id": mv.retazo_id,
            "cliente": cliente,
            "telefono": telefono,
            "forma_pago": forma_pago,
            "material_id": mv.material_id,
            "material_nombre": mat.nombre if mat else None,
            "precio": mv.monto,
            "fecha": mv.fecha,
            "estado": mv.estado,
        })
    return out

@router.post("/api/lotes")
def crear_lote(payload: LoteCreate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    l = LoteModel(
        material_id=payload.material_id,
        codigo_lote=payload.codigo_lote,
        proveedor_id=payload.proveedor_id,
        fecha_ingreso=payload.fecha_ingreso,
        imagen_url=payload.imagen_url,
        cantidad_inicial=payload.cantidad_inicial,
        stock_actual=payload.stock_actual,
        ubicacion=payload.ubicacion,
        notas=payload.notas
    )
    db.add(l)
    db.commit()
    return {"id": l.id, "codigo_lote": l.codigo_lote}

@router.get("/api/lotes")
def listar_lotes(material_id: str | None = None, material_nombre: str | None = None, db: Session = Depends(get_db)):
    q = db.query(LoteModel)
    if material_id:
        q = q.filter(LoteModel.material_id == material_id)
    elif material_nombre:
        from ...models import Material as MaterialModel
        from sqlalchemy import func
        mat = db.query(MaterialModel).filter(func.lower(MaterialModel.nombre) == func.lower(material_nombre)).first()
        if mat:
            q = q.filter(LoteModel.material_id == mat.id)
        else:
            return []
            
    rows = q.all()
    out = []
    for r in rows:
        prov = None
        if r.proveedor_id:
            prov_obj = db.query(ProveedorModel).filter(ProveedorModel.id == r.proveedor_id).first()
            prov = prov_obj.nombre if prov_obj else None
        
        out.append({
            "id": r.id,
            "material_id": r.material_id,
            "codigo_lote": r.codigo_lote,
            "proveedor_id": r.proveedor_id,
            "proveedor_nombre": prov,
            "fecha_ingreso": r.fecha_ingreso,
            "imagen_url": r.imagen_url,
            "cantidad_inicial": r.cantidad_inicial,
            "stock_actual": r.stock_actual,
            "cantidad": r.cantidad,
            "ancho_m": r.ancho_m,
            "largo_m": r.largo_m,
            "costo_m2": r.costo_m2,
            "precio_venta": r.precio_venta if hasattr(r, 'precio_venta') else 0,
            "precio_mayorista": r.precio_mayorista if hasattr(r, 'precio_mayorista') else 0,
            "ubicacion": r.ubicacion,
            "notas": r.notas
        })
    return out

@router.get("/api/lotes/{loteId}")
def obtener_lote(loteId: str, db: Session = Depends(get_db)):
    lote = db.query(LoteModel).filter(LoteModel.id == loteId).first()
    if not lote:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    prov = None
    if lote.proveedor_id:
        prov_obj = db.query(ProveedorModel).filter(ProveedorModel.id == lote.proveedor_id).first()
        prov = prov_obj.nombre if prov_obj else None
    
    return {
        "id": lote.id,
        "material_id": lote.material_id,
        "codigo_lote": lote.codigo_lote,
        "proveedor_id": lote.proveedor_id,
        "proveedor_nombre": prov,
        "fecha_ingreso": lote.fecha_ingreso,
        "imagen_url": lote.imagen_url,
        "cantidad_inicial": lote.cantidad_inicial,
        "stock_actual": lote.stock_actual,
        "cantidad": lote.cantidad,
        "ancho_m": lote.ancho_m,
        "largo_m": lote.largo_m,
        "costo_m2": lote.costo_m2,
        "precio_venta": lote.precio_venta if hasattr(lote, 'precio_venta') else 0,
        "precio_mayorista": lote.precio_mayorista if hasattr(lote, 'precio_mayorista') else 0,
        "ubicacion": lote.ubicacion,
        "notas": lote.notas
    }

@router.delete("/api/lotes/{loteId}")
def eliminar_lote(loteId: str, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    lote = db.query(LoteModel).filter(LoteModel.id == loteId).first()
    if not lote:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    placas = db.query(PlacaModel).filter(PlacaModel.lote_id == loteId).count()
    retazos = db.query(RetazoModel).filter(RetazoModel.lote_id == loteId).count()
    compras = db.query(CompraModel).filter(CompraModel.lote_id == loteId).count()
    if placas > 0 or retazos > 0 or compras > 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Lote con relaciones, no puede ser eliminado")
    db.delete(lote)
    db.commit()
    return {"status": "deleted", "id": loteId}


@router.patch("/api/lotes/{loteId}")
def actualizar_lote(loteId: str, payload: LoteUpdate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin", "ventas"]))):
    lote = db.query(LoteModel).filter(LoteModel.id == loteId).first()
    if not lote:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    # Get the data from payload
    data = payload.dict(exclude_none=True)
    
    # Si se actualiza la cantidad, recalcular stock_actual
    if 'cantidad' in data and data['cantidad'] is not None:
        nueva_cantidad = int(data['cantidad'])
        # Calcular área m² per unit (ancho × largo)
        try:
            ancho = float(lote.ancho_m or 1.0)
            largo = float(lote.largo_m or 1.0)
            area_m2_per_unit = ancho * largo if ancho > 0 and largo > 0 else 1.0
        except Exception:
            area_m2_per_unit = 1.0
        
        # Recalcular stock_actual = area_per_unit × cantidad
        nuevo_stock = area_m2_per_unit * nueva_cantidad
        lote.stock_actual = round(nuevo_stock, 3)
    
    # Update lote with provided fields
    for k, v in data.items():
        if k != 'cantidad' and hasattr(lote, k) and k not in ['id', 'material_id']:
            setattr(lote, k, v)
        elif k == 'cantidad':
            setattr(lote, k, v)
    
    db.commit()
    
    # Return updated data
    return {
        "id": lote.id, 
        "ubicacion": lote.ubicacion, 
        "costo_m2": lote.costo_m2, 
        "cantidad": lote.cantidad, 
        "stock_actual": lote.stock_actual, 
        "precio_venta": getattr(lote, 'precio_venta', 0.0),
        "precio_mayorista": getattr(lote, 'precio_mayorista', 0.0)
    }


@router.get("/api/inventario/stock-detallado")
def listar_stock_detallado(material_id: str = None, db: Session = Depends(get_db)):
    from datetime import datetime
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    
    # Obtener placas disponibles y no reservadas
    q_placas = db.query(PlacaModel).filter(PlacaModel.estado == "disponible")
    q_placas = q_placas.filter(
        (PlacaModel.reservado_hasta == None) | (PlacaModel.reservado_hasta < now)
    )
    if material_id:
        q_placas = q_placas.filter(PlacaModel.material_id == material_id)
    placas = q_placas.all()
    
    # Obtener retazos disponibles y no reservados
    q_retazos = db.query(RetazoModel).filter(RetazoModel.estado == "disponible")
    q_retazos = q_retazos.filter(
        (RetazoModel.reservado_hasta == None) | (RetazoModel.reservado_hasta < now)
    )
    if material_id:
        q_retazos = q_retazos.filter(RetazoModel.material_id == material_id)
    retazos = q_retazos.all()
    
    # Mapear materiales para nombres
    materiales_map = {m.id: m.nombre for m in db.query(MaterialModel).all()}
    # Mapear lotes para códigos y datos completos
    lotes_map = {l.id: l for l in db.query(LoteModel).all()}
    
    result = []
    # lotes_incluidos = set()  # Para rastrear qué lotes ya están representados
    
    for p in placas:
        result.append({
            "id": p.id,
            "tipo_material": materiales_map.get(p.material_id, "Desconocido"),
            "material_id": p.material_id,
            "lote_id": p.lote_id,
            "codigo_lote": lotes_map.get(p.lote_id).codigo_lote if p.lote_id and p.lote_id in lotes_map else "S/L",
            "ancho": p.ancho,
            "largo": p.largo,
            "espesor": p.espesor,
            "ubicacion": p.ubicacion,
            "tipo": "plancha",
            "precio": p.precio
        })
        # if p.lote_id:
        #     lotes_incluidos.add(p.lote_id)
        
    for r in retazos:
        result.append({
            "id": r.id,
            "tipo_material": materiales_map.get(r.material_id, "Desconocido"),
            "material_id": r.material_id,
            "lote_id": r.lote_id,
            "codigo_lote": lotes_map.get(r.lote_id).codigo_lote if r.lote_id and r.lote_id in lotes_map else "S/L",
            "ancho": r.ancho,
            "largo": r.largo,
            "espesor": r.espesor,
            "ubicacion": r.ubicacion,
            "tipo": "retazo",
            "precio": r.precio
        })
        # if r.lote_id:
        #     lotes_incluidos.add(r.lote_id)
    
    # Agregar lotes con stock que no están representados en placas/retazos
    q_lotes = db.query(LoteModel).filter(LoteModel.stock_actual > 0)
    if material_id:
        q_lotes = q_lotes.filter(LoteModel.material_id == material_id)
    lotes_con_stock = q_lotes.all()
    
    for lote in lotes_con_stock:
        # if lote.id not in lotes_incluidos:
            # Este lote tiene stock pero no placas/retazos individuales
            # Crear una entrada "virtual" representando el lote completo
            mat = db.query(MaterialModel).filter(MaterialModel.id == lote.material_id).first()
            
            # Usar medidas del lote si existen, si no usar medidas del material
            ancho = int(lote.ancho_m * 100) if lote.ancho_m else (int(mat.ancho_m * 100) if mat and mat.ancho_m else 300)
            largo = int(lote.largo_m * 100) if lote.largo_m else (int(mat.largo_m * 100) if mat and mat.largo_m else 180)
            espesor = mat.espesor_mm if mat and mat.espesor_mm else 20
            
            result.append({
                "id": lote.id,
                "tipo_material": mat.nombre if mat else "Desconocido",
                "material_id": lote.material_id,
                "lote_id": lote.id,
                "codigo_lote": lote.codigo_lote,
                "ancho": ancho,
                "largo": largo,
                "espesor": espesor,
                "ubicacion": lote.ubicacion or "Almacén",
                "tipo": "lote",
                "precio": lote.costo_m2 if hasattr(lote, 'costo_m2') else 0,
                "precio_venta": lote.precio_venta if hasattr(lote, 'precio_venta') else 0,
                "precio_mayorista": lote.precio_mayorista if hasattr(lote, 'precio_mayorista') else 0
            })
        
    return result


@router.get("/api/inventario/dashboard/stock")
def dashboard_stock_resumen(db: Session = Depends(get_db)):
    """KPIs de stock: placas y retazos disponibles, no reservados y no vendidos (estado ≠ vendido)."""
    from collections import defaultdict
    from datetime import datetime

    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

    def _ubicacion_label(raw: str | None) -> str:
        s = (raw or "").strip()
        return s if s else "Sin ubicación"

    mats = {m.id: m for m in db.query(MaterialModel).all()}

    q_placas = db.query(PlacaModel).filter(PlacaModel.estado == "disponible").filter(
        (PlacaModel.reservado_hasta == None) | (PlacaModel.reservado_hasta < now)
    )
    placas = q_placas.all()

    q_retazos = db.query(RetazoModel).filter(RetazoModel.estado == "disponible").filter(
        (RetazoModel.reservado_hasta == None) | (RetazoModel.reservado_hasta < now)
    )
    retazos = q_retazos.all()

    by_u: dict[str, dict[str, float | int]] = defaultdict(
        lambda: {"m2": 0.0, "valor": 0.0, "piezas_placa": 0, "piezas_retazo": 0}
    )
    by_m: dict[str, dict[str, float]] = defaultdict(lambda: {"m2": 0.0, "valor": 0.0})

    m2_placas = 0.0
    m2_retazos = 0.0

    for p in placas:
        area_m2 = (float(p.ancho) * float(p.largo)) / 1_000_000.0
        mat = mats.get(p.material_id)
        precio_m2 = float(mat.precio_m2 or 0.0) if mat else 0.0
        val = area_m2 * precio_m2
        u = _ubicacion_label(p.ubicacion)
        urow = by_u[u]
        urow["m2"] = float(urow["m2"]) + area_m2
        urow["valor"] = float(urow["valor"]) + val
        urow["piezas_placa"] = int(urow["piezas_placa"]) + 1
        mid = p.material_id
        by_m[mid]["m2"] = by_m[mid]["m2"] + area_m2
        by_m[mid]["valor"] = by_m[mid]["valor"] + val
        m2_placas += area_m2

    for r in retazos:
        area_m2 = (float(r.ancho) * float(r.largo)) / 1_000_000.0
        mat = mats.get(r.material_id)
        precio_m2 = float(mat.precio_m2 or 0.0) if mat else 0.0
        val = area_m2 * precio_m2
        u = _ubicacion_label(r.ubicacion)
        urow = by_u[u]
        urow["m2"] = float(urow["m2"]) + area_m2
        urow["valor"] = float(urow["valor"]) + val
        urow["piezas_retazo"] = int(urow["piezas_retazo"]) + 1
        mid = r.material_id
        by_m[mid]["m2"] = by_m[mid]["m2"] + area_m2
        by_m[mid]["valor"] = by_m[mid]["valor"] + val
        m2_retazos += area_m2

    por_ubicacion = [
        {
            "ubicacion": k,
            "m2": round(float(v["m2"]), 3),
            "valor_estimado": round(float(v["valor"]), 2),
            "piezas_placa": int(v["piezas_placa"]),
            "piezas_retazo": int(v["piezas_retazo"]),
            "piezas_total": int(v["piezas_placa"]) + int(v["piezas_retazo"]),
        }
        for k, v in sorted(by_u.items(), key=lambda x: -float(x[1]["m2"]))
    ]

    por_material: list[dict[str, str | float]] = []
    for mid, v in by_m.items():
        mat = mats.get(mid)
        por_material.append({
            "material_id": mid,
            "nombre": mat.nombre if mat else "Desconocido",
            "m2": round(v["m2"], 3),
            "valor_estimado": round(v["valor"], 2),
        })
    por_material.sort(key=lambda x: -float(x["m2"]))

    valor_total = sum(float(v["valor"]) for v in by_u.values())

    return {
        "valoracion": "m2 × precio_m2 del material (lista)",
        "filtro_piezas": "estado=disponible; excluye reservas vigentes (retazos/placas no vendidos)",
        "totales": {
            "piezas_placa": len(placas),
            "piezas_retazo": len(retazos),
            "m2_placas": round(m2_placas, 3),
            "m2_retazos": round(m2_retazos, 3),
            "m2_total": round(m2_placas + m2_retazos, 3),
            "valor_estimado_total": round(valor_total, 2),
        },
        "por_ubicacion": por_ubicacion,
        "por_material": por_material,
    }


@router.post("/api/inventario/placas")
def crear_placa(payload: PlacaCreate, db: Session = Depends(get_db)):
    p = PlacaModel(
        material_id=payload.material_id,
        ancho=payload.ancho,
        largo=payload.largo,
        espesor=payload.espesor,
        codigo=payload.codigo,
        lote_id=payload.lote_id,
        ubicacion=payload.ubicacion,
        estado="disponible",
        precio=payload.precio
    )
    db.add(p)
    db.commit()
    return {"id": p.id}

# --- PRODUCTOS ESTÁTICOS ---
@router.get("/api/productos-estaticos")
def listar_productos_estaticos(db: Session = Depends(get_db)):
    from ...models import ProductoEstatico
    rows = db.query(ProductoEstatico).filter(ProductoEstatico.activo == True).all()
    return [{"id": r.id, "nombre": r.nombre, "descripcion": r.descripcion, "precio_venta": r.precio_venta, "categoria": r.categoria, "activo": r.activo} for r in rows]

@router.post("/api/productos-estaticos")
def crear_producto_estatico(nombre: str, precio_venta: float, descripcion: str | None = None, categoria: str | None = None, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    from ...models import ProductoEstatico
    from datetime import datetime
    
    # Verificar si ya existe
    existing = db.query(ProductoEstatico).filter(ProductoEstatico.nombre == nombre).first()
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Producto ya existe")
    
    p = ProductoEstatico(
        nombre=nombre,
        descripcion=descripcion,
        precio_venta=precio_venta,
        categoria=categoria,
        activo=True,
        fecha_creacion=datetime.now().isoformat(),
        fecha_actualizacion=datetime.now().isoformat()
    )
    db.add(p)
    db.commit()
    return {"id": p.id, "nombre": p.nombre, "precio_venta": p.precio_venta}

@router.patch("/api/productos-estaticos/{productoId}")
def actualizar_producto_estatico(productoId: str, nombre: str | None = None, precio_venta: float | None = None, descripcion: str | None = None, categoria: str | None = None, activo: bool | None = None, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    from ...models import ProductoEstatico
    from datetime import datetime
    
    p = db.query(ProductoEstatico).filter(ProductoEstatico.id == productoId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    
    for k, v in {"nombre": nombre, "precio_venta": precio_venta, "descripcion": descripcion, "categoria": categoria, "activo": activo}.items():
        if v is not None:
            setattr(p, k, v)
    
    p.fecha_actualizacion = datetime.now().isoformat()
    db.commit()
    return {"id": p.id}

@router.delete("/api/productos-estaticos/{productoId}")
def eliminar_producto_estatico(productoId: str, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    from ...models import ProductoEstatico
    
    p = db.query(ProductoEstatico).filter(ProductoEstatico.id == productoId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)

    # Baja lógica para preservar histórico en presupuestos.
    p.activo = False
    db.commit()
    return {"status": "deactivated"}


# --- ARTÍCULOS (alias funcional sobre productos_estaticos) ---
@router.get("/api/articulos")
def listar_articulos(include_inactive: bool = False, categoria: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    from ...models import ProductoEstatico
    query = db.query(ProductoEstatico)
    if not include_inactive:
        query = query.filter(ProductoEstatico.activo == True)
    if categoria:
        query = query.filter(ProductoEstatico.categoria == categoria)
    if q:
        query = query.filter(ProductoEstatico.nombre.ilike(f"%{q}%"))

    rows = query.order_by(ProductoEstatico.nombre.asc()).all()
    return [{
        "id": r.id,
        "nombre": r.nombre,
        "descripcion": r.descripcion,
        "precio_unitario": r.precio_venta,
        "categoria": r.categoria,
        "activo": r.activo,
        "fecha_creacion": r.fecha_creacion,
        "fecha_actualizacion": r.fecha_actualizacion,
    } for r in rows]


@router.post("/api/articulos")
def crear_articulo(payload: ArticuloCreate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    from ...models import ProductoEstatico
    from fastapi import HTTPException

    existing = db.query(ProductoEstatico).filter(ProductoEstatico.nombre == payload.nombre).first()
    if existing:
        raise HTTPException(status_code=400, detail="Artículo ya existe")

    now = datetime.now().isoformat()
    a = ProductoEstatico(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        precio_venta=float(payload.precio_unitario),
        categoria=payload.categoria,
        activo=bool(payload.activo if payload.activo is not None else True),
        fecha_creacion=now,
        fecha_actualizacion=now,
    )
    db.add(a)
    db.commit()
    return {"id": a.id, "nombre": a.nombre, "precio_unitario": a.precio_venta, "activo": a.activo}


@router.put("/api/articulos/{articuloId}")
def actualizar_articulo(articuloId: str, payload: ArticuloUpdate, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    from ...models import ProductoEstatico
    from fastapi import HTTPException

    a = db.query(ProductoEstatico).filter(ProductoEstatico.id == articuloId).first()
    if not a:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    updates = payload.dict(exclude_unset=True)
    if "precio_unitario" in updates:
        updates["precio_venta"] = float(updates.pop("precio_unitario"))
    for k, v in updates.items():
        if hasattr(a, k):
            setattr(a, k, v)
    a.fecha_actualizacion = datetime.now().isoformat()
    db.commit()
    return {"id": a.id, "nombre": a.nombre, "precio_unitario": a.precio_venta, "activo": a.activo}


@router.delete("/api/articulos/{articuloId}")
def eliminar_articulo(articuloId: str, db: Session = Depends(get_db), user: UserModel = Depends(require_roles(["admin"]))):
    from ...models import ProductoEstatico
    from fastapi import HTTPException

    a = db.query(ProductoEstatico).filter(ProductoEstatico.id == articuloId).first()
    if not a:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")

    a.activo = False
    a.fecha_actualizacion = datetime.now().isoformat()
    db.commit()
    return {"id": a.id, "status": "deactivated"}
