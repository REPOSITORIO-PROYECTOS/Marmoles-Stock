"""
Sistema de encuestas de satisfacción para entregas
Genera links únicos, registra respuestas y gestiona conformidad

NOTA: Este módulo estaba vinculado al modelo de Trabajo que ha sido eliminado.
Los endpoints están comentados. TODO: Reimplementar encuestas.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
import uuid
import secrets

from ...db import get_db
# COMENTADO - Importación eliminada (módulo Producción eliminado)
# from ...models import Trabajo as TrabajoModel
from ...auth import get_current_user

router = APIRouter()

# ===== SCHEMAS =====
# COMENTADO - Todas las clases de schema dependían de Trabajo (módulo Producción eliminado)
# class GenerarEncuestaRequest(BaseModel):
#     trabajo_id: str
#     
# class EncuestaResponse(BaseModel):
#     link_encuesta: str
#     token: str
#     
# class SubmitEncuestaPublica(BaseModel):
#     token: str
#     conformidad: bool
#     calificacion: int  # 1-5
#     comentarios: Optional[str] = None
#     firma_cliente: Optional[str] = None  # Base64 de la firma
#     nombre_quien_recibe: Optional[str] = None

# ===== ENDPOINTS =====
# TODOS LOS ENDPOINTS COMENTADOS - El módulo estaba vinculado a Trabajo que ha sido eliminado
# TODO: Reimplementar sin dependencia de Trabajo

# @router.post("/api/logistica/entregas/{trabajo_id}/generar-encuesta", dependencies=[Depends(get_current_user)])
# def generar_link_encuesta(trabajo_id: str, db: Session = Depends(get_db)):
#     """
#     Genera un link único de encuesta para un trabajo
#     Solo si está pagado y listo para entregar
#     """
#     trabajo = db.query(TrabajoModel).filter(TrabajoModel.id == trabajo_id).first()
#     if not trabajo:
#         raise HTTPException(status_code=404, detail="Trabajo no encontrado")
#     
#     # Verificar que esté pagado
#     if not trabajo.sena_abonada:
#         raise HTTPException(status_code=400, detail="El trabajo no está pagado completamente")
#     
#     # Generar token único
#     token = secrets.token_urlsafe(32)
#     
#     # Guardar el token en la base de datos
#     sql = text("""
#         UPDATE trabajos 
#         SET encuesta_token = :token,
#             encuesta_generada_fecha = :fecha
#         WHERE id = :trabajo_id
#     """)
#     
#     db.execute(sql, {
#         "token": token,
#         "fecha": datetime.now(),
#         "trabajo_id": trabajo_id
#     })
#     db.commit()
#     
#     # Generar el link (ajustar el dominio según tu configuración)
#     link_encuesta = f"/encuesta/{token}"
#     
#     return {
#         "link_encuesta": link_encuesta,
#         "token": token,
#         "trabajo_id": trabajo_id
#     }


# @router.get("/api/logistica/encuesta/{token}")
# def obtener_encuesta_publica(token: str, db: Session = Depends(get_db)):
#     """
#     Endpoint público para que el cliente vea la encuesta
#     No requiere autenticación
#     """
#     sql = text("""
#         SELECT id, cliente, material_id, estado_logistica, 
#                encuesta_completada, encuesta_completada_fecha
#         FROM trabajos 
#         WHERE encuesta_token = :token
#     """)
#     
#     trabajo = db.execute(sql, {"token": token}).mappings().first()
#     
#     if not trabajo:
#         raise HTTPException(status_code=404, detail="Encuesta no encontrada o token inválido")
#     
#     if trabajo["encuesta_completada"]:
#         return {
#             "ya_completada": True,
#             "fecha_completada": trabajo["encuesta_completada_fecha"],
#             "mensaje": "Esta encuesta ya fue completada. ¡Gracias!"
#         }
#     
#     return {
#         "ya_completada": False,
#         "cliente": trabajo["cliente"],
#         "trabajo_id": trabajo["id"]
#     }


# @router.post("/api/logistica/encuesta/submit")
# def submit_encuesta_publica(payload: SubmitEncuestaPublica, db: Session = Depends(get_db)):
#     """
#     Endpoint público para que el cliente complete la encuesta
#     No requiere autenticación
#     """
#     sql_find = text("""
#         SELECT id, encuesta_completada 
#         FROM trabajos 
#         WHERE encuesta_token = :token
#     """)
#     
#     trabajo = db.execute(sql_find, {"token": payload.token}).mappings().first()
#     
#     if not trabajo:
#         raise HTTPException(status_code=404, detail="Token inválido")
#     
#     if trabajo["encuesta_completada"]:
#         raise HTTPException(status_code=400, detail="Esta encuesta ya fue completada")
#     
#     # Actualizar el trabajo con la respuesta de la encuesta
#     sql_update = text("""
#         UPDATE trabajos 
#         SET encuesta_completada = TRUE,
#             encuesta_completada_fecha = :fecha,
#             encuesta_conformidad = :conformidad,
#             encuesta_calificacion = :calificacion,
#             encuesta_comentarios = :comentarios,
#             encuesta_firma_cliente = :firma,
#             encuesta_nombre_receptor = :nombre_receptor,
#             estado_logistica = 'entregada'
#         WHERE id = :trabajo_id
#     """)
#     
#     db.execute(sql_update, {
#         "fecha": datetime.now(),
#         "conformidad": payload.conformidad,
#         "calificacion": payload.calificacion,
#         "comentarios": payload.comentarios or "",
#         "firma": payload.firma_cliente or "",
#         "nombre_receptor": payload.nombre_quien_recibe or "",
#         "trabajo_id": trabajo["id"]
#     })
#     
#     db.commit()
#     
#     return {
#         "ok": True,
#         "mensaje": "¡Gracias por completar la encuesta!",
#         "trabajo_id": trabajo["id"]
#     }


# @router.get("/api/logistica/entregas/{trabajo_id}/encuesta-status", dependencies=[Depends(get_current_user)])
# def verificar_status_encuesta(trabajo_id: str, db: Session = Depends(get_db)):
#     """
#     Verificar si la encuesta fue completada y obtener detalles
#     """
#     sql = text("""
#         SELECT encuesta_token, encuesta_completada, encuesta_completada_fecha,
#                encuesta_conformidad, encuesta_calificacion, encuesta_comentarios,
#                encuesta_nombre_receptor, encuesta_firma_cliente
#         FROM trabajos 
#         WHERE id = :trabajo_id
#     """)
#     
#     trabajo = db.execute(sql, {"trabajo_id": trabajo_id}).mappings().first()
#     
#     if not trabajo:
#         raise HTTPException(status_code=404, detail="Trabajo no encontrado")
#     
#     return {
#         "tiene_encuesta": bool(trabajo["encuesta_token"]),
#         "completada": trabajo["encuesta_completada"] or False,
#         "fecha_completada": trabajo["encuesta_completada_fecha"],
#         "conformidad": trabajo["encuesta_conformidad"],
#         "calificacion": trabajo["encuesta_calificacion"],
#         "comentarios": trabajo["encuesta_comentarios"],
#         "nombre_receptor": trabajo["encuesta_nombre_receptor"],
#         "tiene_firma": bool(trabajo["encuesta_firma_cliente"])
#     }
