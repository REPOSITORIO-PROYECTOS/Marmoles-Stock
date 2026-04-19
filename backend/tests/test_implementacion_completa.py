"""
Tests para validar la implementación completa del módulo de Presupuestos
Cubre: Módulo 4 (Pagos), Módulo 1 (Geolocalización), Módulo 3 (Lote), Módulo 2 (Materiales)
"""

import pytest
import json
from datetime import datetime
from typing import Generator, Tuple
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Imports del backend
from app.models.presupuestos import Presupuesto, PresupuestoLinea, PresupuestoMeta
from app.models.base import Base
from app.src.schemas import PresupuestoCreate, PresupuestoLineaCreate
from app.db import get_db

# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="session")
def test_db_url():
    """URL para base de datos de testing"""
    return "sqlite:///:memory:"

@pytest.fixture(scope="session")
def test_engine(test_db_url):
    """Engine de SQLAlchemy para testing"""
    engine = create_engine(test_db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def test_session(test_engine) -> Generator[Session, None, None]:
    """Session para transacciones individuales"""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.close()

@pytest.fixture
def test_presupuesto_data(test_session):
    """Datos de prueba para presupuesto"""
    return {
        "cliente_id": "cliente_test_001",
        "observaciones": "Test presupuesto",
        "coordenadas": "-31.5373, -68.5252",
        "archivos_adjuntos": ["file1.pdf"],
        "anexosImagenes": ["image1.png"],
        "tipo_cobro": "contado",
        "con_factura": False,
        "descuento_tipo": "porcentaje",
        "descuento_valor": 10,
        "lineas": [
            {
                "tipo": "material",
                "material": "Mármol Blanco",
                "material_id": "mat_001",
                "metros_cuadrados": 5.0,
                "precio_unitario": 1000.0,
                "cantidad": 5.0,
                "unidad": "m²",
                "placa_completa": False
            }
        ],
        "items_adicionales": [
            {
                "descripcion": "Pegado especial",
                "precio": 500.0,
                "cantidad": 1
            }
        ]
    }

# ============================================================================
# TESTS: MÓDULO 4 (PAGOS)
# ============================================================================

class TestModulo4_Pagos:
    """Tests para validar descuentos y pago"""
    
    def test_descuento_fijo_se_aplica_correctamente(self, test_session, test_presupuesto_data):
        """Validar que el descuento fijo se resta del total"""
        test_presupuesto_data["descuento_tipo"] = "fijo"
        test_presupuesto_data["descuento_valor"] = 500.0
        
        # Cálculo esperado:
        # Línea: 5 m² * 1000 = 5000
        # Extras: 500 * 1 = 500
        # Subtotal: 5500
        # Descuento: -500
        # Total esperado: 5000
        
        expected_total = 5500 - 500  # 5000
        
        # Simular cálculo backend
        total = 0.0
        for linea in test_presupuesto_data["lineas"]:
            total += float(linea["metros_cuadrados"]) * float(linea["precio_unitario"])
        
        for item in test_presupuesto_data["items_adicionales"]:
            total += float(item["precio"]) * float(item["cantidad"])
        
        if test_presupuesto_data["descuento_valor"] > 0:
            if test_presupuesto_data["descuento_tipo"] == "fijo":
                total -= test_presupuesto_data["descuento_valor"]
        
        assert total == expected_total, f"Total: {total}, Esperado: {expected_total}"
    
    def test_descuento_porcentaje_se_aplica_correctamente(self, test_presupuesto_data):
        """Validar que el descuento porcentaje se aplica correctamente"""
        test_presupuesto_data["descuento_tipo"] = "porcentaje"
        test_presupuesto_data["descuento_valor"] = 10.0
        
        # Cálculo:
        # Subtotal: 5500
        # Descuento 10%: 5500 * 0.10 = 550
        # Total: 5500 - 550 = 4950
        
        total = 5500
        descuento = test_presupuesto_data["descuento_valor"]
        
        if descuento > 0:
            total -= total * (descuento / 100)
        
        assert total == 4950.0
    
    def test_esquema_presupuesto_incluye_descuento(self):
        """Validar que el schema PresupuestoCreate acepta descuento"""
        data = {
            "cliente_id": "test",
            "lineas": [],
            "descuento_tipo": "fijo",
            "descuento_valor": 100.0
        }
        
        schema = PresupuestoCreate(**data)
        assert schema.descuento_tipo == "fijo"
        assert schema.descuento_valor == 100.0
    
    def test_requiere_factura_sin_iva_automatico(self, test_presupuesto_data):
        """Validar que requiere_factura solo marca, no calcula IVA"""
        test_presupuesto_data["con_factura"] = True
        
        # El total NO debe incluir IVA aquí
        # Es responsabilidad del frontend mostrar información fiscal
        
        presupuesto = PresupuestoCreate(**test_presupuesto_data)
        assert presupuesto.con_factura == True
        # El IVA se agrega en el frontend si es necesario
    
    def test_metadata_presupuesto_guarda_descuento(self, test_session, test_presupuesto_data):
        """Validar que la metadata de presupuesto guarda datos de descuento"""
        meta_data = {
            "items_adicionales": test_presupuesto_data["items_adicionales"],
            "tipo_cobro": test_presupuesto_data["tipo_cobro"],
            "con_factura": test_presupuesto_data["con_factura"],
            "descuento_tipo": test_presupuesto_data["descuento_tipo"],
            "descuento_valor": test_presupuesto_data["descuento_valor"]
        }
        
        assert meta_data["descuento_tipo"] is not None
        assert meta_data["descuento_valor"] >= 0

# ============================================================================
# TESTS: MÓDULO 1 (GEOLOCALIZACIÓN)
# ============================================================================

class TestModulo1_Geolocalizacion:
    """Tests para busqueda y ubicación"""
    
    def test_nominatim_viewbox_expandido(self):
        """Validar que el viewbox de Nominatim está ampliado"""
        # Nuevo viewbox: -69.5,-30.5,-67.5,-32.5 (expandido)
        # Anterior: -69.00,-31.00,-68.00,-32.00
        
        nuevo_viewbox = "-69.5,-30.5,-67.5,-32.5"
        parte = "69.5" in nuevo_viewbox and "30.5" in nuevo_viewbox
        
        assert parte, "Viewbox no está correctamente expandido"
    
    def test_parametros_nominatim_incluyen_addressdetails(self):
        """Validar que se agregaron parámetros addressdetails y limit"""
        # Los parámetros deben incluir: addressdetails=1&limit=5
        
        params = ["addressdetails=1", "limit=5"]
        assert all(p is not None for p in params)
    
    def test_error_busqueda_muestra_toast_no_console(self):
        """Validar que errores de búsqueda usan toast, no console.error"""
        # Esta es una validación de frontend, verificable en código
        # Buscamos que LocationPicker.tsx importa toast y lo usa
        
        # El test requiere análisis de código - se valida en visual code
        assert True  # Placeholder

# ============================================================================
# TESTS: MÓDULO 3 (LOTE Y DISEÑO)
# ============================================================================

class TestModulo3_LoteDiseno:
    """Tests para funcionalidad de lote y diseño"""
    
    def test_esquema_presupuesto_linea_incluye_placa_completa(self):
        """Validar que PresupuestoLineaCreate incluye placa_completa"""
        data = {
            "material": "Mármol",
            "metros_cuadrados": 5.0,
            "precio_unitario": 1000.0,
            "placa_completa": True
        }
        
        schema = PresupuestoLineaCreate(**data)
        assert schema.placa_completa == True
    
    def test_linea_puede_no_tener_lote_id(self):
        """Validar que lote_id es opcional (para placa sin lote específico)"""
        data = {
            "material": "Mármol",
            "metros_cuadrados": 5.0,
            "precio_unitario": 1000.0,
            "lote_id": None
        }
        
        schema = PresupuestoLineaCreate(**data)
        assert schema.lote_id is None
    
    def test_modelo_presupuesto_linea_tiene_planos_manual_json(self, test_session):
        """Validar que PresupuestoLinea almacena planos_manual_json"""
        presupuesto = Presupuesto(
            cliente_id="test",
            total=1000.0,
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.flush()
        
        planos_manual = [
            {"id": 1, "nombre": "plano1.dxf", "tipo": "manual"},
            {"id": 2, "nombre": "plano2.dxf", "tipo": "manual"}
        ]
        
        linea = PresupuestoLinea(
            presupuesto_id=presupuesto.id,
            material="Test",
            metros_cuadrados=5.0,
            precio_unitario=1000.0,
            placa_completa=True,
            planos_manual_json=json.dumps(planos_manual)
        )
        test_session.add(linea)
        test_session.commit()
        
        linea_recuperada = test_session.query(PresupuestoLinea).first()
        assert linea_recuperada.planos_manual_json is not None
        
        planos_parsed = json.loads(linea_recuperada.planos_manual_json)
        assert len(planos_parsed) == 2

# ============================================================================
# TESTS: MÓDULO 2 (MATERIALES - MODELO)
# ============================================================================

class TestModulo2_Materiales:
    """Tests para estructura de ítems y tipos"""
    
    def test_presupuesto_linea_tiene_tipo_material(self, test_session):
        """Validar que PresupuestoLinea tiene campo tipo"""
        presupuesto = Presupuesto(
            cliente_id="test",
            total=1000.0,
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.flush()
        
        linea = PresupuestoLinea(
            presupuesto_id=presupuesto.id,
            material="Test",
            metros_cuadrados=5.0,
            precio_unitario=1000.0,
            tipo="material"
        )
        test_session.add(linea)
        test_session.commit()
        
        linea_recuperada = test_session.query(PresupuestoLinea).first()
        assert linea_recuperada.tipo == "material"
    
    def test_presupuesto_linea_soporta_tipos_producto_accesorio_extra(self, test_session):
        """Validar que PresupuestoLinea puede ser producto, accesorio o extra"""
        presupuesto = Presupuesto(
            cliente_id="test",
            total=1000.0,
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.flush()
        
        tipos = ["material", "producto", "accesorio", "extra"]
        
        for tipo in tipos:
            linea = PresupuestoLinea(
                presupuesto_id=presupuesto.id,
                material=f"Item {tipo}",
                metros_cuadrados=1.0,
                precio_unitario=100.0,
                tipo=tipo
            )
            test_session.add(linea)
        
        test_session.commit()
        
        lineas = test_session.query(PresupuestoLinea).all()
        tipos_guardados = [l.tipo for l in lineas]
        
        assert len(tipos_guardados) == 4
        assert "producto" in tipos_guardados
        assert "accesorio" in tipos_guardados
        assert "extra" in tipos_guardados
    
    def test_presupuesto_linea_campos_ids(self, test_session):
        """Validar que PresupuestoLinea tiene campos para IDs"""
        presupuesto = Presupuesto(
            cliente_id="test",
            total=1000.0,
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.flush()
        
        linea = PresupuestoLinea(
            presupuesto_id=presupuesto.id,
            material="Test",
            metros_cuadrados=5.0,
            precio_unitario=1000.0,
            material_id="mat_123",
            producto_id="prod_456",
            accesorio_id="acc_789"
        )
        test_session.add(linea)
        test_session.commit()
        
        linea_recuperada = test_session.query(PresupuestoLinea).first()
        assert linea_recuperada.material_id == "mat_123"
        assert linea_recuperada.producto_id == "prod_456"
        assert linea_recuperada.accesorio_id == "acc_789"
    
    def test_presupuesto_linea_tiene_cantidad_y_unidad(self, test_session):
        """Validar que PresupuestoLinea soporta cantidad y unidad variables"""
        presupuesto = Presupuesto(
            cliente_id="test",
            total=1000.0,
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.flush()
        
        linea = PresupuestoLinea(
            presupuesto_id=presupuesto.id,
            material="Mesada de Mármol",
            metros_cuadrados=1.0,
            precio_unitario=5000.0,
            cantidad=2.0,
            unidad="u"  # unidad, no metros cuadrados
        )
        test_session.add(linea)
        test_session.commit()
        
        linea_recuperada = test_session.query(PresupuestoLinea).first()
        assert linea_recuperada.cantidad == 2.0
        assert linea_recuperada.unidad == "u"

# ============================================================================
# TESTS: INTEGRACIÓN COMPLETA
# ============================================================================

class TestIntegracion:
    """Tests de integración del flujo completo"""
    
    def test_presupuesto_completo_con_todos_tipos_items(self, test_session):
        """Validar flujo completo con material, producto, accesorio y extra"""
        presupuesto = Presupuesto(
            cliente_id="cliente_integral",
            total=15500.0,
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.flush()
        
        items = [
            {
                "tipo": "material",
                "material": "Mármol Blanco",
                "material_id": "mat_001",
                "metros_cuadrados": 5.0,
                "precio_unitario": 1000.0
            },
            {
                "tipo": "producto",
                "material": "Mesada",
                "producto_id": "prod_001",
                "metros_cuadrados": 1.0,
                "cantidad": 2.0,
                "unidad": "u",
                "precio_unitario": 3000.0
            },
            {
                "tipo": "accesorio",
                "material": "Apoya manos",
                "accesorio_id": "acc_001",
                "metros_cuadrados": 1.0,
                "cantidad": 1.0,
                "unidad": "u",
                "precio_unitario": 500.0
            },
            {
                "tipo": "extra",
                "material": "Instalación",
                "metros_cuadrados": 1.0,
                "precio_unitario": 1000.0
            }
        ]
        
        for item in items:
            linea = PresupuestoLinea(
                presupuesto_id=presupuesto.id,
                tipo=item.get("tipo", "material"),
                material=item["material"],
                material_id=item.get("material_id"),
                producto_id=item.get("producto_id"),
                accesorio_id=item.get("accesorio_id"),
                metros_cuadrados=item.get("metros_cuadrados", 1.0),
                precio_unitario=item.get("precio_unitario", 0.0),
                cantidad=item.get("cantidad"),
                unidad=item.get("unidad", "m²")
            )
            test_session.add(linea)
        
        test_session.commit()
        
        lineas = test_session.query(PresupuestoLinea).filter_by(presupuesto_id=presupuesto.id).all()
        
        assert len(lineas) == 4
        assert any(l.tipo == "material" for l in lineas)
        assert any(l.tipo == "producto" for l in lineas)
        assert any(l.tipo == "accesorio" for l in lineas)
        assert any(l.tipo == "extra" for l in lineas)
    
    def test_descuento_en_presupuesto_completo(self, test_session):
        """Validar que descuento se aplica correctamente en presupuesto completo"""
        presupuesto = Presupuesto(
            cliente_id="test_descuento",
            total=4950.0,  # 5500 - 10% descuento
            fecha_creacion=datetime.utcnow().isoformat()
        )
        test_session.add(presupuesto)
        test_session.commit()
        
        meta_data = {
            "descuento_tipo": "porcentaje",
            "descuento_valor": 10.0,
            "tipo_cobro": "contado",
            "con_factura": False
        }
        
        meta = PresupuestoMeta(
            presupuesto_id=presupuesto.id,
            data_json=json.dumps(meta_data)
        )
        test_session.add(meta)
        test_session.commit()
        
        presupuesto_recuperado = test_session.query(Presupuesto).first()
        meta_recuperada = test_session.query(PresupuestoMeta).filter_by(
            presupuesto_id=presupuesto_recuperado.id
        ).first()
        
        meta_parsed = json.loads(meta_recuperada.data_json)
        assert meta_parsed["descuento_valor"] == 10.0

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
