"""
Script de Seed - Inventario Inicial de Marmoles
Carga:
1. Tabla lotes (Stock inicial de bloques)
2. Tabla placas (Inventario de planchas vírgenes expandidas)
3. Tabla retazos (Inventario de sobrantes y cortes)

Uso:
  python seed_inventory.py                     # Usa DB de .env o PostgreSQL por defecto
  python seed_inventory.py --sqlite            # Usa SQLite local (dev_inventory.db)
"""

import sys
import os
import argparse
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Argumentos
parser = argparse.ArgumentParser(description='Seed de inventario')
parser.add_argument('--sqlite', action='store_true', help='Usar SQLite local en lugar de PostgreSQL')
args = parser.parse_args()

# Agregar path del backend a sys.path para importar módulos PRIMERO
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, backend_path)

# Ahora importar los modelos
from app.models import Base, Material, Lote, Placa, Retazo

# Configurar la BD DESPUÉS de importar los modelos
if args.sqlite:
    db_path = os.path.join(backend_path, '..', 'dev_inventory.db')
    DATABASE_URL = f"sqlite:///{db_path}"
    engine = create_engine(DATABASE_URL, echo=False)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    print(f"[INFO] Usando SQLite: {db_path}")
else:
    # Usa configuración normal (PostgreSQL)
    from app.db import SessionLocal, engine
    print("[INFO] Usando BD configurada en .env (PostgreSQL)")

def crear_tablas():
    """Asegurar que las tablas existan"""
    Base.metadata.create_all(bind=engine)
    print("✓ Tablas verificadas/creadas")

def seed_materiales(db):
    """Crear registro de materiales si no existen"""
    materiales = [
        "Negro Brasil",
        "Blanco Dallas",
        "Gris Mara",
        "Travertino",
        "Purastone Blanco",
        "Mármol Carrara",
        "Silestone Gris",
        "Cuarzo Blanco",
        "Negro Absoluto",
        "Calacatta",
        "Verde Ubatuba"
    ]
    
    for nombre in materiales:
        existe = db.query(Material).filter(Material.nombre == nombre).first()
        if not existe:
            mat = Material(
                nombre=nombre,
                precio_m2=1000.0,  # Valor por defecto
                espesor_mm=20,
                stock_actual=0.0,
                unidad="m²",
                disponible_para_venta=True,
                activo=True
            )
            db.add(mat)
            print(f"  ✓ Material: {nombre}")
        else:
            print(f"  → Material ya existe: {nombre}")
    
    db.commit()


def seed_lotes(db):
    """Crear lotes iniciales"""
    datos_lotes = [
        ("Negro Brasil", "BLQ-NB-084", 433.15, 1850, "Tanda 1"),
        ("Blanco Dallas", "BLQ-BD-102", 2295, 1900, "Tanda 1"),
        ("Gris Mara", "BLQ-GM-045", 3200, 1800, "Tanda 1"),
        ("Travertino", "BLQ-TRV-015", 2800, 1600, "Tanda 2"),
        ("Purastone Blanco", "BLQ-PB-220", 3200, 1600, "Tanda 2"),
        ("Negro Brasil", "BLQ-NB-085", 3000, 1850, "Tanda 2"),
        ("Mármol Carrara", "BLQ-CAR-050", 2900, 1700, "Tanda 2"),
        ("Silestone Gris", "BLQ-SG-110", 3200, 1600, "Tanda 2"),
        ("Cuarzo Blanco", "BLQ-CB-300", 3100, 1500, "Tanda 3"),
        ("Negro Absoluto", "BLQ-NA-405", 2900, 1800, "Tanda 3"),
        ("Calacatta", "BLQ-CAL-099", 3200, 1600, "Tanda 3"),
        ("Verde Ubatuba", "BLQ-VU-112", 2850, 1750, "Tanda 3"),
    ]
    
    for nombre_mat, codigo, largo_m, ancho_m, notas in datos_lotes:
        existe = db.query(Lote).filter(Lote.codigo_lote == codigo).first()
        
        if not existe:
            # Obtener material_id
            mat = db.query(Material).filter(Material.nombre == nombre_mat).first()
            if not mat:
                print(f"  ✗ Material no encontrado: {nombre_mat}")
                continue
            
            # Convertir metros a milímetros para cálculos
            largo_mm = largo_m * 1000
            ancho_mm = ancho_m * 1000
            
            # Calcular cantidad_inicial (en m²)
            area_m2 = (largo_m * ancho_m)
            
            lote = Lote(
                material_id=mat.id,
                codigo_lote=codigo,
                cantidad_inicial=area_m2,
                stock_actual=area_m2,
                largo_m=largo_m,  # En metros (como está en el modelo)
                ancho_m=ancho_m,  # En metros (como está en el modelo)
                fecha_ingreso=datetime.now().strftime("%Y-%m-%d"),
                notas=notas,
                costo_m2=0.0,
                precio_venta=0.0,
                cantidad=1
            )
            db.add(lote)
            db.flush()
            print(f"  ✓ Lote: {codigo} ({nombre_mat}) - {area_m2:.2f}m²")
        else:
            print(f"  → Lote ya existe: {codigo}")
    
    db.commit()


def seed_placas(db):
    """Crear placas desglosadas por cada lote"""
    datos_placas = [
        ("BLQ-NB-084", "Negro Brasil", "PLC-NB-084-A", 3150, 1850, 20),
        ("BLQ-NB-084", "Negro Brasil", "PLC-NB-084-B", 3150, 1850, 20),
        ("BLQ-NB-084", "Negro Brasil", "PLC-NB-084-C", 3150, 1850, 20),
        ("BLQ-BD-102", "Blanco Dallas", "PLC-BD-102-A", 2950, 1900, 20),
        ("BLQ-BD-102", "Blanco Dallas", "PLC-BD-102-B", 2950, 1900, 20),
        ("BLQ-GM-045", "Gris Mara", "PLC-GM-045-A", 3200, 1800, 20),
        ("BLQ-TRV-015", "Travertino", "PLC-TRV-015-A", 2800, 1600, 20),
        ("BLQ-TRV-015", "Travertino", "PLC-TRV-015-B", 2800, 1600, 20),
        ("BLQ-TRV-015", "Travertino", "PLC-TRV-015-C", 2800, 1600, 20),
        ("BLQ-PB-220", "Purastone Blanco", "PLC-PB-220-A", 3200, 1600, 20),
        ("BLQ-NB-085", "Negro Brasil", "PLC-NB-085-A", 3000, 1850, 20),
        ("BLQ-NB-085", "Negro Brasil", "PLC-NB-085-B", 3000, 1850, 20),
        ("BLQ-CAR-050", "Mármol Carrara", "PLC-CAR-050-A", 2900, 1700, 20),
        ("BLQ-SG-110", "Silestone Gris", "PLC-SG-110-A", 3200, 1600, 20),
        ("BLQ-CB-300", "Cuarzo Blanco", "PLC-CB-300-A", 3100, 1500, 20),
        ("BLQ-CB-300", "Cuarzo Blanco", "PLC-CB-300-B", 3100, 1500, 20),
        ("BLQ-NA-405", "Negro Absoluto", "PLC-NA-405-A", 2900, 1800, 20),
        ("BLQ-NA-405", "Negro Absoluto", "PLC-NA-405-B", 2900, 1800, 20),
        ("BLQ-NA-405", "Negro Absoluto", "PLC-NA-405-C", 2900, 1800, 20),
        ("BLQ-CAL-099", "Calacatta", "PLC-CAL-099-A", 3200, 1600, 20),
        ("BLQ-VU-112", "Verde Ubatuba", "PLC-VU-112-A", 2850, 1750, 20),
        ("BLQ-VU-112", "Verde Ubatuba", "PLC-VU-112-B", 2850, 1750, 20),
    ]
    
    for codigo_lote, nombre_mat, codigo_placa, largo, ancho, espesor in datos_placas:
        existe = db.query(Placa).filter(Placa.codigo == codigo_placa).first()
        
        if not existe:
            # Obtener lote_id y material_id
            lote = db.query(Lote).filter(Lote.codigo_lote == codigo_lote).first()
            mat = db.query(Material).filter(Material.nombre == nombre_mat).first()
            
            if not lote or not mat:
                print(f"  ✗ Lote o material no encontrado para: {codigo_placa}")
                continue
            
            placa = Placa(
                material_id=mat.id,
                lote_id=lote.id,
                codigo=codigo_placa,
                largo=largo,
                ancho=ancho,
                espesor=espesor,
                estado="disponible"
            )
            db.add(placa)
            print(f"  ✓ Placa: {codigo_placa}")
        else:
            print(f"  → Placa ya existe: {codigo_placa}")
    
    db.commit()


def seed_retazos(db):
    """Crear retazos conocidos"""
    datos_retazos = [
        ("BLQ-NB-084", "Negro Brasil", 1100, 600, 20, False),
        ("BLQ-NB-084", "Negro Brasil", 850, 450, 20, True),
        ("BLQ-BD-102", "Blanco Dallas", 1500, 500, 20, False),
        ("BLQ-GM-045", "Gris Mara", 900, 600, 20, True),
        ("BLQ-TRV-015", "Travertino", 1000, 500, 20, True),
        ("BLQ-PB-220", "Purastone Blanco", 1600, 600, 20, False),
        ("BLQ-PB-220", "Purastone Blanco", 800, 400, 20, True),
        ("BLQ-NB-085", "Negro Brasil", 2000, 550, 20, False),
        ("BLQ-CAR-050", "Mármol Carrara", 1200, 400, 20, True),
        ("BLQ-SG-110", "Silestone Gris", 900, 900, 20, False),
        ("BLQ-CAL-099", "Calacatta", 1200, 600, 20, False),
        ("BLQ-NA-405", "Negro Absoluto", 800, 400, 20, True),
        ("BLQ-CB-300", "Cuarzo Blanco", 1500, 450, 20, False),
        ("BLQ-VU-112", "Verde Ubatuba", 900, 700, 20, True),
    ]
    
    contador = 0
    for codigo_lote, nombre_mat, largo, ancho, espesor, en_venta in datos_retazos:
        # Obtener lote_id y material_id
        lote = db.query(Lote).filter(Lote.codigo_lote == codigo_lote).first()
        mat = db.query(Material).filter(Material.nombre == nombre_mat).first()
        
        if not lote or not mat:
            print(f"  ✗ Lote o material no encontrado para retazo: {codigo_lote}")
            continue
        
        # Crear retazo
        retazo = Retazo(
            material_id=mat.id,
            lote_id=lote.id,
            largo=largo,
            ancho=ancho,
            espesor=espesor,
            estado="disponible",
            en_venta=en_venta
        )
        db.add(retazo)
        contador += 1
        print(f"  ✓ Retazo: {codigo_lote} ({largo}×{ancho}mm, en_venta={en_venta})")
    
    db.commit()
    print(f"  Total retazos creados: {contador}")


def main():
    """Ejecutar seed completo"""
    db = SessionLocal()
    
    try:
        print("\n" + "="*60)
        print("SEED: INVENTARIO INICIAL DE MARMOLES")
        print("="*60 + "\n")
        
        print("1. Creando tablas...")
        crear_tablas()
        
        print("\n2. Insertando materiales...")
        seed_materiales(db)
        
        print("\n3. Insertando lotes...")
        seed_lotes(db)
        
        print("\n4. Insertando placas...")
        seed_placas(db)
        
        print("\n5. Insertando retazos...")
        seed_retazos(db)
        
        print("\n" + "="*60)
        print("✓ SEED COMPLETADO EXITOSAMENTE")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
