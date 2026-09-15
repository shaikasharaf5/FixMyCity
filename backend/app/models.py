from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'citizen', 'officer', 'district_admin', 'state_admin'
    phone_number = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    complaints = relationship("Complaint", back_populates="citizen", foreign_keys="[Complaint.citizen_id]")
    notifications = relationship("Notification", back_populates="user")

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)  # e.g. RND, WSS, WM, EB

    # Relationships
    officers = relationship("Officer", back_populates="department")
    complaints = relationship("Complaint", back_populates="department")

class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    district = Column(String, nullable=False)

    # Relationships
    user = relationship("User")
    department = relationship("Department", back_populates="officers")
    assigned_complaints = relationship("Complaint", back_populates="assigned_officer", foreign_keys="[Complaint.officer_id]")

class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter_phone = Column(String, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    category = Column(String, nullable=False)  # e.g., 'Pothole', 'Garbage', 'Water Leakage', 'Open Manhole', 'Fallen Tree', 'Electric Pole Damage', 'Flooded Road', 'Broken Traffic Sign'
    severity = Column(String, nullable=False)  # 'low', 'medium', 'high', 'critical'
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    district = Column(String, nullable=False)
    ward = Column(String, nullable=False)
    status = Column(String, default="pending")  # 'pending', 'under_review', 'assigned', 'in_progress', 'resolved', 'duplicate'
    
    # Duplicate merging
    duplicate_of_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)
    upvotes = Column(Integer, default=1)
    
    before_image_url = Column(String, nullable=False)
    verified_image_url = Column(String, nullable=True)
    after_image_url = Column(String, nullable=True)
    verification_outcome = Column(String, nullable=True)
    verification_notes = Column(Text, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    proceeded_at = Column(DateTime, nullable=True)
    
    officer_id = Column(Integer, ForeignKey("officers.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    citizen = relationship("User", back_populates="complaints", foreign_keys=[citizen_id])
    department = relationship("Department", back_populates="complaints")
    assigned_officer = relationship("Officer", back_populates="assigned_complaints", foreign_keys=[officer_id])
    
    # Recursive relationship for duplicates
    duplicates = relationship("Complaint", backref="duplicate_of", remote_side=[id])

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notifications")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # e.g., 'CREATE_COMPLAINT', 'RESOLVE_COMPLAINT', 'ASSIGN_OFFICER'
    target_type = Column(String, nullable=False)  # e.g., 'complaint', 'user'
    target_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User")

class WhatsAppSession(Base):
    __tablename__ = "whatsapp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=False)
    state = Column(String, default="idle")  # 'idle', 'awaiting_location'
    last_image_url = Column(String, nullable=True)
    last_media_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TwilioInboundEvent(Base):
    """Idempotency record for Twilio's at-least-once webhook delivery."""
    __tablename__ = "twilio_inbound_events"

    message_sid = Column(String, primary_key=True, index=True)
    sender_phone = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False, default="received")
    complaint_id = Column(Integer, ForeignKey("complaints.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CommunityPost(Base):
    __tablename__ = "community_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # 'missing_person', 'lost_found', 'blood_donation', 'volunteer', 'community_event', 'community_problem'
    contact_info = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    status = Column(String, default="pending")  # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationship
    user = relationship("User")
