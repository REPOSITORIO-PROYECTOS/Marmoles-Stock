import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'test.db'))
print('DB', db_path, os.path.exists(db_path))
con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute('PRAGMA table_info(pagos)')
cols = cur.fetchall()
print("Table: pagos")
for c in cols:
    print(c)
con.close()

