import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Response, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import httpx
import time
import re
import json
from datetime import datetime
from starlette.concurrency import run_in_threadpool

from ..database import get_db
from .. import crud, schemas, models, auth
from ..ai import detector, duplicates, generator
from .ws import manager

logger = logging.getLogger("civicsense.routers.complaints")

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/simulator-upload")
async def simulator_upload_image(file: UploadFile = File(...)):
    """
    Receives a real image upload from the simulator and saves it locally.
    """
    file_ext = os.path.splitext(file.filename)[1] or ".jpg"
    unique_filename = f"whatsapp_simulated_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"/uploads/{unique_filename}", "media_id": f"temp_{unique_filename}"}
    except Exception as e:
        logger.error(f"Simulator image upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save simulator image.")

@router.post("/config")
async def update_whatsapp_config(payload: dict):
    """
    Dynamically updates the WhatsApp token in memory and writes it to the .env file.
    """
    token = payload.get("whatsapp_access_token")
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
        
    # 1. Update os.environ in memory
    os.environ["WHATSAPP_ACCESS_TOKEN"] = token
    
    # 2. Update .env file permanently
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    lines = []
    token_updated = False
    
    try:
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                for line in f:
                    if line.strip().startswith("WHATSAPP_ACCESS_TOKEN"):
                        lines.append(f"WHATSAPP_ACCESS_TOKEN={token}\n")
                        token_updated = True
                    else:
                        lines.append(line)
                        
        if not token_updated:
            lines.append(f"\nWHATSAPP_ACCESS_TOKEN={token}\n")
            
        with open(env_path, "w") as f:
            f.writelines(lines)
            
        logger.info("WHATSAPP_ACCESS_TOKEN updated dynamically via simulator UI.")
        return {"status": "success", "message": "Token updated successfully in memory and config file."}
    except Exception as e:
        logger.error(f"Failed to update .env configuration file: {e}")
        raise HTTPException(status_code=500, detail="Failed to write token configuration to disk.")

@router.post("/analyze")
async def analyze_uploaded_image(
    file: UploadFile = File(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    district: str = Form(""),
    ward: str = Form(""),
    db: Session = Depends(get_db)
):
    """
    Step 1 of complaint filing:
    Citizen uploads an image. AI detects the object, category, severity,
    routes to a department, checks for duplicates nearby, and generates an official text.
    """
    # Create unique filename
    file_ext = os.path.splitext(file.filename)[1]
    if not file_ext:
        file_ext = ".jpg"  # default
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save the file locally
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save uploaded image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save image on the server."
        )

    relative_image_url = f"/uploads/{unique_filename}"
    
    # Run Object Detection & Classification
    try:
        ai_result = await run_in_threadpool(detector.run_object_detection, file_path)
    except Exception:
        logger.exception('Image detection failed')
        raise HTTPException(503, 'Image detection is unavailable. Please retry with a supported image.')
    category = ai_result["category"]
    severity = ai_result["severity"]
    confidence = ai_result["confidence"]
    bbox = ai_result["bbox"]
    dept_name = ai_result["department"]
    
    # Fetch department from DB or create default
    db_dept = crud.get_department_by_name(db, name=dept_name) if category != "None" else None
    if not db_dept and category != "None":
        # Fallback creation of department
        code = "".join([w[0] for w in dept_name.split()]).upper()
        db_dept = crud.create_department(db, schemas.DepartmentCreate(name=dept_name, code=code))

    # Generate Professional Complaint Text
    ai_description = generator.generate_complaint_description(
        category=category,
        severity=severity,
        district=district or "the reported area",
        ward=ward or "the reported area",
        latitude=latitude or 0,
        longitude=longitude or 0,
        department=dept_name
    ) if category != "None" and latitude is not None and longitude is not None else ""
    
    # Check for Duplicate Complaints within 50 meters
    duplicate_warning = False
    duplicate_details = None
    existing_dup = duplicates.find_duplicate_complaint(
        db=db,
        latitude=latitude,
        longitude=longitude,
        category=category,
        description=ai_description,
        max_distance_meters=20.0
    ) if latitude is not None and longitude is not None else None
    
    if existing_dup:
        duplicate_warning = True
        duplicate_details = schemas.ComplaintOut.model_validate(existing_dup)
        
    return {
        "category": category,
        "confidence": confidence,
        "severity": severity,
        "bbox": bbox,
        "detections": ai_result.get('detections', []),
        "image_width": ai_result.get('image_width'),
        "image_height": ai_result.get('image_height'),
        "localization_available": ai_result.get('localization_available', False),
        "localization_method": ai_result.get('localization_method'),
        "confidence_kind": ai_result.get('confidence_kind'),
        "detector": ai_result.get('detector'),
        "needs_review": ai_result.get('needs_review', True),
        "department": schemas.DepartmentOut.model_validate(db_dept) if db_dept else None,
        "description": ai_description,
        "latitude": latitude,
        "longitude": longitude,
        "district": district,
        "ward": ward,
        "before_image_url": relative_image_url,
        "duplicate_warning": duplicate_warning,
        "duplicate_complaint": duplicate_details
    }

@router.post("", response_model=schemas.ComplaintOut)
async def file_complaint(
    complaint_in: schemas.ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Step 2: Commit the complaint after user reviews and approves the AI detection.
    """
    # 1. Rerun detection details from category to match standard dept
    dept_name = detector.CATEGORY_TO_DEPT.get(complaint_in.category, "Roads & Buildings")
    db_dept = crud.get_department_by_name(db, name=dept_name)
    dept_id = db_dept.id if db_dept else 1
    
    # Auto severity mapping if not explicitly defined
    # We will pick a default severity, let's say "medium", unless AI analysis suggested higher
    # In practice, frontend passes the AI suggested fields or citizen overrides them
    # For now, let's generate description and severity dynamically
    severity_mapping = {
        "Open Manhole": "critical",
        "Electric Pole Damage": "critical",
        "Flooded Road": "critical",
        "Pothole": "high",
        "Garbage": "medium",
        "Water Leakage": "medium",
        "Fallen Tree": "medium",
        "Broken Traffic Sign": "low",
        "Broken Streetlight": "low"
    }
    severity = severity_mapping.get(complaint_in.category, "medium")
    
    description = complaint_in.description
    if not description:
        description = generator.generate_complaint_description(
            category=complaint_in.category,
            severity=severity,
            district=complaint_in.district,
            ward=complaint_in.ward,
            latitude=complaint_in.latitude,
            longitude=complaint_in.longitude,
            department=dept_name
        )

    duplicate = duplicates.find_duplicate_complaint(
        db=db,
        latitude=complaint_in.latitude,
        longitude=complaint_in.longitude,
        category=complaint_in.category,
        description=description,
        max_distance_meters=20.0,
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "duplicate_complaint",
                "message": "A similar complaint already exists nearby.",
                "original_id": duplicate.id,
                "feed_url": f"/community?complaint={duplicate.id}",
            },
        )
        
    db_complaint = crud.create_complaint(
        db=db,
        complaint=complaint_in,
        citizen_id=current_user.id,
        severity=severity,
        department_id=dept_id,
        description=description
    )
    
    # Log audit trail
    crud.create_audit_log(
        db,
        user_id=current_user.id,
        action="CREATE_COMPLAINT",
        target_type="complaint",
        target_id=db_complaint.id,
        details=f"Complaint created for {db_complaint.category} (id: {db_complaint.id}) in {db_complaint.district}"
    )
    
    # Trigger WebSocket notifications
    complaint_data = schemas.ComplaintOut.model_validate(db_complaint).model_dump(mode='json')
    await manager.notify_officers_new_complaint(
        complaint_data=complaint_data,
        district=db_complaint.district,
        department_id=dept_id
    )
    
    return db_complaint

@router.get("", response_model=List[schemas.ComplaintOut])
def read_complaints(
    status: Optional[str] = None,
    department_id: Optional[int] = None,
    officer_id: Optional[int] = None,
    citizen_id: Optional[int] = None,
    district: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_complaints(
        db=db,
        status=status,
        department_id=department_id,
        officer_id=officer_id,
        citizen_id=citizen_id,
        district=district,
        category=category
    )

@router.get("/{complaint_id}", response_model=schemas.ComplaintOut)
def read_complaint_by_id(complaint_id: int, db: Session = Depends(get_db)):
    db_complaint = crud.get_complaint(db, complaint_id=complaint_id)
    if not db_complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return db_complaint

@router.post("/{complaint_id}/upvote", response_model=schemas.ComplaintOut)
async def upvote_existing_complaint(
    complaint_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Increments upvote count of a complaint instead of filing a duplicate report.
    """
    db_complaint = crud.get_complaint(db, complaint_id=complaint_id)
    if not db_complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    updated = crud.upvote_complaint(db, db_complaint)
    
    # Create audit log
    crud.create_audit_log(
        db,
        user_id=current_user.id,
        action="UPVOTE_COMPLAINT",
        target_type="complaint",
        target_id=complaint_id,
        details=f"User upvoted/supported complaint (New upvotes: {updated.upvotes})"
    )
    
    # Broadcast status change to officers
    complaint_data = schemas.ComplaintOut.model_validate(updated).model_dump(mode='json')
    if updated.department_id:
        await manager.notify_officers_new_complaint(
            complaint_data=complaint_data,
            district=updated.district,
            department_id=updated.department_id
        )
        
    return updated

def require_assigned_officer(db, complaint, user):
    officer = crud.get_officer_by_user_id(db, user.id)
    if not officer or complaint.officer_id != officer.id:
        raise HTTPException(403, 'This complaint is not assigned to you')


def save_evidence(file: UploadFile, suffix: str) -> str:
    """Only accept bounded, decodable photos; derive extensions from actual image data."""
    from io import BytesIO
    from PIL import Image, UnidentifiedImageError
    content = file.file.read(12 * 1024 * 1024 + 1)
    if not content or len(content) > 12 * 1024 * 1024:
        raise HTTPException(400, 'Upload a photo smaller than 12 MB')
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            extension = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}.get(image.format)
        if not extension:
            raise ValueError('Unsupported image')
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(400, 'Upload a valid JPEG, PNG or WebP photo')
    filename = f'{uuid.uuid4()}_{suffix}{extension}'
    with open(os.path.join(UPLOAD_DIR, filename), 'wb') as target:
        target.write(content)
    return '/uploads/' + filename


async def publish_workflow_update(db, complaint, user, action, details):
    crud.create_audit_log(db, user_id=user.id, action=action, target_type='complaint',
                          target_id=complaint.id, details=details)
    if complaint.citizen_id:
        await manager.notify_citizen_status_update(citizen_id=complaint.citizen_id,
            complaint_data=schemas.ComplaintOut.model_validate(complaint).model_dump(mode='json'))
    try:
        await notify_citizen_status_whatsapp(db, complaint)
    except Exception:
        logger.exception('Workflow saved, but the WhatsApp status notification could not be delivered')


@router.put("/{complaint_id}", response_model=schemas.ComplaintOut)
async def update_complaint_status(
    complaint_id: int, complaint_update: schemas.ComplaintUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "district_admin", "state_admin"]))
):
    """Central Room can assign an initial inspection, never skip approval or evidence."""
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(404, 'Complaint not found')
    if complaint_update.model_fields_set - {'status', 'officer_id', 'work_notes'}:
        raise HTTPException(400, 'Use the photo verification and completion endpoints for evidence')
    if complaint.status not in ('pending', 'under_review', 'assigned'):
        raise HTTPException(409, 'Inspection has already been submitted; use Proceed for verified cases')
    if complaint_update.status == 'assigned':
        assignee = crud.get_officer(db, complaint_update.officer_id) if complaint_update.officer_id else None
        if not assignee or assignee.department_id != complaint.department_id:
            raise HTTPException(400, 'Choose an officer from the responsible department')
    elif complaint_update.status == 'under_review' and complaint.status == 'pending' and not complaint_update.officer_id:
        pass
    else:
        raise HTTPException(400, 'Only initial review and inspection assignment are allowed here')
    updated = crud.update_complaint(db, complaint, complaint_update)
    await publish_workflow_update(db, updated, current_user, 'UPDATE_COMPLAINT',
        f'Inspection workflow: {updated.status}; officer {updated.officer_id}')
    return updated


@router.post("/{complaint_id}/verify", response_model=schemas.ComplaintOut)
async def verify_complaint_image(
    complaint_id: int,
    file: UploadFile = File(...),
    verdict: str = Form(...),
    notes: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["officer", "reviewer"]))
):
    """The assigned officer submits on-site evidence: real awaits approval, fake is declined."""
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(404, 'Complaint not found')
    require_assigned_officer(db, complaint, current_user)
    if complaint.status != 'assigned':
        raise HTTPException(409, 'Only an assigned inspection can be verified')
    if verdict not in ('real', 'fake') or not notes.strip():
        raise HTTPException(400, 'Choose real or fake and explain your on-site findings')
    photo = save_evidence(file, 'inspection')
    complaint.verification_outcome = verdict
    complaint.verification_notes = notes.strip()
    complaint.verified_at = datetime.utcnow()
    updated = crud.update_complaint(db, complaint, schemas.ComplaintUpdate(
        status='verified' if verdict == 'real' else 'rejected', verified_image_url=photo))
    await publish_workflow_update(db, updated, current_user, 'VERIFY_COMPLAINT',
        f'Officer finding: {verdict}. {notes.strip()}')
    return updated


@router.post("/{complaint_id}/proceed", response_model=schemas.ComplaintOut)
async def proceed_with_work(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["admin", "district_admin", "state_admin"]))
):
    """Approve verified work for the same officer who performed the inspection."""
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(404, 'Complaint not found')
    if (complaint.status != 'verified' or complaint.verification_outcome != 'real'
            or not complaint.verified_image_url or not complaint.officer_id):
        raise HTTPException(409, 'A real on-site verification with a photo is required before Proceed')
    complaint.proceeded_at = datetime.utcnow()
    updated = crud.update_complaint(db, complaint, schemas.ComplaintUpdate(status='in_progress'))
    await publish_workflow_update(db, updated, current_user, 'PROCEED_COMPLAINT',
        f'Central Room approved work for the same officer {updated.officer_id}')
    return updated


@router.post("/{complaint_id}/complete", response_model=schemas.ComplaintOut)
async def upload_completed_repair_image(
    complaint_id: int, file: UploadFile = File(...), notes: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_role(["officer", "reviewer"]))
):
    """Only the assigned officer can resolve approved work with a new completion photo."""
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(404, 'Complaint not found')
    require_assigned_officer(db, complaint, current_user)
    if complaint.status != 'in_progress' or not complaint.proceeded_at:
        raise HTTPException(409, 'Wait for the Central Room to click Proceed before completing work')
    if not notes.strip():
        raise HTTPException(400, 'Describe the completed work')
    photo = save_evidence(file, 'resolved')
    updated = crud.update_complaint(db, complaint, schemas.ComplaintUpdate(status='resolved', after_image_url=photo))
    await publish_workflow_update(db, updated, current_user, 'RESOLVE_COMPLAINT', notes.strip())
    return updated

# --- WHATSAPP CLOUD API WEBHOOK INTEGRATION ROUTINES ---

def clean_phone_number(raw_phone: str) -> str:
    """
    Cleans phone numbers by removing 'whatsapp:' prefix and any leading '+' sign
    to match standard seeded user database formats (e.g. 919988776655).
    """
    cleaned = raw_phone.replace("whatsapp:", "")
    cleaned = cleaned.replace("+", "")
    return cleaned.strip()

async def download_twilio_media(media_url: str) -> str:
    """
    Downloads media from Twilio and saves it locally.
    """
    try:
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        auth = None
        if account_sid and auth_token:
            auth = (account_sid, auth_token)

        async with httpx.AsyncClient() as client:
            res = await client.get(media_url, auth=auth, follow_redirects=True)
            if res.status_code == 200:
                content_type = res.headers.get("content-type", "")
                ext = ".jpg"
                if "png" in content_type:
                    ext = ".png"
                elif "gif" in content_type:
                    ext = ".gif"
                
                filename = f"twilio_{uuid.uuid4()}{ext}"
                file_path = os.path.join(UPLOAD_DIR, filename)
                with open(file_path, "wb") as f:
                    f.write(res.content)
                return f"/uploads/{filename}"
    except Exception as e:
        logger.error(f"Twilio Media Download failed: {e}. Falling back to default.")
    
    # Fallback to standard mock image
    return await download_whatsapp_media("twilio_fallback")
async def notify_citizen_status_whatsapp(db: Session, updated: models.Complaint):
    """
    Sends a WhatsApp status update message to the citizen if they have a registered phone number or filed via WhatsApp.
    """
    phone_number = updated.reporter_phone
    if not phone_number and updated.citizen_id:
        citizen = db.query(models.User).filter(models.User.id == updated.citizen_id).first()
        if citizen:
            phone_number = citizen.phone_number
            
    if not phone_number:
        return
        
    status_text = updated.status.upper().replace("_", " ")
    complaint_custom_id = f"CSA-2026-{updated.id:05d}"
    website_url = os.getenv("WEBSITE_URL", "http://localhost:5173").rstrip("/")
    
    status_descriptions = {
        "pending": "Your complaint has been successfully registered and is pending initial review by department heads.",
        "under_review": "Our municipal inspectors are reviewing your report, confirming details, and checking geofence coordinates.",
        "verified": "The issue has been verified on-site by our inspectors and is awaiting administrative dispatch.",
        "rejected": "The complaint could not be verified on-site and has been closed.",
        "assigned": "An inspection officer has been officially assigned to lead the resolution of your complaint.",
        "in_progress": "Ground crews and equipment have been dispatched. Repair work is actively in progress!",
        "resolved": "The complaint has been successfully resolved and verified by our department!",
        "duplicate": "This complaint was identified as a duplicate of an existing ticket. We have merged them and combined your upvote to raise priority."
    }
    status_desc = status_descriptions.get(updated.status.lower(), "Your complaint status has been updated.")
    
    update_msg = (
        f"📢 *CivicSense Update Notification*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"🎫 Ticket ID: *{complaint_custom_id}*\n"
        f"📂 Issue: *{updated.category}*\n"
        f"🔄 Current Status: *{status_text}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n\n"
        f"{status_desc}\n\n"
    )
    media_url = updated.after_image_url if (updated.status == "resolved" and updated.after_image_url) else updated.before_image_url
    await send_whatsapp_message(phone_number, update_msg, media_url=media_url)

async def broadcast_community_post_alert(db: Session, db_post: models.CommunityPost):
    """
    Dispatches a WhatsApp alert for a newly created CommunityPost (e.g. missing item/person)
    to all unique recipient phone numbers stored in the database along with the alert photo.
    """
    # Guarantee a photo is present for the WhatsApp alert
    if not db_post.image_url:
        db_post.image_url = "/uploads/community_19bbe54b-1fc2-47d8-a025-e588c420bc69.jpg"
        db.commit()

    emoji_map = {
        "missing_person": "🚨",
        "lost_found": "🔍",
        "pet_lost_found": "🐾",
        "blood_donation": "🩸",
        "volunteer": "🤝",
        "community_event": "🎉",
        "community_problem": "⚠️"
    }
    header_map = {
        "missing_person": "EMERGENCY: MISSING PERSON ALERT",
        "lost_found": "LOST & FOUND ALERT",
        "pet_lost_found": "PET LOST/FOUND ALERT",
        "blood_donation": "URGENT BLOOD DONATION REQUIRED",
        "volunteer": "VOLUNTEER OPPORTUNITY",
        "community_event": "COMMUNITY EVENT ANNOUNCEMENT",
        "community_problem": "COMMUNITY BOARD: NEIGHBORHOOD PROBLEM"
    }

    emoji = emoji_map.get(db_post.category, "🚨")
    header = header_map.get(db_post.category, "COMMUNITY ALERT")

    alert_message = (
        f"{emoji} *{header}* {emoji}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"• *Post Title*: {db_post.title}\n"
        f"• *Description*: {db_post.content}\n"
    )
    if db_post.contact_info:
        alert_message += f"• *Contact Info*: {db_post.contact_info}\n"

    alert_message += "━━━━━━━━━━━━━━━━━━━━\n"
    alert_message += "This is an automated alert dispatched to all civic board members. Help your neighborhood by sharing!"

    recipient_phones = set()

    # Registered website users
    users_with_phone = db.query(models.User).filter(models.User.phone_number != None).all()
    for u in users_with_phone:
        if u.phone_number:
            recipient_phones.add(u.phone_number.strip())

    # Active WhatsApp chatbot sessions
    sessions = db.query(models.WhatsAppSession).filter(models.WhatsAppSession.phone_number != None).all()
    for s in sessions:
        if s.phone_number:
            recipient_phones.add(s.phone_number.strip())

    # Existing complaints reporter_phone logs
    complaint_phones = db.query(models.Complaint.reporter_phone).filter(models.Complaint.reporter_phone != None).distinct().all()
    for cp in complaint_phones:
        if cp[0]:
            recipient_phones.add(cp[0].strip())

    logger.info(f"Broadcasting community post alert with photo ({db_post.image_url}) to recipient list: {list(recipient_phones)}")

    for phone in recipient_phones:
        try:
            # Send alert message WITH photo to all users
            await send_whatsapp_message(phone, alert_message, media_url=db_post.image_url)
        except Exception as e:
            logger.error(f"Failed to broadcast community WhatsApp alert to {phone}: {e}")


async def send_whatsapp_message(to: str, text: str, options: list = None, media_url: str = None):
    """
    Sends a WhatsApp message via Twilio or Meta Cloud API, or triggers a mock simulator broadcast.
    Supports sending images (e.g. missing item photo or repair proof).
    """
    clean_to = clean_phone_number(to)

    # Formulate absolute media URL for external WhatsApp APIs & Web UI
    full_media_url = None
    if media_url:
        if media_url.startswith("http"):
            full_media_url = media_url
        else:
            base = os.getenv("NGROK_URL") or os.getenv("WEBSITE_URL") or "https://nonconductible-michele-genitally.ngrok-free.dev"
            base = base.rstrip("/")
            m_path = media_url if media_url.startswith("/") else "/" + media_url
            full_media_url = f"{base}{m_path}"

    # 1. Broadcast to websocket simulator so it shows up in real-time on our web dashboard
    simulator_payload = {
        "type": "WHATSAPP_SIMULATOR_MESSAGE",
        "data": {
            "direction": "outbound",
            "phone_number": clean_to,
            "text": text,
            "media_url": media_url,
            "full_media_url": full_media_url,
            "timestamp": int(time.time()),
            "options": options
        }
    }
    await manager.broadcast(simulator_payload)
    
    # 2. Check for Twilio Credentials
    twilio_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_token = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from = os.getenv("TWILIO_FROM_NUMBER")
    
    if twilio_sid and twilio_token and twilio_from:
        to_formatted = f"whatsapp:+{clean_to}"
        url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
        data = {
            "From": twilio_from,
            "To": to_formatted,
            "Body": text
        }
        if full_media_url:
            data["MediaUrl"] = full_media_url

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, auth=(twilio_sid, twilio_token), data=data)
                print(f"[DEBUG TWILIO] Status: {res.status_code}, Body: {res.text}")
                logger.info(f"Twilio WhatsApp response status: {res.status_code}")
        except Exception as e:
            print(f"[DEBUG TWILIO] Exception occurred: {e}")
            logger.error(f"Failed to post to Twilio WhatsApp API: {e}")
            
    # 3. Meta Cloud API Integration
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if token and phone_id:
        url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        if full_media_url:
            body = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_to,
                "type": "image",
                "image": {
                    "link": full_media_url,
                    "caption": text[:1000]
                }
            }
        else:
            body = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_to,
                "type": "text",
                "text": {"body": text}
            }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, headers=headers, json=body)
                print(f"[DEBUG WHATSAPP META] Status: {res.status_code}, Body: {res.text}")
                logger.info(f"WhatsApp Cloud API response status: {res.status_code}")
                # If image message fails (e.g. invalid URL or media error), fallback to text message
                if full_media_url and res.status_code not in [200, 201]:
                    fallback_body = {
                        "messaging_product": "whatsapp",
                        "recipient_type": "individual",
                        "to": clean_to,
                        "type": "text",
                        "text": {"body": f"{text}\n\n📷 Attachment link: {full_media_url}"}
                    }
                    fallback_res = await client.post(url, headers=headers, json=fallback_body)
                    print(f"[DEBUG WHATSAPP META FALLBACK] Status: {fallback_res.status_code}, Body: {fallback_res.text}")
        except Exception as e:
            print(f"[DEBUG WHATSAPP META] Exception occurred: {e}")
            logger.error(f"Failed to post to WhatsApp Cloud API: {e}")

async def download_whatsapp_media(media_id: str):
    """
    Downloads media from WhatsApp servers using the media ID,
    or bypasses download if it's a simulated local file.
    """
    if not media_id:
        return "/uploads/pothole_a.jpg"

    # Handle simulator uploads directly (which are already local URLs)
    if media_id.startswith("simulator_"):
        return media_id.replace("simulator_", "")

    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    if token:
        # Get media meta URL
        url = f"https://graph.facebook.com/v18.0/{media_id}"
        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    media_url = res.json().get("url")
                    # Download binary payload
                    media_res = await client.get(media_url, headers=headers)
                    if media_res.status_code == 200:
                        filename = f"whatsapp_{uuid.uuid4()}.jpg"
                        file_path = os.path.join(UPLOAD_DIR, filename)
                        with open(file_path, "wb") as f:
                            f.write(media_res.content)
                        return f"/uploads/{filename}"
        except Exception as e:
            logger.error(f"WhatsApp Media Download failed: {e}. Falling back to default.")
            
    # Mock fallback image for easy testing
    clean_media_id = "".join([c for c in media_id if c.isalnum() or c in "_-"]).lower()
    filename = f"whatsapp_simulated_{clean_media_id}_{uuid.uuid4()}.jpg"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        # Find any existing file in upload directory to duplicate for mock representation
        existing_files = [f for f in os.listdir(UPLOAD_DIR) if os.path.isfile(os.path.join(UPLOAD_DIR, f)) and not f.startswith("whatsapp_simulated")]
        if existing_files:
            shutil.copyfile(os.path.join(UPLOAD_DIR, existing_files[0]), file_path)
        else:
            dummy_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x01\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9'
            with open(file_path, "wb") as f:
                f.write(dummy_bytes)
    except Exception as e:
        logger.warning(f"Could not provision mock placeholder: {e}")
        
    return f"/uploads/{filename}"

@router.get("/webhook")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    """
    Validation handshake for WhatsApp Webhook integration.
    """
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN")
    if verify_token and hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp Webhook verified successfully!")
        
        # If the challenge is all digits, return as integer as expected by some test suites
        if hub_challenge and hub_challenge.isdigit():
            try:
                return int(hub_challenge)
            except ValueError:
                pass
        return Response(content=hub_challenge, media_type="text/plain")
    else:
        logger.warning("WhatsApp Webhook verification token mismatch.")
        raise HTTPException(status_code=403, detail="Verification token mismatch.")

@router.post("/webhook")
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Receives WhatsApp webhook payload notifications from Twilio, Meta API, or simulators.
    """
    content_type = request.headers.get("content-type", "")
    is_twilio = "application/x-www-form-urlencoded" in content_type

    # Preserve old Twilio webhook URLs while using the production-safe processor.
    # Starlette caches parsed form data, so the delegated handler can read it safely.
    if is_twilio:
        from .twilio_whatsapp import receive_twilio_whatsapp
        return await receive_twilio_whatsapp(request, db)
    
    form_data = None
    msg = None
    media_url = None

    if is_twilio:
        try:
            form_data = await request.form()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Form payload.")
        
        raw_from = form_data.get("From", "")
        from_number = clean_phone_number(raw_from)
        
        num_media = int(form_data.get("NumMedia", "0"))
        if num_media > 0:
            msg_type = "image"
            media_id = form_data.get("MessageSid", f"twilio_msg_{uuid.uuid4()}")
            media_url = form_data.get("MediaUrl0")
        elif "Latitude" in form_data and "Longitude" in form_data and form_data.get("Latitude") and form_data.get("Longitude"):
            msg_type = "location"
            media_id = None
        else:
            msg_type = "text"
            media_id = None
            
        body_text = form_data.get("Body", "")
    else:
        # Existing application/json parser (Meta API/Simulator)
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload.")

        entry = body.get("entry", [])
        if not entry:
            return {"status": "ignored", "reason": "No entry field"}
            
        changes = entry[0].get("changes", [])
        if not changes:
            return {"status": "ignored", "reason": "No changes field"}
            
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        if not messages:
            return {"status": "ignored", "reason": "Not an incoming message"}

        msg = messages[0]
        raw_from = msg.get("from")
        from_number = clean_phone_number(raw_from) if raw_from else None
        msg_type = msg.get("type")
        
        if not from_number:
            return {"status": "ignored", "reason": "No sender number"}

        body_text = msg.get("text", {}).get("body", "") if msg_type == "text" else ""
        media_id = msg.get("image", {}).get("id") if msg_type == "image" else None

    # Broadcast incoming message to simulator client so it renders in real-time
    await manager.broadcast({
        "type": "WHATSAPP_SIMULATOR_MESSAGE",
        "data": {
            "direction": "inbound",
            "phone_number": from_number,
            "text": body_text if msg_type == "text" else f"[{msg_type.upper()} MEDIA]",
            "timestamp": int(time.time())
        }
    })

    # Retrieve or initialize session state
    session = crud.get_whatsapp_session(db, phone_number=from_number)
    current_state = session.state if session else "idle"

    # --- RESOLVE CONFIRMATION STATE FIRST ---
    if current_state == "awaiting_confirmation" and msg_type == "text":
        text_clean = body_text.strip().lower()
        if "confirm" in text_clean or text_clean == "1" or text_clean == "confirm button":
            # Retrieve draft from session.last_media_id
            try:
                draft = json.loads(session.last_media_id)
            except Exception:
                reply_text = "⚠️ Failed to retrieve draft session. Please upload a photo to start again."
                await send_whatsapp_message(from_number, reply_text)
                crud.create_or_update_whatsapp_session(db, phone_number=from_number, state="idle", last_image_url="", last_media_id="")
                return {"status": "error", "reason": "invalid_session_draft"}
                
            lat = draft["lat"]
            lon = draft["lon"]
            category = draft["category"]
            severity = draft["severity"]
            district = draft["district"]
            ward = draft["ward"]
            
            # Fetch department
            dept_name = detector.CATEGORY_TO_DEPT.get(category, "Roads & Buildings")
            db_dept = crud.get_department_by_name(db, name=dept_name)
            if not db_dept:
                code = "".join([w[0] for w in dept_name.split()]).upper()
                db_dept = crud.create_department(db, schemas.DepartmentCreate(name=dept_name, code=code))

            # Generate description
            ai_desc = generator.generate_complaint_description(
                category=category,
                severity=severity,
                district=district,
                ward=ward,
                latitude=lat,
                longitude=lon,
                department=dept_name
            )

            # Try to link to a registered citizen with this phone number
            citizen = db.query(models.User).filter(models.User.phone_number == from_number).first()
            citizen_id = citizen.id if citizen else None

            # Create Complaint
            db_complaint = models.Complaint(
                citizen_id=citizen_id,
                reporter_phone=from_number,
                department_id=db_dept.id,
                category=category,
                severity=severity,
                description=ai_desc,
                latitude=lat,
                longitude=lon,
                district=district,
                ward=ward,
                before_image_url=session.last_image_url,
                status="pending"
            )
            db.add(db_complaint)
            db.commit()
            db.refresh(db_complaint)

            complaint_custom_id = f"CSA-2026-{db_complaint.id:05d}"
            
            # Broadcast real-time event to dashboards
            complaint_data = schemas.ComplaintOut.model_validate(db_complaint).model_dump(mode='json')
            await manager.notify_officers_new_complaint(
                complaint_data=complaint_data,
                district=district,
                department_id=db_dept.id
            )

            # Send Success Message without sending the photo back to the user
            website_url = os.getenv("WEBSITE_URL", "http://localhost:5173").rstrip("/")
            reply_text = (
                f"✅ *Complaint Registered Successfully!*\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📱 Sender: *+{from_number}*\n"
                f"🎫 Complaint ID: *{complaint_custom_id}*\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📂 Issue: {category}\n"
                f"⚠️ Severity: {severity.upper()}\n"
                f"🏢 Department: {dept_name}\n"
                f"📍 Location: {district} (Ward: {ward})\n"
                f"🔄 Status: Pending\n\n"
                f"Track live updates: {website_url}/track/{db_complaint.id}"
            )
            await send_whatsapp_message(from_number, reply_text)

            # Reset session
            crud.create_or_update_whatsapp_session(db, phone_number=from_number, state="idle", last_image_url="", last_media_id="")
            return {"status": "processed", "action": "complaint_created", "id": db_complaint.id}
            
        elif "retry location" in text_clean or text_clean == "2" or text_clean == "retry_location":
            crud.create_or_update_whatsapp_session(
                db, 
                phone_number=from_number, 
                state="awaiting_location", 
                last_image_url=session.last_image_url, 
                last_media_id=session.last_media_id
            )
            reply_text = "📍 Please share your new location coordinates (📍 Share Location) to update the ticket."
            await send_whatsapp_message(from_number, reply_text)
            return {"status": "processed", "action": "retry_location"}
            
        elif "retry issue" in text_clean or "retry" in text_clean or text_clean == "3" or text_clean == "retry_issue":
            try:
                draft = json.loads(session.last_media_id)
            except Exception:
                reply_text = "⚠️ Failed to retrieve draft session. Please upload a photo to start again."
                await send_whatsapp_message(from_number, reply_text)
                crud.create_or_update_whatsapp_session(db, phone_number=from_number, state="idle", last_image_url="", last_media_id="")
                return {"status": "error", "reason": "invalid_session_draft"}
                
            CATEGORIES_CYCLE = ["Pothole", "Garbage", "Water Leakage", "Open Manhole", "Fallen Tree", "Electric Pole Damage", "Flooded Road", "Broken Traffic Sign", "Broken Streetlight"]
            current_cat = draft.get("category", "Pothole")
            try:
                idx = CATEGORIES_CYCLE.index(current_cat)
                next_cat = CATEGORIES_CYCLE[(idx + 1) % len(CATEGORIES_CYCLE)]
            except ValueError:
                next_cat = "Garbage"
                
            severity_mapping = {
                "Open Manhole": "critical",
                "Electric Pole Damage": "critical",
                "Flooded Road": "critical",
                "Pothole": "high",
                "Garbage": "medium",
                "Water Leakage": "medium",
                "Fallen Tree": "medium",
                "Broken Traffic Sign": "low",
                "Broken Streetlight": "low"
            }
            severity = severity_mapping.get(next_cat, "medium")
            dept_name = detector.CATEGORY_TO_DEPT.get(next_cat, "Roads & Buildings")
            
            # Save new category to draft
            draft["category"] = next_cat
            draft["severity"] = severity
            crud.create_or_update_whatsapp_session(
                db, 
                phone_number=from_number, 
                state="awaiting_confirmation", 
                last_image_url=session.last_image_url, 
                last_media_id=json.dumps(draft)
            )
            
            reply_text = (
                f"🔄 *Category Rotated by User*:\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"• *Issue*: {next_cat}\n"
                f"• *Department*: {dept_name}\n"
                f"• *Location*: {draft['district']} (Ward: {draft['ward']})\n"
                f"━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Please choose an action using the options below:"
            )
            await send_whatsapp_message(from_number, reply_text, options=["Confirm", "Retry Location", "Retry Issue", "Cancel"])
            return {"status": "processed", "action": "category_rotated"}
            
        elif "cancel" in text_clean or text_clean == "4" or "cancel" in text_clean:
            crud.create_or_update_whatsapp_session(db, phone_number=from_number, state="idle", last_image_url="", last_media_id="")
            reply_text = "❌ Complaint reporting transaction canceled. Feel free to upload a new defect photo anytime."
            await send_whatsapp_message(from_number, reply_text)
            return {"status": "processed", "action": "canceled"}
            
        else:
            reply_text = (
                f"⚠️ Unrecognized input.\n\n"
                f"Please select one of the actions:\n"
                f"• *Confirm* - Submit the complaint\n"
                f"• *Retry Location* - Update the location coordinates\n"
                f"• *Retry Issue* - Scan another issue category\n"
                f"• *Cancel* - Discard submission"
            )
            await send_whatsapp_message(from_number, reply_text, options=["Confirm", "Retry Location", "Retry Issue", "Cancel"])
            return {"status": "processed", "action": "invalid_confirmation_option"}

    # Check for explicit missing item or general text report in text messages
    if msg_type == "text":
        text_clean = body_text.strip().lower()
        is_missing_item_report = any(k in text_clean for k in [
            "missing", "lost", "found", "stolen", "item", "wallet", "phone", "bag", "key", "pet", "person", "dog", "cat", "child", "alert"
        ])
        if is_missing_item_report:
            category = "missing_person" if any(k in text_clean for k in ["person", "child", "boy", "girl", "man", "woman"]) else "lost_found"
            post_title = f"WhatsApp Report: {body_text[:50]}" if len(body_text) > 50 else (body_text or "Missing Item Notice")
            
            citizen = db.query(models.User).filter(models.User.phone_number == from_number).first()
            user_id = citizen.id if citizen else None
            
            # Attach image if uploaded earlier, else fallback photo
            image_url = session.last_image_url if (session and session.last_image_url) else "/uploads/community_19bbe54b-1fc2-47d8-a025-e588c420bc69.jpg"
            
            db_post = models.CommunityPost(
                title=post_title,
                content=f"Notice reported via WhatsApp (+{from_number}): {body_text}",
                category=category,
                contact_info=f"+{from_number}",
                image_url=image_url,
                user_id=user_id
            )
            db.add(db_post)
            db.commit()
            db.refresh(db_post)

            # Reset session state to idle
            crud.create_or_update_whatsapp_session(db, phone_number=from_number, state="idle", last_image_url="", last_media_id="")
            
            website_url = os.getenv("WEBSITE_URL", "http://localhost:5173").rstrip("/")
            reply_text = (
                f"🚨 *Community Alert Dispatched to ALL Users!*\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"📱 Reporter: *+{from_number}*\n"
                f"📋 Notice: *{post_title}*\n"
                f"━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Your alert notice along with photo has been broadcasted to all registered users and published on the Community Board!\n\n"
                f"🔗 View community board: {website_url}"
            )
            await send_whatsapp_message(from_number, reply_text, media_url=db_post.image_url)
            await broadcast_community_post_alert(db, db_post)
            return {"status": "processed", "action": "missing_item_registered", "post_id": db_post.id}
            
        # If it's a general complaint reported via text without coordinates
        elif not ("lat" in text_clean and "lon" in text_clean):
            # Create a draft complaint directly from text without requiring a photo
            category = "Pothole"
            if any(k in text_clean for k in ["garbage", "trash", "waste", "bin"]):
                category = "Garbage"
            elif any(k in text_clean for k in ["leak", "water", "pipe"]):
                category = "Water Leakage"
            elif any(k in text_clean for k in ["manhole", "drain"]):
                category = "Open Manhole"
            elif any(k in text_clean for k in ["electric", "wire", "pole", "light"]):
                category = "Electric Pole Damage"

            last_image_url = session.last_image_url if (session and session.last_image_url) else "/uploads/pothole_a.jpg"
            lat, lon = 17.3850, 78.4867
            district, ward = "Hyderabad", "Ward 5"

            draft_info = {
                "lat": lat,
                "lon": lon,
                "category": category,
                "severity": "high",
                "district": district,
                "ward": ward,
                "is_retry": False
            }

            crud.create_or_update_whatsapp_session(
                db, 
                phone_number=from_number, 
                state="awaiting_confirmation", 
                last_image_url=last_image_url, 
                last_media_id=json.dumps(draft_info)
            )

            reply_text = (
                f"📝 *Complaint Draft Created* (Photo Optional):\n"
                f"━━━━━━━━━━━━━━━━━━━━\n"
                f"• *Issue*: {category}\n"
                f"• *Details*: {body_text}\n"
                f"• *Location*: {district} ({ward})\n"
                f"━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Please reply 'Confirm' to register this complaint or share 📍 Location."
            )
            await send_whatsapp_message(from_number, reply_text, options=["Confirm", "Cancel"])
            return {"status": "processed", "action": "text_complaint_draft_created"}

    if msg_type == "image":
        if is_twilio and media_url:
            saved_image_path = await download_twilio_media(media_url)
        else:
            saved_image_path = await download_whatsapp_media(media_id)
        
        # Update session: state becomes awaiting_location
        crud.create_or_update_whatsapp_session(
            db, 
            phone_number=from_number, 
            state="awaiting_location", 
            last_image_url=saved_image_path,
            last_media_id=media_id
        )
        
        # Send reply with sender number confirmation
        reply_text = (
            f"📷 Photo received from *+{from_number}*!\n\n"
            f"Your image has been captured. Please share your current location (📍 Share Location) or text missing item/person details."
        )
        await send_whatsapp_message(from_number, reply_text, media_url=saved_image_path)
        return {"status": "processed", "action": "requested_location"}

    elif msg_type == "location" or (msg_type == "text" and "lat" in body_text.lower()):
        # Handle location payload
        lat, lon = None, None
        
        if msg_type == "location":
            if is_twilio:
                lat = float(form_data.get("Latitude"))
                lon = float(form_data.get("Longitude"))
            else:
                loc_data = msg.get("location", {})
                lat = float(loc_data.get("latitude"))
                lon = float(loc_data.get("longitude"))
        else:
            # Parse text coordinates: e.g. "lat: 17.385, lon: 78.486"
            try:
                lat_match = re.search(r"lat:\s*([-\d\.]+)", body_text, re.IGNORECASE)
                lon_match = re.search(r"lon:\s*([-\d\.]+)", body_text, re.IGNORECASE)
                if lat_match and lon_match:
                    lat = float(lat_match.group(1))
                    lon = float(lon_match.group(1))
            except Exception:
                pass
                
        if lat is None or lon is None:
            reply_text = "⚠️ Invalid coordinate format. Please share your location using the WhatsApp attachment menu."
            await send_whatsapp_message(from_number, reply_text)
            return {"status": "error", "reason": "invalid_coordinates"}

        # Photo is OPTIONAL: fallback if session has no photo uploaded
        last_image_url = session.last_image_url if (session and session.last_image_url) else "/uploads/pothole_a.jpg"

        # Resolve District & Ward from coordinates
        resolved_loc = detector.localGeofenceLookup(lat, lon)
        district = resolved_loc["district"]
        ward = resolved_loc["ward"]

        # Run AI detection on the image path if file exists
        filename = os.path.basename(last_image_url)
        abs_img_path = os.path.join(UPLOAD_DIR, filename)
        
        if os.path.exists(abs_img_path):
            ai_res = detector.run_object_detection(abs_img_path)
            category = ai_res["category"] if ai_res["category"] != "None" else "Pothole"
            severity = ai_res["severity"]
            dept_name = ai_res["department"]
        else:
            category = "Pothole"
            severity = "high"
            dept_name = "Roads & Buildings"

        # Store draft details in last_media_id as a JSON string
        draft_info = {
            "lat": lat,
            "lon": lon,
            "category": category,
            "severity": severity,
            "district": district,
            "ward": ward,
            "is_retry": False
        }

        # Set state to awaiting_confirmation
        crud.create_or_update_whatsapp_session(
            db, 
            phone_number=from_number, 
            state="awaiting_confirmation", 
            last_image_url=last_image_url, 
            last_media_id=json.dumps(draft_info)
        )

        # Send draft details
        reply_text = (
            f"🔍 *AI Scan Draft Results*:\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"• *Issue*: {category}\n"
            f"• *Department*: {dept_name}\n"
            f"• *Location*: {district} (Ward: {ward})\n"
            f"━━━━━━━━━━━━━━━━━━━━\n\n"
            f"Please choose an action using the options below:"
        )
        await send_whatsapp_message(from_number, reply_text, options=["Confirm", "Retry Location", "Retry Issue", "Cancel"])
        return {"status": "processed", "action": "sent_draft_confirmation"}

    else:
        # Handle text messages outside photo/location flow or explicit missing item reports
        if current_state == "awaiting_location":
            reply_text = "📍 Please share your current location via WhatsApp's 'Share Location' attachment so we can log coordinates."
        else:
            reply_text = (
                f"👋 Welcome to CivicSense AI!\n\n"
                f"• To report a civic defect (pothole, garbage, etc.), send a photo (📷).\n"
                f"• To report a missing item, send a text describing the lost/found item (e.g. *Missing black wallet in Ward 5*)."
            )
        
        await send_whatsapp_message(from_number, reply_text)
        return {"status": "processed", "action": "sent_instructions"}
