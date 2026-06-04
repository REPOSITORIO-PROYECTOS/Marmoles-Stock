# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec para el backend FastAPI de IMA Mármol.
Ejecutar desde la carpeta backend/ con el venv activo:
  pyinstaller backend.spec --clean
"""
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
from pathlib import Path

block_cipher = None

# ── Datos (archivos no-Python que la app necesita en runtime) ─────────────────
datas = []

# Librerías con recursos propios
datas += collect_data_files('ezdxf')
datas += collect_data_files('matplotlib')
datas += collect_data_files('shapely')
datas += collect_data_files('alembic')
datas += collect_data_files('pydantic')

# Código fuente de la app y migraciones
datas += [
    ('app',     'app'),
    ('alembic', 'alembic'),
]
if Path('alembic.ini').exists():
    datas += [('alembic.ini', '.')]

# ── Hidden imports ─────────────────────────────────────────────────────────────
hiddenimports = [
    # uvicorn
    'uvicorn.lifespan.on',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
    # DB drivers
    'sqlalchemy.dialects.sqlite',
    'sqlalchemy.dialects.sqlite.pysqlite',
    # Auth
    'passlib.handlers.bcrypt',
    'passlib.handlers.sha2_crypt',
    'jose',
    'jose.jwt',
    # Multipart / upload
    'multipart',
    'python_multipart',
    # Settings / env
    'dotenv',
    'pydantic_settings',
    # Email (pydantic usa este validator)
    'email_validator',
    # Geometry
    'shapely.geometry',
    'shapely.ops',
    # DXF
    'ezdxf.addons',
    # Excel
    'openpyxl',
    'openpyxl.styles',
    'openpyxl.utils',
]

hiddenimports += collect_submodules('uvicorn')
hiddenimports += collect_submodules('fastapi')
hiddenimports += collect_submodules('sqlalchemy')
hiddenimports += collect_submodules('shapely')
hiddenimports += collect_submodules('ezdxf')

# ── Análisis ───────────────────────────────────────────────────────────────────
a = Analysis(
    ['backend_main.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', '_tkinter', 'test', 'unittest', 'pytest'],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name='backend',
)
