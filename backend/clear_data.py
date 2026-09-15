from app.database import SessionLocal
from app import models

def clear_data():
    db = SessionLocal()
    try:
        print("Clearing complaints...")
        db.query(models.Complaint).delete()
        print("Clearing notifications...")
        db.query(models.Notification).delete()
        print("Clearing audit logs...")
        db.query(models.AuditLog).delete()
        print("Clearing WhatsApp sessions...")
        db.query(models.WhatsAppSession).delete()
        db.commit()
        print("Successfully cleared all complaints, notifications, audit logs, and sessions.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clear_data()
