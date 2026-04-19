import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'test.db'))
con = sqlite3.connect(db_path)
cur = con.cursor()
stmts = [
    "ALTER TABLE materiales ADD COLUMN stock_actual FLOAT DEFAULT 0.0",
    "ALTER TABLE materiales ADD COLUMN unidad VARCHAR(16) DEFAULT 'm²'",
    "ALTER TABLE materiales ADD COLUMN stock_minimo FLOAT DEFAULT 0.0",
    "ALTER TABLE materiales ADD COLUMN ultima_actualizacion VARCHAR(64)",
]
for s in stmts:
    try:
        cur.execute(s)
        print("OK:", s)
    except Exception as e:
        print("SKIP:", s, e)
con.commit()
cur.execute('PRAGMA table_info(materiales)')
print(cur.fetchall())
con.close()

