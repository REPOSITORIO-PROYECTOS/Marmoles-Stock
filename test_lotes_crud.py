#!/usr/bin/env python3
"""
Test script para verificar que los CRUD operations para lotes funcionan correctamente
"""
import requests
import json

BASE_URL = "http://localhost:8000"
HEADERS = {"Content-Type": "application/json"}

# Headers con token de admin si está disponible
# Por ahora sin token para test local

def test_lotes_flow():
    print("=" * 60)
    print("TEST: CRUD de Lotes")
    print("=" * 60)
    
    # 1. Obtener lista de lotes existentes
    print("\n1. GET /api/lotes")
    try:
        resp = requests.get(f"{BASE_URL}/api/lotes")
        if resp.status_code == 200:
            lotes = resp.json()
            print(f"✓ Se obtuvieron {len(lotes)} lotes")
            if lotes:
                print(f"  Primer lote: {lotes[0]['id']} - {lotes[0]['codigo_lote']}")
                test_lote_id = lotes[0]['id']
                
                # 2. Actualizar el primer lote (PATCH)
                print(f"\n2. PATCH /api/lotes/{test_lote_id}")
                update_data = {
                    "ubicacion": "Almacén Principal - Estante A",
                    "costo_m2": 150.50,
                    "precio_venta": 200.00,
                    "precio_mayorista": 180.00
                }
                print(f"  Datos enviados: {json.dumps(update_data, indent=2)}")
                
                resp = requests.patch(
                    f"{BASE_URL}/api/lotes/{test_lote_id}",
                    json=update_data,
                    headers=HEADERS
                )
                if resp.status_code == 200:
                    result = resp.json()
                    print(f"✓ Lote actualizado exitosamente")
                    print(f"  Ubicación: {result.get('ubicacion')}")
                    print(f"  Costo m²: ${result.get('costo_m2')}")
                    print(f"  Precio Venta: ${result.get('precio_venta')}")
                    print(f"  Precio Mayorista: ${result.get('precio_mayorista')}")
                    
                    # 3. Verificar que se guardó correctamente (GET individual)
                    print(f"\n3. GET /api/lotes/{test_lote_id}")
                    resp = requests.get(f"{BASE_URL}/api/lotes/{test_lote_id}")
                    if resp.status_code == 200:
                        lote = resp.json()
                        print(f"✓ Lote recuperado después de actualizar")
                        print(f"  Ubicación: {lote.get('ubicacion')}")
                        print(f"  Costo m²: ${lote.get('costo_m2')}")
                        print(f"  Precio Venta: ${lote.get('precio_venta')}")
                        print(f"  Precio Mayorista: ${lote.get('precio_mayorista')}")
                        
                        # Verificar que los datos se guardaron correctamente
                        assert lote.get('ubicacion') == "Almacén Principal - Estante A", "Ubicación no se guardó"
                        assert lote.get('costo_m2') == 150.50, "Costo m² no se guardó"
                        assert lote.get('precio_venta') == 200.00, "Precio Venta no se guardó"
                        assert lote.get('precio_mayorista') == 180.00, "Precio Mayorista no se guardó"
                        print("\n✓ TODOS LOS DATOS SE GUARDARON CORRECTAMENTE EN LA BD")
                    else:
                        print(f"✗ Error al recuperar lote: {resp.status_code}")
                        print(f"  Respuesta: {resp.text}")
                else:
                    print(f"✗ Error al actualizar lote: {resp.status_code}")
                    print(f"  Respuesta: {resp.text}")
        else:
            print(f"✗ Error al obtener lotes: {resp.status_code}")
    except Exception as e:
        print(f"✗ Excepción: {e}")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETADO")
    print("=" * 60)

if __name__ == "__main__":
    test_lotes_flow()
