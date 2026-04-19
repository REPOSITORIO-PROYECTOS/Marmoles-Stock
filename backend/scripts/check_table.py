import sqlite3
import os

def check_presupuestos_table():
    db_path = "backend/app.db" # Ajustar si la ruta es diferente
    if not os.path.exists(db_path):
        db_path = "app.db"
    
    if not os.path.exists(db_path):
        print(f"No se encontró la base de datos en {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Obtener columnas de presupuestos
        cursor.execute("PRAGMA table_info(presupuestos)")
        columns = cursor.fetchall()
        print("\nColumnas en tabla 'presupuestos':")
        for col in columns:
            print(f"- {col[1]} ({col[2]})")
            
        # Intentar una consulta simple
        cursor.execute("SELECT * FROM presupuestos LIMIT 1")
        row = cursor.fetchone()
        print(f"\nFila de prueba: {row}")
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_presupuestos_table()
