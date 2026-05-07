from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from ...db import get_db
from ...models import User as UserModel
from ...auth import create_session, verify_password, hash_password, get_current_user, require_roles, logout_session
from ..schemas import CambioPasswordPayload, LoginPayload, UsuarioCreate
import os
import logging
from datetime import datetime, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/api/auth/login")
def auth_login(payload: LoginPayload, db: Session = Depends(get_db)):
    logger.info(f"Intento de login para usuario: '{payload.usuario}'")
    
    # Búsqueda insensible a mayúsculas/minúsculas para el nombre de usuario
    u = db.query(UserModel).filter((UserModel.username.ilike(payload.usuario)) | (UserModel.email.ilike(payload.usuario))).first()
    
    if not u:
        logger.warning(f"❌ LOGIN FALLIDO - Usuario no existe: '{payload.usuario}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")
            
    now = datetime.utcnow()
    if u.locked_until and u.locked_until > now:
        tiempo_restante = int((u.locked_until - now).total_seconds() / 60)
        logger.warning(f"🔒 LOGIN BLOQUEADO - Usuario: '{u.username}' (id: {u.id}) - Bloqueado por {tiempo_restante} minutos más")
        raise HTTPException(status_code=403, detail="Account locked")
        
    if not verify_password(payload.password, u.password_salt, u.password_hash):
        u.failed_attempts = int(u.failed_attempts or 0) + 1
        logger.warning(f"❌ LOGIN FALLIDO - Contraseña incorrecta para usuario: '{u.username}' (id: {u.id}) - Intentos fallidos: {u.failed_attempts}/5")
        
        if u.failed_attempts >= 5:
            u.locked_until = now + timedelta(minutes=15)
            logger.error(f"🔒 CUENTA BLOQUEADA - Usuario: '{u.username}' (id: {u.id}) - 5 intentos fallidos - Bloqueado por 15 minutos")
        
        db.add(u)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    # Login exitoso
    u.failed_attempts = 0
    u.locked_until = None
    db.add(u)
    db.commit()
    token = create_session(db, u.id)
    logger.info(f"✅ LOGIN EXITOSO - Usuario: '{u.username}' (id: {u.id}, rol: {u.role})")
    return {"token": token, "user": {"id": u.id, "username": u.username, "email": u.email, "role": u.role}}

@router.post("/api/usuarios")
def crear_usuario(payload: UsuarioCreate, db: Session = Depends(get_db), current: UserModel = Depends(require_roles(["admin"]))):
    logger.info(f"👤 CREAR USUARIO - Admin '{current.username}' creando usuario '{payload.username}' con rol '{payload.rol}'")
    
    salt = os.urandom(16).hex()
    hashed = hash_password(payload.password, salt)
    u = UserModel(username=payload.username, email=payload.email, password_hash=hashed, password_salt=salt, role=payload.rol)
    db.add(u)
    db.commit()
    
    logger.info(f"✅ USUARIO CREADO - Username: '{u.username}' (id: {u.id}, rol: {u.role})")
    return {"id": u.id, "username": u.username, "email": u.email, "role": u.role}

@router.get("/api/usuarios/me")
def usuario_me(current: UserModel = Depends(get_current_user)):
    return {"id": current.id, "username": current.username, "email": current.email, "role": current.role}

@router.post("/api/auth/logout")
def auth_logout(authorization: str = Header(None), db: Session = Depends(get_db), current: UserModel = Depends(get_current_user)):
    logger.info(f"🚪 LOGOUT - Usuario: '{current.username}' (id: {current.id})")
    logout_session(db, authorization)
    return {"ok": True}


@router.post("/api/auth/change-password")
def auth_change_password(
    payload: CambioPasswordPayload,
    db: Session = Depends(get_db),
    current: UserModel = Depends(get_current_user),
):
    if not payload.password_actual or not payload.password_nueva:
        raise HTTPException(status_code=400, detail="Datos incompletos")
    if len(payload.password_nueva) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")
    if payload.password_actual == payload.password_nueva:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe ser diferente a la actual")
    if not verify_password(payload.password_actual, current.password_salt, current.password_hash):
        raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")

    salt = os.urandom(16).hex()
    current.password_salt = salt
    current.password_hash = hash_password(payload.password_nueva, salt)
    db.add(current)
    db.commit()
    logger.info(f"🔐 PASSWORD CAMBIADA - Usuario: '{current.username}' (id: {current.id})")
    return {"ok": True}
