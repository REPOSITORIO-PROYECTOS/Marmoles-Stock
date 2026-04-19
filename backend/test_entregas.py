import sys
sys.path.insert(0, '/home/agencia/proyectos/marmoles/backend')
from app.db import SessionLocal
from sqlalchemy import text
import json

db = SessionLocal()

# Main query - SAME AS IN ROUTER
sql = text("""
SELECT t.id, t.cliente, t.material_id, t.estado, t.estado_logistica, 
       t.fecha_entrega_programada, t.calificacion_calidad, t.comentarios_calidad, 
       t.fotos_calidad_url, t.prioridad, t.direccion, t.sena_abonada,
       t.encuesta_token, t.encuesta_completada, t.encuesta_completada_fecha,
       t.encuesta_conformidad, t.encuesta_calificacion,
       COUNT(p.id) as total_piezas,
       SUM(CASE WHEN t.estado = 'terminado' THEN 1 ELSE 0 END) as piezas_cortadas
FROM trabajos t
LEFT JOIN piezas_trabajo p ON p.trabajo_id = t.id
WHERE (
    t.estado IN ('terminado', 'en_produccion', 'listo_entrega')
    OR t.estado_logistica != 'pendiente' 
    OR t.fecha_entrega_programada IS NOT NULL
)
GROUP BY t.id, t.cliente, t.material_id, t.estado, t.estado_logistica, 
         t.fecha_entrega_programada, t.calificacion_calidad, t.comentarios_calidad,
         t.fotos_calidad_url, t.prioridad, t.direccion, t.sena_abonada,
         t.encuesta_token, t.encuesta_completada, t.encuesta_completada_fecha,
         t.encuesta_conformidad, t.encuesta_calificacion
ORDER BY t.fecha_entrega_programada NULLS LAST, t.prioridad DESC
""")

rows = db.execute(sql).mappings().all()
print(f"Total rows from query: {len(rows)}")

if rows:
    result = []
    for idx, r in enumerate(rows[:3]):  # Just first 3
        print(f"\n=== Trabajo {idx+1}: {r.id} ===")
        print(f"Cliente: {r.cliente}")
        print(f"Material ID: {r.material_id}")
        
        mat_nombre = "Desconocido"
        try:
            if r.material_id:
                mat_sql = text("SELECT nombre FROM materiales WHERE id = :mid")
                mat = db.execute(mat_sql, {"mid": r.material_id}).mappings().first()
                print(f"Material result: {mat}")
                if mat:
                    mat_nombre = mat.nombre
                    print(f"Got material name: {mat_nombre}")
        except Exception as e:
            print(f"Error getting material: {e}")
        
        # Get piezas
        try:
            piezas_sql = text("""
                SELECT id, nombre, tipo, w, h, qty, estado
                FROM piezas_trabajo
                WHERE trabajo_id = :trabajo_id
                ORDER BY estado DESC, nombre
            """)
            piezas_rows = db.execute(piezas_sql, {"trabajo_id": r.id}).mappings().all()
            print(f"Piezas count: {len(piezas_rows)}")
            for p in piezas_rows[:3]:
                print(f"  - {p.nombre} ({p.estado})")
        except Exception as e:
            print(f"Error getting piezas: {e}")

print(f"\n✓ Test completed")
