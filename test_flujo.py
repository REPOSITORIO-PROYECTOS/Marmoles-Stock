#!/usr/bin/env python3
"""
Script de test para flujo completo:
1. Aceptar presupuesto
2. Crear trabajo desde presupuesto
3. Registrar pago (40%+)
4. Verificar ingreso automático a producción
5. Verificar en lista de pendientes
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8020"
PRESUPUESTO_ID = "8c85c411-66f1-4db7-bed0-f45523d83ffa"
CLIENTE_ID = "f69148b9-9a55-4358-b9e3-26173f1b479c"
TOTAL = 74000
MONTO_PAGO = 29600  # 40% aprox

# Intentar conectar sin autenticación primero
headers = {
    "Content-Type": "application/json",
}

print("=" * 60)
print("TEST FLUJO COMPLETO: PAGO → PRODUCCIÓN")
print("=" * 60)

# Paso 1: Aceptar presupuesto
print("\n1️⃣  ACEPTANDO PRESUPUESTO...")
try:
    resp = requests.put(
        f"{BASE_URL}/api/finanzas/presupuestos/{PRESUPUESTO_ID}/aceptar",
        headers=headers,
        timeout=5
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        print(f"   ✅ Presupuesto aceptado: {resp.json()}")
    else:
        print(f"   ❌ Error: {resp.text}")
except Exception as e:
    print(f"   ❌ Error de conexión: {e}")
    sys.exit(1)

# Paso 2: Crear trabajo desde presupuesto
print("\n2️⃣  CREANDO TRABAJO DESDE PRESUPUESTO...")
try:
    resp = requests.post(
        f"{BASE_URL}/api/trabajos/desde-presupuesto/{PRESUPUESTO_ID}",
        headers=headers,
        json={},
        timeout=5
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        trabajo_data = resp.json()
        print(f"   ✅ Trabajo creado: {trabajo_data}")
        TRABAJO_ID = trabajo_data.get("id")
    else:
        print(f"   ❌ Error: {resp.text}")
        TRABAJO_ID = None
except Exception as e:
    print(f"   ❌ Error: {e}")
    TRABAJO_ID = None

# Paso 3: Registrar pago
print(f"\n3️⃣  REGISTRANDO PAGO ({MONTO_PAGO} ARS de {TOTAL} ARS)...")
try:
    resp = requests.post(
        f"{BASE_URL}/api/finanzas/pagos",
        headers=headers,
        json={
            "presupuesto_id": PRESUPUESTO_ID,
            "cliente_id": CLIENTE_ID,
            "monto": MONTO_PAGO,
            "metodo_pago": "transferencia",
            "referencia": "TEST-20FEB2026",
            "nota": "Pago de prueba - verificar flujo automático"
        },
        timeout=5
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        pago_data = resp.json()
        print(f"   ✅ Pago registrado: {pago_data}")
    else:
        print(f"   ❌ Error: {resp.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Paso 4: Verificar estado del trabajo
print("\n4️⃣  VERIFICANDO ESTADO DEL TRABAJO...")
if TRABAJO_ID:
    try:
        resp = requests.get(
            f"{BASE_URL}/api/trabajos/{TRABAJO_ID}/detalle",
            headers=headers,
            timeout=5
        )
        print(f"   Status: {resp.status_code}")
        if resp.status_code == 200:
            trabajo = resp.json()
            print(f"   ✅ Estado: {trabajo.get('trabajo', {}).get('estado')}")
            print(f"   Seña abonada: {trabajo.get('trabajo', {}).get('sena_abonada')}")
            print(f"   En acumulador: {trabajo.get('trabajo', {}).get('acumulado_id')}")
        else:
            print(f"   ❌ Error: {resp.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

# Paso 5: Verificar en lista de trabajos
print("\n5️⃣  VERIFICANDO EN LISTA DE TRABAJOS...")
try:
    resp = requests.get(
        f"{BASE_URL}/api/trabajos",
        headers=headers,
        timeout=5
    )
    print(f"   Status: {resp.status_code}")
    if resp.status_code == 200:
        trabajos = resp.json()
        # Buscar nuestro trabajo
        for t in trabajos:
            if t.get("presupuesto_id") == PRESUPUESTO_ID:
                print(f"   ✅ Trabajo encontrado en lista:")
                print(f"      ID: {t.get('id')}")
                print(f"      Estado: {t.get('estado')}")
                print(f"      Seña abonada: {t.get('sena_abonada')}")
                break
        else:
            print(f"   ⚠️  Trabajo no encontrado en lista")
    else:
        print(f"   ❌ Error: {resp.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 60)
print("TEST COMPLETADO")
print("=" * 60)
