from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from ..schemas import PresupuestoCreate, PresupuestoUpdate, PlanoClienteMaterialCreate, PresupuestoMetaPayload
from ...db import get_db
from ...models import Presupuesto as PresupuestoModel
from ...models import PresupuestoLinea as PresupuestoLineaModel
from ...models import PresupuestoMeta as PresupuestoMetaModel
from ...models import PlanoClienteMaterial as PlanoModel
from ...models.inventario import Material
from ...models import ProductoEstatico
from ...models.finanzas_produccion import Pago
from ...models.servicios import PrestacionServicio
from ...models.finanzas import Suscripcion, CuentaCorrienteMovimiento
from ...auth import get_current_user, require_roles
import json

router = APIRouter(dependencies=[Depends(get_current_user)])

def _linea_attr(linea, key: str, default=None):
    if isinstance(linea, dict):
        return linea.get(key, default)
    return getattr(linea, key, default)

def _expandir_lineas(lineas, items_adicionales):
    merged = list(lineas or [])
    for item in (items_adicionales or []):
        desc = str(item.get("descripcion") or item.get("nombre") or "Extra")
        precio = float(item.get("precio", 0) or 0)
        cantidad = float(item.get("cantidad", 1) or 1)
        merged.append({
            "tipo": "extra",
            "material": desc,
            "descripcion": desc,
            "metros_cuadrados": 0.0,
            "unidad": "u",
            "cantidad": cantidad,
            "precio_unitario": precio,
            "medidas": "",
            "condiciones": "",
            "cortes_especiales": False,
            "agujeros": 0,
            "recargo_extra": 0.0,
            "lote_id": None,
            "geometria_json": None,
            "planos_manual_json": None,
            "material_id": None,
            "producto_id": None,
            "accesorio_id": None,
        })
    return merged

def _linea_model_to_payload(linea: PresupuestoLineaModel):
    return {
        "tipo": getattr(linea, "tipo", "material") or "material",
        "material": linea.material,
        "material_id": getattr(linea, "material_id", None),
        "producto_id": getattr(linea, "producto_id", None),
        "accesorio_id": getattr(linea, "accesorio_id", None),
        "metros_cuadrados": float(linea.metros_cuadrados or 0),
        "unidad": getattr(linea, "unidad", "m²") or "m²",
        "cantidad": getattr(linea, "cantidad", None),
        "medidas": linea.medidas,
        "precio_unitario": float(linea.precio_unitario or 0),
        "condiciones": linea.condiciones,
        "cortes_especiales": bool(linea.cortes_especiales),
        "agujeros": int(linea.agujeros or 0),
        "recargo_extra": float(linea.recargo_extra or 0),
        "lote_id": linea.lote_id,
        "geometria_json": linea.geometria_json,
        "planos_manual_json": getattr(linea, "planos_manual_json", None),
    }

def _is_m2_unit(unidad: str | None) -> bool:
    normalized = (unidad or "m²").strip().lower().replace(" ", "")
    return normalized in ["m²", "m2", "mt2", "metro2", "metros2"]

def _linea_to_response(linea: PresupuestoLineaModel):
    return {
        "id": linea.id,
        "tipo": getattr(linea, "tipo", "material") or "material",
        "material_id": getattr(linea, "material_id", None),
        "producto_id": getattr(linea, "producto_id", None),
        "accesorio_id": getattr(linea, "accesorio_id", None),
        "material": linea.material,
        "metros_cuadrados": linea.metros_cuadrados,
        "unidad": getattr(linea, "unidad", "m²") or "m²",
        "cantidad": getattr(linea, "cantidad", None),
        "medidas": linea.medidas,
        "precio_unitario": linea.precio_unitario,
        "condiciones": linea.condiciones,
        "cortes_especiales": linea.cortes_especiales,
        "agujeros": linea.agujeros,
        "recargo_extra": linea.recargo_extra,
        "lote_id": linea.lote_id,
        "geometria_json": linea.geometria_json,
        "planos_manual_json": getattr(linea, "planos_manual_json", None),
    }

@router.post("/api/presupuestos/{id}/email")
async def enviar_presupuesto_email(id: str, email: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    import shutil
    import os
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    
    # Save PDF temporarily
    upload_dir = "app/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"presupuesto_{id}.pdf")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Send Email (Mocked if no SMTP config)
    smtp_host = os.getenv("SMTP_HOST", "localhost")
    smtp_port = int(os.getenv("SMTP_PORT", "1025"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    sender_email = os.getenv("SENDER_EMAIL", "no-reply@dimarmi.local")
    
    try:
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = email
        msg['Subject'] = f"Presupuesto Mundo di Marmi - {id}"
        
        body = "Adjunto encontrará el presupuesto solicitado y el comprobante de recepción."
        msg.attach(MIMEText(body, 'plain'))
        
        with open(file_path, "rb") as f:
            attach = MIMEApplication(f.read(), _subtype="pdf")
            attach.add_header('Content-Disposition', 'attachment', filename=f"Presupuesto_{id}.pdf")
            msg.attach(attach)
            
        if smtp_host != "localhost" or smtp_port != 1025: # Only try sending if config looks real or local dev server
             # In production this should be async or background task
             with smtplib.SMTP(smtp_host, smtp_port) as server:
                if smtp_user:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        
        return {"status": "sent", "email": email}
    except Exception as e:
        print(f"Error sending email: {e}")
        return {"status": "error", "detail": str(e)}

@router.post("/api/uploads")
async def upload_file(file: UploadFile = File(...), user = Depends(require_roles(["ventas", "admin"]))):
    import shutil
    import os
    import uuid
    
    upload_dir = "app/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    original_name = str(file.filename or "upload.bin")
    ext = original_name.split(".")[-1] if "." in original_name else "bin"
    filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"url": f"/uploads/{filename}", "filename": filename}

@router.post("/api/presupuestos")
def crear_presupuesto(payload: PresupuestoCreate, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    subtotal_materiales = 0.0
    subtotal_articulos = 0.0
    warnings: list[str] = []
    subtotal_extras = 0.0
    lineas_merged = _expandir_lineas(payload.lineas, payload.items_adicionales)
    for linea in lineas_merged:
        tipo = str(_linea_attr(linea, "tipo", "material") or "material")
        pu = float(_linea_attr(linea, "precio_unitario", 0) or 0)
        extra = float(_linea_attr(linea, "recargo_extra", 0) or 0)

        if tipo == "extra":
            qty = float(_linea_attr(linea, "cantidad", 1) or 1)
            subtotal_extras += qty * pu + extra
            continue

        if tipo == "articulo":
            qty = float(_linea_attr(linea, "cantidad", 1) or 1)
            subtotal_articulos += qty * pu + extra
            continue

        mat = None
        material_nombre = _linea_attr(linea, "material", "")
        if material_nombre:
            mat = db.query(Material).filter(Material.nombre.ilike(str(material_nombre))).first()

        unidad = _linea_attr(linea, "unidad", None) or (mat.unidad if mat and mat.unidad else "m²")
        if not _is_m2_unit(unidad):
            qty = float(_linea_attr(linea, "cantidad", _linea_attr(linea, "metros_cuadrados", 0)) or 0)
            if mat and mat.stock_actual is not None and qty > float(mat.stock_actual or 0):
                warnings.append(f"Stock insuficiente para {mat.nombre}: disponible {float(mat.stock_actual or 0)} {unidad}")
            subtotal_materiales += qty * pu + extra
        else:
            m2 = float(_linea_attr(linea, "metros_cuadrados", 0) or 0)
            subtotal_materiales += m2 * pu + extra

    total = subtotal_materiales + subtotal_articulos + subtotal_extras

    # Aplicar descuento ANTES de IVA
    descuento_aplicado = 0
    monto_antes_descuento = total
    if payload.descuento_valor and payload.descuento_valor > 0:
        if payload.descuento_tipo == 'porcentaje':
            descuento_aplicado = total * (payload.descuento_valor / 100)
            total -= descuento_aplicado
        else:  # 'fijo'
            descuento_aplicado = payload.descuento_valor
            total -= payload.descuento_valor

    subtotal_neto = max(0.0, total)
    iva_tasa = float(payload.iva_tasa if payload.iva_tasa is not None else 0.21)
    iva_monto = subtotal_neto * iva_tasa if bool(payload.con_factura) else 0.0
    total_final = subtotal_neto + iva_monto

    if total_final <= 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="El total del presupuesto debe ser mayor a 0")

    archivos_json = json.dumps(payload.archivos_adjuntos) if payload.archivos_adjuntos else "[]"
    anexos_json = json.dumps(payload.anexosImagenes) if payload.anexosImagenes else "[]"
    
    # Append payment info to observaciones if not present
    obs = payload.observaciones or ""
    pago_info = f"Pago: {payload.tipo_cobro}. Factura: {'SI' if payload.con_factura else 'NO'}."
    if payload.descuento_valor and payload.descuento_valor > 0:
        if payload.descuento_tipo == 'porcentaje':
            pago_info += f" Descuento: {payload.descuento_valor}%."
        else:
            pago_info += f" Descuento: ${payload.descuento_valor}."
    if pago_info not in obs:
        obs = f"{obs} {pago_info}".strip()

    from datetime import datetime
    correlativo_global = int(db.query(PresupuestoModel).count()) + 1
    p = PresupuestoModel(
        cliente_id=payload.cliente_id, 
        observaciones=obs, 
        coordenadas=payload.coordenadas,
        archivos_adjuntos=archivos_json,
        anexos_imagenes_json=anexos_json,
        total=round(total_final, 2),
        fecha_creacion=datetime.utcnow().isoformat()
    )
    db.add(p)
    db.flush()
    
    # Guardar metadata de extras y pago
    meta_data = {
        # Compatibilidad temporal para frontend legado
        "items_adicionales": payload.items_adicionales,
        "tipo_cobro": payload.tipo_cobro,
        "con_factura": payload.con_factura,
        "iva_tasa": iva_tasa,
        "iva_monto": round(iva_monto, 2),
        "subtotal_materiales": round(subtotal_materiales, 2),
        "subtotal_articulos": round(subtotal_articulos, 2),
        "subtotal_extras": round(subtotal_extras, 2),
        "subtotal_neto": round(subtotal_neto, 2),
        "total_final": round(total_final, 2),
        "correlativo_global": correlativo_global,
        "descuento_tipo": payload.descuento_tipo,
        "descuento_valor": payload.descuento_valor
    }
    meta = PresupuestoMetaModel(presupuesto_id=p.id, data_json=json.dumps(meta_data))
    db.add(meta)
    
    # Registrar descuento en historial si fue aplicado
    if descuento_aplicado > 0:
        from ...models.finanzas import HistorialDescuentos
        from datetime import datetime
        historial = HistorialDescuentos(
            presupuesto_id=p.id,
            cliente_id=payload.cliente_id,
            usuario_id=None,  # Podríamos obtener el usuario actual del token si está disponible
            tipo_descuento=payload.descuento_tipo or 'fijo',
            valor_descuento=payload.descuento_valor or 0,
            monto_original=monto_antes_descuento,
            monto_con_descuento=subtotal_neto,
            monto_descontado=descuento_aplicado,
            motivo="Descuento aplicado en presupuesto",
            fecha_aplicacion=datetime.utcnow().isoformat(),
            estado='aplicado'
        )
        db.add(historial)

    for linea in lineas_merged:
        tipo = str(_linea_attr(linea, "tipo", "material") or "material")
        mat = None
        material_nombre = str(_linea_attr(linea, "material", "") or "")
        producto_id = _linea_attr(linea, "producto_id", None)

        if tipo == "articulo" and producto_id:
            prod = db.query(ProductoEstatico).filter(ProductoEstatico.id == producto_id).first()
            if prod and not material_nombre:
                material_nombre = prod.nombre

        if material_nombre:
            mat = db.query(Material).filter(Material.nombre.ilike(material_nombre)).first()

        unidad = _linea_attr(linea, "unidad", None) or (mat.unidad if mat and mat.unidad else ("u" if tipo in ["articulo", "extra"] else "m²"))
        if not _is_m2_unit(unidad):
            qty = float(_linea_attr(linea, "cantidad", _linea_attr(linea, "metros_cuadrados", 0)) or 0)
            if mat and mat.stock_actual is not None and qty > float(mat.stock_actual or 0):
                warnings.append(f"Stock insuficiente para {mat.nombre}: disponible {float(mat.stock_actual or 0)} {unidad}")
            metros_cuadrados = qty
            medidas = _linea_attr(linea, "medidas", "") or f"Cantidad: {qty} {unidad}"
        else:
            metros_cuadrados = float(_linea_attr(linea, "metros_cuadrados", 0) or 0)
            medidas = _linea_attr(linea, "medidas", "")

        li = PresupuestoLineaModel(
            presupuesto_id=p.id,
            tipo=tipo,
            material_id=_linea_attr(linea, "material_id", None),
            producto_id=producto_id,
            accesorio_id=_linea_attr(linea, "accesorio_id", None),
            material=material_nombre,
            metros_cuadrados=metros_cuadrados,
            unidad=unidad,
            cantidad=_linea_attr(linea, "cantidad", None),
            medidas=medidas,
            precio_unitario=float(_linea_attr(linea, "precio_unitario", 0) or 0),
            condiciones=_linea_attr(linea, "condiciones", ""),
            cortes_especiales=bool(_linea_attr(linea, "cortes_especiales", False) or False),
            agujeros=int(_linea_attr(linea, "agujeros", 0) or 0),
            recargo_extra=float(_linea_attr(linea, "recargo_extra", 0) or 0),
            lote_id=_linea_attr(linea, "lote_id", None),
            geometria_json=_linea_attr(linea, "geometria_json", None),
            planos_manual_json=_linea_attr(linea, "planos_manual_json", None),
        )
        db.add(li)
    db.commit()
    
    # --- Automatización CRM: Generar Lead si no existe o actualizar ---
    if payload.cliente_id:
        from ...models import Lead as LeadModel
        from ...models import Cliente as ClienteModel
        
        # Generar SIEMPRE un nuevo lead por cada nueva consulta/presupuesto
        cliente = db.query(ClienteModel).filter(ClienteModel.id == payload.cliente_id).first()
        if cliente and (cliente.nombre or cliente.email or cliente.telefono):
            from datetime import datetime
            nuevo_lead = LeadModel(
                nombre=cliente.nombre or "Cliente",
                telefono=cliente.telefono or "",
                email=cliente.email or "",
                direccion=cliente.direccion or "",
                coordenadas=cliente.coordenadas or "",
                estado="recibir_posible",
                cliente_id=cliente.id,
                fecha_creacion=datetime.utcnow().isoformat()
            )
            db.add(nuevo_lead)
            db.commit()
    # -----------------------------------------------------

    response = {
        "id": p.id,
        "estado": "enviado",
        "total": p.total,
        "subtotal_neto": round(subtotal_neto, 2),
        "iva_monto": round(iva_monto, 2),
        "total_final": round(total_final, 2),
        "correlativo_global": correlativo_global,
    }
    if warnings:
        response["warning"] = "; ".join(sorted(set(warnings)))
    return response

@router.get("/api/presupuestos")
def listar_presupuestos(cliente_id: str | None = None, solo_finanzas: bool = False, incluir_archivados: bool = False, db: Session = Depends(get_db)):
    from ...models import Cliente as ClienteModel, Lead as LeadModel
    from sqlalchemy import or_, desc
    print("DEBUG: Iniciando listar_presupuestos")
    try:
        q = db.query(PresupuestoModel)
        if cliente_id:
            q = q.filter(PresupuestoModel.cliente_id == cliente_id)
        
        # Filtrar archivados por defecto
        if not incluir_archivados:
            q = q.filter(PresupuestoModel.archivado == False)
        
        # Order by creation date descending
        if hasattr(PresupuestoModel, 'fecha_creacion'):
            q = q.order_by(desc(PresupuestoModel.fecha_creacion))
        else:
            q = q.order_by(desc(PresupuestoModel.id))
            
        rows = q.all()
        print(f"DEBUG: Encontrados {len(rows)} presupuestos")
        
        result = []
        for r in rows:
            # print(f"DEBUG: Procesando presupuesto {r.id}")
            cliente_nombre = "Cliente General"
            direccion = ""
            coordenadas = r.coordenadas

            meta_data = None
            pipeline_estado = None
            subtotal_neto = float(r.total or 0)
            iva_monto = 0.0
            total_final = float(r.total or 0)
            correlativo_global = None
            meta = db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == r.id).first()
            if meta and meta.data_json:
                try:
                    import json
                    meta_data = json.loads(meta.data_json)
                    if isinstance(meta_data, dict):
                        pipeline_estado = meta_data.get("pipeline_estado")
                        subtotal_neto = float(meta_data.get("subtotal_neto", subtotal_neto) or 0)
                        iva_monto = float(meta_data.get("iva_monto", 0) or 0)
                        total_final = float(meta_data.get("total_final", r.total or 0) or 0)
                        correlativo_global = meta_data.get("correlativo_global")
                except Exception:
                    meta_data = None
            
            # Logic to filter for Finance (Rule: Only show if Lead is converted)
            should_include = True
            
            if r.cliente_id:
                c = db.query(ClienteModel).filter(ClienteModel.id == r.cliente_id).first()
                if c:
                    cliente_nombre = c.nombre
                    direccion = c.direccion
                    if not coordenadas:
                        coordenadas = c.coordenadas
                    
                    if solo_finanzas:
                        if pipeline_estado == "convertido":
                            print(f"DEBUG: Incluyendo presupuesto {r.id} (pipeline convertido)")
                            should_include = True
                        else:
                            should_include = True
                        # Find associated Lead
                        filters = []
                        if c.email:
                            filters.append(LeadModel.email == c.email)
                        if c.telefono:
                            filters.append(LeadModel.telefono == c.telefono)

                        if filters:
                            # Get the most recent lead
                            lead = db.query(LeadModel).filter(or_(*filters)).order_by(LeadModel.fecha_creacion.desc(), LeadModel.id.desc()).first()

                            if lead:
                                if lead.estado == "convertido" or pipeline_estado == "convertido":
                                    print(f"DEBUG: Incluyendo presupuesto {r.id} (lead {lead.id} en estado convertido)")
                                    should_include = True
                                else:
                                    print(f"DEBUG: Excluyendo presupuesto {r.id} porque lead {lead.id} está en estado {lead.estado}")
                                    should_include = False
                            else:
                                if pipeline_estado == "convertido":
                                    print(f"DEBUG: Incluyendo presupuesto {r.id} (pipeline convertido, sin lead)")
                                    should_include = True
                                else:
                                    print(f"DEBUG: No se encontró lead para cliente {c.id}, excluyendo presupuesto {r.id}")
                                    should_include = False
                        else:
                            if pipeline_estado == "convertido":
                                print(f"DEBUG: Incluyendo presupuesto {r.id} (pipeline convertido, sin contacto)")
                                should_include = True
                            else:
                                print(f"DEBUG: Cliente {c.id} no tiene email ni teléfono, excluyendo presupuesto {r.id}")
                                should_include = False
            
            if not should_include:
                continue

            # COMENTADO - Función eliminada (módulo Producción eliminado)
            # trabajo = db.query(TrabajoModel).filter(TrabajoModel.presupuesto_id == r.id).first()
            trabajo = None  # Módulo Producción eliminado
            
            fecha_creacion = getattr(r, "fecha_creacion", None)

            result.append({
                "id": r.id, 
                "cliente_id": r.cliente_id,
                "cliente_nombre": cliente_nombre,
                "direccion": direccion,
                "coordenadas": coordenadas,
                "total": r.total, 
                "observaciones": r.observaciones, 
                "aceptado_venta": bool(getattr(r, "aceptado_venta", False)),
                "fecha_aceptado": getattr(r, "fecha_aceptado", None),
                "estado_pago": r.estado_pago, 
                "monto_cobrado": r.monto_cobrado,
                "subtotal_neto": round(subtotal_neto, 2),
                "iva_monto": round(iva_monto, 2),
                "total_final": round(total_final, 2),
                "correlativo_global": correlativo_global,
                "fecha_creacion": fecha_creacion,
                "pipeline_estado": pipeline_estado,
                # COMENTADO - trabajo eliminado
                # "trabajo_id": trabajo.id if trabajo else None,
                # "visita_tecnica_realizada": bool(trabajo.visita_tecnica) if trabajo else False,
                # "aprobado_jefe_produccion": trabajo.aprobado_jefe if trabajo else False,
                # "visita_tecnica_aprobada": (trabajo.visita_tecnica and trabajo.aprobado_jefe) if trabajo else False,
                # "medidas_corregidas": trabajo.medidas_corregidas if trabajo else False,
                # "link_drive": trabajo.link_drive if trabajo else None,
                # "fecha_visita_sugerida": trabajo.fecha_visita_sugerida if trabajo else None,
                "anexosImagenes": json.loads(r.anexos_imagenes_json) if r.anexos_imagenes_json else [],
                "archivado": getattr(r, "archivado", False)
            })
        
        print(f"DEBUG: Retornando {len(result)} presupuestos")
        return result
    except Exception as e:
        print(f"ERROR en listar_presupuestos: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e

@router.get("/api/presupuestos/{presupuestoId}")
def obtener_presupuesto(presupuestoId: str, db: Session = Depends(get_db)):
    import json
    p = db.query(PresupuestoModel).filter(PresupuestoModel.id == presupuestoId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
    lines = db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id == p.id).all()
    meta = db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == p.id).first()
    meta_obj = (json.loads(meta.data_json) if meta and meta.data_json else None)
    subtotal_neto = float(meta_obj.get("subtotal_neto", p.total) if isinstance(meta_obj, dict) else p.total)
    iva_monto = float(meta_obj.get("iva_monto", 0) if isinstance(meta_obj, dict) else 0)
    total_final = float(meta_obj.get("total_final", p.total) if isinstance(meta_obj, dict) else p.total)
    return {
        "id": p.id,
        "cliente_id": p.cliente_id,
        "total": p.total,
        "observaciones": p.observaciones,
        "coordenadas": p.coordenadas,
        "archivos_adjuntos": json.loads(p.archivos_adjuntos) if p.archivos_adjuntos else [],
        "anexosImagenes": json.loads(p.anexos_imagenes_json) if p.anexos_imagenes_json else [],
        "aceptado_venta": bool(getattr(p, "aceptado_venta", False)),
        "fecha_aceptado": getattr(p, "fecha_aceptado", None),
        "estado_pago": p.estado_pago,
        "monto_cobrado": p.monto_cobrado,
        "subtotal_neto": round(subtotal_neto, 2),
        "iva_monto": round(iva_monto, 2),
        "total_final": round(total_final, 2),
        "correlativo_global": (meta_obj.get("correlativo_global") if isinstance(meta_obj, dict) else None),
        "lineas": [_linea_to_response(l) for l in lines],
        "meta": meta_obj
    }

@router.post("/api/presupuestos/{presupuestoId}/aceptar")
def aceptar_presupuesto(presupuestoId: str, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    from fastapi import HTTPException
    from datetime import datetime
    print(f"DEBUG: Aceptando presupuesto {presupuestoId}")
    p = db.query(PresupuestoModel).filter(PresupuestoModel.id == presupuestoId).first()
    if not p:
        print(f"ERROR: Presupuesto {presupuestoId} no encontrado")
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    setattr(p, "aceptado_venta", True)
    setattr(p, "fecha_aceptado", datetime.utcnow().isoformat())
    db.add(p)
    db.commit()
    db.refresh(p)
    
    print(f"SUCCESS: Presupuesto {presupuestoId} aceptado")
    return {
        "id": p.id, 
        "aceptado_venta": getattr(p, "aceptado_venta", False), 
        "fecha_aceptado": getattr(p, "fecha_aceptado", None)
    }

@router.put("/api/presupuestos/{presupuestoId}")
def actualizar_presupuesto(presupuestoId: str, payload: PresupuestoUpdate, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    from fastapi import HTTPException

    p = db.query(PresupuestoModel).filter(PresupuestoModel.id == presupuestoId).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

    existing_lines = db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id == p.id).all()
    meta = db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == p.id).first()
    meta_obj = json.loads(meta.data_json) if meta and meta.data_json else {}
    if not isinstance(meta_obj, dict):
        meta_obj = {}

    warnings: list[str] = []
    if payload.lineas is not None:
        lineas_base = payload.lineas
    else:
        lineas_base = [_linea_model_to_payload(l) for l in existing_lines if (getattr(l, "tipo", "material") or "material") != "extra"]

    if payload.items_adicionales is not None:
        lineas_merged = _expandir_lineas(lineas_base, payload.items_adicionales)
    else:
        lineas_merged = list(lineas_base)
        if payload.lineas is None:
            lineas_merged += [_linea_model_to_payload(l) for l in existing_lines if (getattr(l, "tipo", "material") or "material") == "extra"]

    subtotal_materiales = 0.0
    subtotal_articulos = 0.0
    subtotal_extras = 0.0
    for linea in lineas_merged:
        tipo = str(_linea_attr(linea, "tipo", "material") or "material")
        pu = float(_linea_attr(linea, "precio_unitario", 0) or 0)
        extra = float(_linea_attr(linea, "recargo_extra", 0) or 0)
        if tipo == "extra":
            qty = float(_linea_attr(linea, "cantidad", 1) or 1)
            subtotal_extras += qty * pu + extra
            continue
        if tipo == "articulo":
            qty = float(_linea_attr(linea, "cantidad", 1) or 1)
            subtotal_articulos += qty * pu + extra
            continue

        mat = None
        material_nombre = _linea_attr(linea, "material", "")
        if material_nombre:
            mat = db.query(Material).filter(Material.nombre.ilike(str(material_nombre))).first()

        unidad = _linea_attr(linea, "unidad", None) or (mat.unidad if mat and mat.unidad else "m²")
        if not _is_m2_unit(unidad):
            qty = float(_linea_attr(linea, "cantidad", _linea_attr(linea, "metros_cuadrados", 0)) or 0)
            if mat and mat.stock_actual is not None and qty > float(mat.stock_actual or 0):
                warnings.append(f"Stock insuficiente para {mat.nombre}: disponible {float(mat.stock_actual or 0)} {unidad}")
            subtotal_materiales += qty * pu + extra
        else:
            m2 = float(_linea_attr(linea, "metros_cuadrados", 0) or 0)
            subtotal_materiales += m2 * pu + extra

    total = subtotal_materiales + subtotal_articulos + subtotal_extras
    descuento_tipo = payload.descuento_tipo if payload.descuento_tipo is not None else meta_obj.get("descuento_tipo")
    descuento_valor = float(payload.descuento_valor if payload.descuento_valor is not None else (meta_obj.get("descuento_valor") or 0))
    descuento_aplicado = 0.0
    if descuento_valor > 0:
        if descuento_tipo == "porcentaje":
            descuento_aplicado = total * (descuento_valor / 100)
        else:
            descuento_aplicado = descuento_valor
    subtotal_neto = max(0.0, total - descuento_aplicado)

    con_factura = payload.con_factura if payload.con_factura is not None else bool(meta_obj.get("con_factura", False))
    iva_tasa = float(payload.iva_tasa if payload.iva_tasa is not None else meta_obj.get("iva_tasa", 0.21))
    iva_monto = subtotal_neto * iva_tasa if con_factura else 0.0
    total_final = subtotal_neto + iva_monto
    if total_final <= 0:
        raise HTTPException(status_code=400, detail="El total del presupuesto debe ser mayor a 0")

    if payload.cliente_id is not None:
        p.cliente_id = payload.cliente_id
    if payload.observaciones is not None:
        p.observaciones = payload.observaciones
    if payload.coordenadas is not None:
        p.coordenadas = payload.coordenadas
    if payload.archivos_adjuntos is not None:
        p.archivos_adjuntos = json.dumps(payload.archivos_adjuntos)
    if payload.anexosImagenes is not None:
        p.anexos_imagenes_json = json.dumps(payload.anexosImagenes)
    p.total = round(total_final, 2)
    db.add(p)

    db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id == p.id).delete(synchronize_session=False)
    for linea in lineas_merged:
        tipo = str(_linea_attr(linea, "tipo", "material") or "material")
        material_nombre = str(_linea_attr(linea, "material", "") or "")
        producto_id = _linea_attr(linea, "producto_id", None)
        if tipo == "articulo" and producto_id and not material_nombre:
            prod = db.query(ProductoEstatico).filter(ProductoEstatico.id == producto_id).first()
            if prod:
                material_nombre = prod.nombre

        unidad = _linea_attr(linea, "unidad", "u" if tipo in ["articulo", "extra"] else "m²")
        if not _is_m2_unit(unidad):
            cantidad = float(_linea_attr(linea, "cantidad", _linea_attr(linea, "metros_cuadrados", 0)) or 0)
            metros_cuadrados = cantidad
            medidas = _linea_attr(linea, "medidas", "") or f"Cantidad: {cantidad} {unidad}"
        else:
            cantidad = _linea_attr(linea, "cantidad", None)
            metros_cuadrados = float(_linea_attr(linea, "metros_cuadrados", 0) or 0)
            medidas = _linea_attr(linea, "medidas", "")

        db.add(PresupuestoLineaModel(
            presupuesto_id=p.id,
            tipo=tipo,
            material_id=_linea_attr(linea, "material_id", None),
            producto_id=producto_id,
            accesorio_id=_linea_attr(linea, "accesorio_id", None),
            material=material_nombre,
            metros_cuadrados=metros_cuadrados,
            unidad=unidad,
            cantidad=cantidad,
            medidas=medidas,
            precio_unitario=float(_linea_attr(linea, "precio_unitario", 0) or 0),
            condiciones=_linea_attr(linea, "condiciones", ""),
            cortes_especiales=bool(_linea_attr(linea, "cortes_especiales", False) or False),
            agujeros=int(_linea_attr(linea, "agujeros", 0) or 0),
            recargo_extra=float(_linea_attr(linea, "recargo_extra", 0) or 0),
            lote_id=_linea_attr(linea, "lote_id", None),
            geometria_json=_linea_attr(linea, "geometria_json", None),
            planos_manual_json=_linea_attr(linea, "planos_manual_json", None),
        ))

    updated_meta = {
        **meta_obj,
        "items_adicionales": payload.items_adicionales if payload.items_adicionales is not None else meta_obj.get("items_adicionales", []),
        "tipo_cobro": payload.tipo_cobro if payload.tipo_cobro is not None else meta_obj.get("tipo_cobro", "contado"),
        "con_factura": con_factura,
        "iva_tasa": iva_tasa,
        "iva_monto": round(iva_monto, 2),
        "subtotal_materiales": round(subtotal_materiales, 2),
        "subtotal_articulos": round(subtotal_articulos, 2),
        "subtotal_extras": round(subtotal_extras, 2),
        "subtotal_neto": round(subtotal_neto, 2),
        "total_final": round(total_final, 2),
        "descuento_tipo": descuento_tipo,
        "descuento_valor": descuento_valor,
    }
    if meta:
        meta.data_json = json.dumps(updated_meta)
        db.add(meta)
    else:
        db.add(PresupuestoMetaModel(presupuesto_id=p.id, data_json=json.dumps(updated_meta)))

    db.commit()
    return {
        "id": p.id,
        "estado": "actualizado",
        "total": p.total,
        "subtotal_neto": round(subtotal_neto, 2),
        "iva_monto": round(iva_monto, 2),
        "total_final": round(total_final, 2),
        "warning": "; ".join(sorted(set(warnings))) if warnings else None,
    }

@router.post("/api/presupuestos/{presupuestoId}/meta")
def guardar_presupuesto_meta(presupuestoId: str, payload: PresupuestoMetaPayload, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    import json
    existing = db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == presupuestoId).first()
    data_json = json.dumps(payload.data)
    if existing:
        existing.data_json = data_json
        db.add(existing)
        db.commit()
        return {"id": existing.id}
    meta = PresupuestoMetaModel(presupuesto_id=presupuestoId, data_json=data_json)
    db.add(meta)
    db.commit()
    return {"id": meta.id}

@router.get("/api/presupuestos/{presupuestoId}/meta")
def obtener_presupuesto_meta(presupuestoId: str, db: Session = Depends(get_db)):
    import json
    meta = db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == presupuestoId).first()
    if not meta or not meta.data_json:
        return None
    try:
        return json.loads(meta.data_json)
    except Exception:
        return None

@router.get("/api/presupuestos/historial")
def historial_presupuestos(cliente_id: str | None = None, db: Session = Depends(get_db)):
    import json
    q = db.query(PresupuestoModel)
    if cliente_id:
        q = q.filter(PresupuestoModel.cliente_id == cliente_id)
    pres = q.all()
    result = []
    for p in pres:
        lines = db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id == p.id).all()
        meta = db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == p.id).first()
        meta_obj = (json.loads(meta.data_json) if meta and meta.data_json else None)
        subtotal_neto = float(meta_obj.get("subtotal_neto", p.total) if isinstance(meta_obj, dict) else p.total)
        iva_monto = float(meta_obj.get("iva_monto", 0) if isinstance(meta_obj, dict) else 0)
        total_final = float(meta_obj.get("total_final", p.total) if isinstance(meta_obj, dict) else p.total)
        result.append({
            "id": p.id,
            "cliente_id": p.cliente_id,
            "observaciones": p.observaciones,
            "total": p.total,
            "subtotal_neto": round(subtotal_neto, 2),
            "iva_monto": round(iva_monto, 2),
            "total_final": round(total_final, 2),
            "correlativo_global": (meta_obj.get("correlativo_global") if isinstance(meta_obj, dict) else None),
            "lineas": [_linea_to_response(l) for l in lines],
            "meta": meta_obj,
        })
    return result

@router.delete("/api/presupuestos/{presupuestoId}")
def eliminar_presupuesto(presupuestoId: str, db: Session = Depends(get_db), user = Depends(require_roles(["admin"]))):
    p = db.query(PresupuestoModel).filter(PresupuestoModel.id == presupuestoId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not Found")

    # Eliminar relaciones directas
    db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id == presupuestoId).delete(synchronize_session=False)
    db.query(PresupuestoMetaModel).filter(PresupuestoMetaModel.presupuesto_id == presupuestoId).delete(synchronize_session=False)

    # Finanzas y producción
    db.query(Pago).filter(Pago.presupuesto_id == presupuestoId).delete(synchronize_session=False)
    # COMENTADO - Clases eliminadas (módulo Producción eliminado)
    # db.query(VisitaTecnica).filter(VisitaTecnica.presupuesto_id == presupuestoId).delete(synchronize_session=False)
    # db.query(OrdenProduccion).filter(OrdenProduccion.presupuesto_id == presupuestoId).delete(synchronize_session=False)
    db.query(PrestacionServicio).filter(PrestacionServicio.presupuesto_id == presupuestoId).delete(synchronize_session=False)
    db.query(Suscripcion).filter(Suscripcion.presupuesto_id == presupuestoId).delete(synchronize_session=False)
    db.query(CuentaCorrienteMovimiento).filter(CuentaCorrienteMovimiento.referencia_id == presupuestoId).delete(synchronize_session=False)

    # COMENTADO - Clases eliminadas (módulo Producción eliminado)
    # Trabajos y piezas
    # trabajos = db.query(Trabajo).filter(Trabajo.presupuesto_id == presupuestoId).all()
    # for t in trabajos:
    #     db.query(PiezaTrabajo).filter(PiezaTrabajo.trabajo_id == t.id).delete(synchronize_session=False)
    #     db.delete(t)

    db.delete(p)
    db.commit()
    return {"deleted": True, "id": presupuestoId}

@router.patch("/api/presupuestos/{presupuestoId}/archivar")
def archivar_presupuesto(presupuestoId: str, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    p = db.query(PresupuestoModel).filter(PresupuestoModel.id == presupuestoId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    setattr(p, "archivado", True)
    db.commit()
    return {"id": p.id, "archivado": True}

@router.patch("/api/presupuestos/{presupuestoId}/reactivar")
def reactivar_presupuesto(presupuestoId: str, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    p = db.query(PresupuestoModel).filter(PresupuestoModel.id == presupuestoId).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    setattr(p, "archivado", False)
    db.commit()
    return {"id": p.id, "archivado": False}

@router.post("/api/planos")
def guardar_plano(payload: PlanoClienteMaterialCreate, db: Session = Depends(get_db), user = Depends(require_roles(["ventas", "admin"]))):
    p = PlanoModel(
        cliente_id=payload.cliente_id,
        material=payload.material,
        imagen=payload.imagen,
        aprobado=bool(payload.aprobado),
        firmado_por=payload.firmado_por,
        medidas=payload.medidas,
    )
    db.add(p)
    db.commit()
    return {"id": p.id}

@router.get("/api/planos")
def obtener_plano(cliente_id: str, material: str, db: Session = Depends(get_db)):
    p = db.query(PlanoModel).filter(PlanoModel.cliente_id == cliente_id, PlanoModel.material == material).first()
    if not p:
        return None
    return {
        "id": p.id,
        "cliente_id": p.cliente_id,
        "material": p.material,
        "aprobado": p.aprobado,
        "firmado_por": p.firmado_por,
        "medidas": p.medidas,
        "imagen": p.imagen,
    }

@router.get("/api/planos/list")
def listar_planos(cliente_id: str, material: str | None = None, db: Session = Depends(get_db)):
    q = db.query(PlanoModel).filter(PlanoModel.cliente_id == cliente_id)
    if material:
        q = q.filter(PlanoModel.material == material)
    rows = q.all()
    return [{
        "id": r.id,
        "cliente_id": r.cliente_id,
        "material": r.material,
        "aprobado": r.aprobado,
        "firmado_por": r.firmado_por,
        "medidas": r.medidas,
        "imagen": r.imagen,
    } for r in rows]

@router.get("/api/planos/historial")
def historial_planos(cliente_id: str, material: str | None = None, solo_guardados: bool | None = None, db: Session = Depends(get_db)):
    q = db.query(PlanoModel).filter(PlanoModel.cliente_id == cliente_id)
    if material:
        q = q.filter(PlanoModel.material == material)
    if solo_guardados:
        q = q.filter(PlanoModel.imagen.isnot(None))
    rows = q.all()
    return [{
        "id": r.id,
        "cliente_id": r.cliente_id,
        "material": r.material,
        "aprobado": r.aprobado,
        "firmado_por": r.firmado_por,
        "medidas": r.medidas,
        "imagen": r.imagen,
    } for r in rows]

@router.get("/api/presupuestos/clasificacion-material")
def clasificacion_material(cliente_id: str, db: Session = Depends(get_db)):
    pres_ids = [p.id for p in db.query(PresupuestoModel).filter(PresupuestoModel.cliente_id == cliente_id).all()]
    if not pres_ids:
        return []
    lines = db.query(PresupuestoLineaModel).filter(PresupuestoLineaModel.presupuesto_id.in_(pres_ids)).all()
    acc: dict[str, dict[str, float]] = {}
    for l in lines:
        entry = acc.setdefault(l.material, {"total_m2": 0.0, "total_recargo": 0.0, "total_importe": 0.0})
        m2 = float(l.metros_cuadrados or 0)
        pu = float(l.precio_unitario or 0)
        extra = float(l.recargo_extra or 0)
        entry["total_m2"] += m2
        entry["total_recargo"] += extra
        entry["total_importe"] += m2 * pu + extra
    return {k: v for k, v in acc.items()}
