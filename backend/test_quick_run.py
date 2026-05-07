#!/usr/bin/env python
"""
Quick test runner para validar test_implementacion_completa.py
"""
import subprocess
import sys

def main():
    print("=" * 70)
    print("  VALIDACIÓN RÁPIDA DE TESTS CREADOS")
    print("=" * 70)
    print()
    
    # Intentar ejecutar pytest
    print("[1] Ejecutando Backend Tests...")
    print("-" * 70)
    
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_implementacion_completa.py", "-v", "--tb=short"],
        capture_output=False
    )
    
    print()
    print("=" * 70)
    if result.returncode == 0:
        print("✅ Backend Tests EXITOSOS")
    else:
        print(f"❌ Backend Tests FALLARON (Exit code: {result.returncode})")
    print("=" * 70)
    
    return result.returncode

if __name__ == "__main__":
    sys.exit(main())
