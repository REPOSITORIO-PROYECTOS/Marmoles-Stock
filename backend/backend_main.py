"""
Punto de entrada para el ejecutable PyInstaller.
Se ejecuta como proceso hijo lanzado por Electron.
"""
import sys
import os

# Cuando está frozen (PyInstaller), ajustar paths
if getattr(sys, 'frozen', False):
    bundle_dir = sys._MEIPASS
    os.chdir(bundle_dir)
    sys.path.insert(0, bundle_dir)

import uvicorn  # noqa: E402 — debe importarse después del chdir

if __name__ == '__main__':
    host = os.environ.get('HOST', '127.0.0.1')
    port = int(os.environ.get('PORT', '8000'))
    uvicorn.run(
        'app.main:app',
        host=host,
        port=port,
        workers=1,
        log_level='warning',
        access_log=False,
    )
