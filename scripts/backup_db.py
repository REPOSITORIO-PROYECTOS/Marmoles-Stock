import shutil
import datetime
import os

DB_PATH = "backend/dev.db"
BACKUP_DIR = "backups"

def backup_database():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(BACKUP_DIR, f"dev_backup_{timestamp}.db")
    
    shutil.copy2(DB_PATH, backup_path)
    print(f"Backup created at: {backup_path}")

    # Rotate: keep last 5
    backups = sorted([os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if f.startswith("dev_backup_")])
    if len(backups) > 5:
        for old in backups[:-5]:
            os.remove(old)
            print(f"Removed old backup: {old}")

if __name__ == "__main__":
    backup_database()
