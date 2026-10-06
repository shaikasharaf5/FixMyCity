from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

# --- Auth Schemas ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "citizen"  # 'citizen', 'officer', 'district_admin', 'state_admin'
    phone_number: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    phone_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- Department Schemas ---
class DepartmentCreate(BaseModel):
    name: str
    code: str

class DepartmentOut(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True

# --- Officer Schemas ---
class OfficerCreate(BaseModel):
    user_id: int
    department_id: int
    district: str

class OfficerOut(BaseModel):
    id: int
    user: UserOut
    department: DepartmentOut
    district: str

    class Config:
        from_attributes = True

# --- Complaint Schemas ---
class ComplaintCreate(BaseModel):
    category: str
    latitude: float
    longitude: float
    description: Optional[str] = None  # AI will override if auto-generated, or extend
    district: str
    ward: str
    before_image_url: str
    reporter_phone: Optional[str] = None

class ComplaintUpdate(BaseModel):
    work_notes: Optional[str] = None
    status: Optional[str] = None  # 'pending', 'under_review', 'assigned', 'in_progress', 'resolved', 'duplicate'
    officer_id: Optional[int] = None
    after_image_url: Optional[str] = None
    verified_image_url: Optional[str] = None
    duplicate_of_id: Optional[int] = None

class ComplaintOut(BaseModel):
    id: int
    citizen_id: Optional[int] = None
    citizen: Optional[UserOut] = None
    department_id: Optional[int] = None
    department: Optional[DepartmentOut] = None
    category: str
    severity: str
    description: str
    latitude: float
    longitude: float
    district: str
    ward: str
    status: str
    duplicate_of_id: Optional[int] = None
    upvotes: int
    before_image_url: str
    verified_image_url: Optional[str] = None
    after_image_url: Optional[str] = None
    verification_outcome: Optional[str] = None
    verification_notes: Optional[str] = None
    verified_at: Optional[datetime] = None
    proceeded_at: Optional[datetime] = None
    reporter_phone: Optional[str] = None
    officer_id: Optional[int] = None
    assigned_officer: Optional[OfficerOut] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ComplaintFeedComment(BaseModel):
    id: int
    user_id: int
    username: str
    content: str
    created_at: datetime

class ComplaintFeedItem(BaseModel):
    id: int
    category: str
    severity: str
    description: str
    district: str
    ward: str
    status: str
    before_image_url: str
    created_at: datetime
    author: str
    like_count: int
    comment_count: int
    share_count: int
    liked_by_me: bool
    comments: List[ComplaintFeedComment]

class ComplaintCommentCreate(BaseModel):
    content: str

# --- Notification Schemas ---
class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Analytics Schemas ---
class PerformanceMetric(BaseModel):
    department_name: str
    resolved_count: int
    avg_resolution_time_days: float

class StatusDistribution(BaseModel):
    status: str
    count: int

class CategoryDistribution(BaseModel):
    category: str
    count: int

class DistrictAnalytics(BaseModel):
    district_name: str
    pending_count: int
    resolved_count: int
    critical_count: int
    department_performance: List[PerformanceMetric]
    status_distribution: List[StatusDistribution]
    category_distribution: List[CategoryDistribution]

class CommunityPostCreate(BaseModel):
    title: str
    content: str
    category: str
    contact_info: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = "pending"

class CommunityPostOut(BaseModel):
    id: int
    title: str
    content: str
    category: str
    contact_info: Optional[str] = None
    image_url: Optional[str] = None
    status: str
    created_at: datetime
    user_id: Optional[int] = None
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True
