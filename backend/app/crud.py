from sqlalchemy.orm import Session
from datetime import datetime
from . import models, schemas
from .auth import get_password_hash

# --- User CRUD ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        phone_number=user.phone_number
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Department CRUD ---
def get_department(db: Session, dept_id: int):
    return db.query(models.Department).filter(models.Department.id == dept_id).first()

def get_department_by_name(db: Session, name: str):
    return db.query(models.Department).filter(models.Department.name == name).first()

def get_department_by_code(db: Session, code: str):
    return db.query(models.Department).filter(models.Department.code == code).first()

def get_departments(db: Session):
    return db.query(models.Department).all()

def create_department(db: Session, dept: schemas.DepartmentCreate):
    db_dept = models.Department(name=dept.name, code=dept.code)
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept

# --- Officer CRUD ---
def get_officer(db: Session, officer_id: int):
    return db.query(models.Officer).filter(models.Officer.id == officer_id).first()

def get_officer_by_user_id(db: Session, user_id: int):
    return db.query(models.Officer).filter(models.Officer.user_id == user_id).first()

def get_officers(db: Session, district: str = None):
    query = db.query(models.Officer)
    if district:
        query = query.filter(models.Officer.district == district)
    return query.all()

def create_officer(db: Session, officer: schemas.OfficerCreate):
    db_officer = models.Officer(
        user_id=officer.user_id,
        department_id=officer.department_id,
        district=officer.district
    )
    db.add(db_officer)
    db.commit()
    db.refresh(db_officer)
    return db_officer

# --- Complaint CRUD ---
def get_complaint(db: Session, complaint_id: int):
    return db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()

def get_complaints(
    db: Session, 
    status: str = None, 
    department_id: int = None, 
    officer_id: int = None, 
    citizen_id: int = None, 
    district: str = None,
    category: str = None
):
    query = db.query(models.Complaint)
    if status:
        query = query.filter(models.Complaint.status == status)
    if department_id:
        query = query.filter(models.Complaint.department_id == department_id)
    if officer_id:
        query = query.filter(models.Complaint.officer_id == officer_id)
    if citizen_id:
        query = query.filter(models.Complaint.citizen_id == citizen_id)
    if district:
        # Case insensitive check for SQLite
        query = query.filter(models.Complaint.district.ilike(district))
    if category:
        query = query.filter(models.Complaint.category == category)
    
    # Sort by created_at descending
    return query.order_by(models.Complaint.created_at.desc()).all()

def create_complaint(db: Session, complaint: schemas.ComplaintCreate, citizen_id: int, severity: str, department_id: int, description: str):
    db_complaint = models.Complaint(
        citizen_id=citizen_id,
        department_id=department_id,
        category=complaint.category,
        severity=severity,
        description=description,
        latitude=complaint.latitude,
        longitude=complaint.longitude,
        district=complaint.district,
        ward=complaint.ward,
        before_image_url=complaint.before_image_url,
        status="pending"
    )
    db.add(db_complaint)
    db.commit()
    db.refresh(db_complaint)
    return db_complaint

def update_complaint(db: Session, db_complaint: models.Complaint, update_data: schemas.ComplaintUpdate):
    for key, value in update_data.model_dump(exclude_unset=True).items():
        if key == 'work_notes':
            continue  # Work notes are retained in the audit record.
        setattr(db_complaint, key, value)
    
    db_complaint.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_complaint)
    return db_complaint

def upvote_complaint(db: Session, db_complaint: models.Complaint):
    db_complaint.upvotes += 1
    db_complaint.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_complaint)
    return db_complaint

# --- Notification CRUD ---
def get_notifications(db: Session, user_id: int):
    return db.query(models.Notification).filter(
        models.Notification.user_id == user_id
    ).order_by(models.Notification.created_at.desc()).all()

def create_notification(db: Session, user_id: int, title: str, message: str):
    db_notif = models.Notification(
        user_id=user_id,
        title=title,
        message=message
    )
    db.add(db_notif)
    db.commit()
    db.refresh(db_notif)
    return db_notif

def mark_notification_read(db: Session, notif_id: int, user_id: int):
    db_notif = db.query(models.Notification).filter(
        models.Notification.id == notif_id,
        models.Notification.user_id == user_id
    ).first()
    if db_notif:
        db_notif.is_read = True
        db.commit()
        db.refresh(db_notif)
    return db_notif

# --- Audit Log ---
def create_audit_log(db: Session, user_id: int, action: str, target_type: str, target_id: int = None, details: str = None):
    db_log = models.AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    db.add(db_log)
    db.commit()
    return db_log

# --- WhatsApp Sessions CRUD ---
def get_whatsapp_session(db: Session, phone_number: str):
    return db.query(models.WhatsAppSession).filter(models.WhatsAppSession.phone_number == phone_number).first()

def create_or_update_whatsapp_session(db: Session, phone_number: str, state: str, last_image_url: str = None, last_media_id: str = None):
    session = get_whatsapp_session(db, phone_number)
    if not session:
        session = models.WhatsAppSession(phone_number=phone_number, state=state, last_image_url=last_image_url, last_media_id=last_media_id)
        db.add(session)
    else:
        session.state = state
        if last_image_url is not None:
            session.last_image_url = last_image_url
        if last_media_id is not None:
            session.last_media_id = last_media_id
    db.commit()
    db.refresh(session)
    return session
