from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from sqlalchemy import inspect, text

from .db import engine, SessionLocal
from .models import Base, User
from .auth import hash_password

from .src.auth.router import router as auth_router
from .src.inventario.router import router as inventario_router
try:
    from .src.produccion.router import router as produccion_router
except Exception as e:
    print(f"[WARN] No se pudo cargar router de produccion: {e}")
    produccion_router = None
from .src.crm.router import router as crm_router
from .src.presupuestos.router import router as presupuestos_router
# COMENTADO - Archivo eliminado (módulo Producción eliminado)
# from .src.finanzas_produccion_router import router as finanzas_produccion_router
finanzas_produccion_router = None
from .src.finanzas.router import router as finanzas_router
from .src.planos_tecnicos.router import router as planos_tecnicos_router
from .src.servicios.router import router as servicios_router
from .src.logistica.router import router as logistica_router
from .src.logistica.encuestas import router as encuestas_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Modo depósito: false por defecto (solo inventario + auth). Activar comercial con ENABLE_COMMERCIAL_MODULES=true
def _commercial_modules_enabled() -> bool:
    raw = os.getenv("ENABLE_COMMERCIAL_MODULES", "false").strip().lower()
    return raw in ("1", "true", "yes", "on")

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="Mundo di Marmi API", lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"GLOBAL ERROR: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://marmoles.sistemataup.online",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/health")
def api_health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"service": "mundo-di-marmi", "message": "API operativa"}

def _ensure_crm_columns():
    try:
        with engine.begin() as conn:
            insp = inspect(conn)
            clientes_cols = {c["name"] for c in insp.get_columns("clientes")}
            if "dni" not in clientes_cols:
                conn.execute(text("ALTER TABLE clientes ADD COLUMN dni VARCHAR(32)"))
            if "coordenadas" not in clientes_cols:
                conn.execute(text("ALTER TABLE clientes ADD COLUMN coordenadas VARCHAR(255)"))
            if "es_cuenta_corriente" not in clientes_cols:
                conn.execute(text("ALTER TABLE clientes ADD COLUMN es_cuenta_corriente BOOLEAN DEFAULT FALSE"))
            if "limite_credito" not in clientes_cols:
                conn.execute(text("ALTER TABLE clientes ADD COLUMN limite_credito FLOAT DEFAULT 0.0"))
            if "saldo_actual" not in clientes_cols:
                conn.execute(text("ALTER TABLE clientes ADD COLUMN saldo_actual FLOAT DEFAULT 0.0"))

            leads_cols = {c["name"] for c in insp.get_columns("leads")}
            if "dni" not in leads_cols:
                conn.execute(text("ALTER TABLE leads ADD COLUMN dni VARCHAR(32)"))
            if "coordenadas" not in leads_cols:
                conn.execute(text("ALTER TABLE leads ADD COLUMN coordenadas VARCHAR(255)"))
            if "estado" not in leads_cols:
                conn.execute(text("ALTER TABLE leads ADD COLUMN estado VARCHAR(32) DEFAULT 'nuevo'"))
            if "fecha_creacion" not in leads_cols:
                conn.execute(text("ALTER TABLE leads ADD COLUMN fecha_creacion VARCHAR(64)"))
            if "cliente_id" not in leads_cols:
                conn.execute(text("ALTER TABLE leads ADD COLUMN cliente_id VARCHAR(36)"))

            retazos_cols = {c["name"] for c in insp.get_columns("retazos")}
            if "lote_id" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN lote_id VARCHAR(36)"))
            if "espesor" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN espesor INTEGER"))
            if "ubicacion" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN ubicacion VARCHAR(64)"))
            if "en_venta" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN en_venta BOOLEAN DEFAULT FALSE"))
            if "precio" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN precio FLOAT"))
            if "reservado_por" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN reservado_por VARCHAR(36)"))
            if "reservado_hasta" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN reservado_hasta VARCHAR(64)"))
            if "geometria_json" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN geometria_json TEXT"))
            if "area_mm2" not in retazos_cols:
                conn.execute(text("ALTER TABLE retazos ADD COLUMN area_mm2 FLOAT"))
            
            # --- INVENTARIO & LOTES ---
            lotes_cols = {c["name"] for c in insp.get_columns("lotes")}
            if "cantidad" not in lotes_cols:
                conn.execute(text("ALTER TABLE lotes ADD COLUMN cantidad INTEGER DEFAULT 1"))
            if "costo_m2" not in lotes_cols:
                conn.execute(text("ALTER TABLE lotes ADD COLUMN costo_m2 FLOAT DEFAULT 0.0"))
            if "ancho_m" not in lotes_cols:
                conn.execute(text("ALTER TABLE lotes ADD COLUMN ancho_m FLOAT"))
            if "largo_m" not in lotes_cols:
                conn.execute(text("ALTER TABLE lotes ADD COLUMN largo_m FLOAT"))
            
            compras_cols = {c["name"] for c in insp.get_columns("compras")}
            if "lote_id" not in compras_cols:
                conn.execute(text("ALTER TABLE compras ADD COLUMN lote_id VARCHAR(36)"))
            if "precio_m2" not in compras_cols:
                conn.execute(text("ALTER TABLE compras ADD COLUMN precio_m2 FLOAT"))
            if "precio_mayor_m2" not in compras_cols:
                conn.execute(text("ALTER TABLE compras ADD COLUMN precio_mayor_m2 FLOAT"))
            if "costo_m2" not in compras_cols:
                conn.execute(text("ALTER TABLE compras ADD COLUMN costo_m2 FLOAT"))

            placas_cols = {c["name"] for c in insp.get_columns("placas")}
            if "espesor" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN espesor INTEGER"))
            if "codigo" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN codigo VARCHAR(64)"))
            if "plano_tecnico_id" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN plano_tecnico_id VARCHAR(36)"))
            if "lote_id" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN lote_id VARCHAR(36)"))
            if "ubicacion" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN ubicacion VARCHAR(64)"))
            if "estado" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN estado VARCHAR(32) DEFAULT 'disponible'"))
            if "precio" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN precio FLOAT"))
            if "reservado_por" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN reservado_por VARCHAR(36)"))
            if "reservado_hasta" not in placas_cols:
                conn.execute(text("ALTER TABLE placas ADD COLUMN reservado_hasta VARCHAR(64)"))
            
            # --- PRESUPUESTOS ---
            presupuestos_cols = {c["name"] for c in insp.get_columns("presupuestos")}
            if "coordenadas" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN coordenadas VARCHAR(255)"))
            if "archivos_adjuntos" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN archivos_adjuntos VARCHAR(4096)"))
            if "estado_pago" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN estado_pago VARCHAR(32) DEFAULT 'pendiente'"))
            if "monto_cobrado" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN monto_cobrado FLOAT DEFAULT 0.0"))
            if "aceptado_venta" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN aceptado_venta BOOLEAN DEFAULT FALSE"))
            if "fecha_aceptado" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN fecha_aceptado VARCHAR(64)"))
            if "fecha_creacion" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN fecha_creacion VARCHAR(64)"))
            if "anexos_imagenes_json" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN anexos_imagenes_json TEXT"))
            if "observaciones" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN observaciones VARCHAR(1024)"))
            if "total" not in presupuestos_cols:
                conn.execute(text("ALTER TABLE presupuestos ADD COLUMN total FLOAT DEFAULT 0.0"))

            if insp.has_table("pagos"):
                pagos_cols = {c["name"] for c in insp.get_columns("pagos")}
                if "metodo_pago" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN metodo_pago VARCHAR(64)"))
                if "referencia" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN referencia VARCHAR(255)"))
                if "fecha" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN fecha VARCHAR(64)"))
                if "estado" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN estado VARCHAR(32) DEFAULT 'pendiente'"))
                if "confirmado_por" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN confirmado_por VARCHAR(36)"))
                if "fecha_confirmacion" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN fecha_confirmacion VARCHAR(64)"))
                if "fecha_registro" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN fecha_registro VARCHAR(64)"))
                if "nota" not in pagos_cols:
                    conn.execute(text("ALTER TABLE pagos ADD COLUMN nota VARCHAR(500)"))

            lineas_cols = {c["name"] for c in insp.get_columns("presupuesto_lineas")}
            if "tipo" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN tipo VARCHAR(32) DEFAULT 'material'"))
            if "material_id" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN material_id VARCHAR(36)"))
            if "producto_id" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN producto_id VARCHAR(36)"))
            if "accesorio_id" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN accesorio_id VARCHAR(36)"))
            if "medidas" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN medidas VARCHAR(255)"))
            if "unidad" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN unidad VARCHAR(32) DEFAULT 'm²'"))
            if "cantidad" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN cantidad FLOAT"))
            if "precio_unitario" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN precio_unitario FLOAT"))
            if "condiciones" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN condiciones VARCHAR(255)"))
            if "cortes_especiales" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN cortes_especiales BOOLEAN DEFAULT FALSE"))
            if "agujeros" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN agujeros INTEGER"))
            if "recargo_extra" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN recargo_extra FLOAT"))
            if "lote_id" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN lote_id VARCHAR(36)"))
            if "geometria_json" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN geometria_json VARCHAR(8192)"))
            if "planos_manual_json" not in lineas_cols:
                conn.execute(text("ALTER TABLE presupuesto_lineas ADD COLUMN planos_manual_json TEXT"))

            # --- MATERIALES (asegurar columna 'activo') ---
            materiales_cols = {c["name"] for c in insp.get_columns("materiales")}
            if "activo" not in materiales_cols:
                conn.execute(text("ALTER TABLE materiales ADD COLUMN activo BOOLEAN DEFAULT TRUE"))
            if "precio_mayor_m2" not in materiales_cols:
                conn.execute(text("ALTER TABLE materiales ADD COLUMN precio_mayor_m2 FLOAT"))

    except Exception as e:
        logger.error(f"Error ensuring CRM columns: {e}")

def _ensure_bootstrap():
    Base.metadata.create_all(bind=engine)
    _ensure_crm_columns()
    db = None
    try:
        db = SessionLocal()
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            salt = os.urandom(16).hex()
            pwd = hash_password("admin", salt)
            admin = User(username="admin", email="admin@example.com", password_hash=pwd, password_salt=salt, role="admin", active=True)
            db.add(admin)
            db.commit()
    finally:
        if db:
            db.close()

_ensure_bootstrap()

# Mount static files
os.makedirs("app/uploads", exist_ok=True)
os.makedirs("app/static/planes", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")
app.mount("/static/planes", StaticFiles(directory="app/static/planes"), name="planes")

app.include_router(auth_router)
app.include_router(inventario_router)
if _commercial_modules_enabled():
    if produccion_router:
        app.include_router(produccion_router)
    app.include_router(crm_router)
    app.include_router(presupuestos_router)
    # COMENTADO - Router eliminado (módulo Producción eliminado)
    # if finanzas_produccion_router:
    #     app.include_router(finanzas_produccion_router)
    app.include_router(finanzas_router)
    app.include_router(planos_tecnicos_router)
    app.include_router(servicios_router)
    app.include_router(logistica_router)
    app.include_router(encuestas_router)
else:
    logger.info("Modo inventario: routers comerciales (CRM, presupuestos, finanzas, etc.) desactivados.")
