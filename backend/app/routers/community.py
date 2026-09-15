import os
import uuid
import shutil
import logging
import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from ..database import get_db
from .. import models, schemas, auth
from .complaints import send_whatsapp_message

logger = logging.getLogger("civicsense.routers.community")

router = APIRouter(prefix="/api/community", tags=["Community Board"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Upload ──────────────────────────────────────────────────────────────────
@router.post("/upload-image")
async def upload_community_image(file: UploadFile = File(...)):
    """Saves an image uploaded for a community board post."""
    file_ext = os.path.splitext(file.filename)[1] or ".jpg"
    unique_filename = f"community_{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"image_url": f"/uploads/{unique_filename}"}
    except Exception as e:
        logger.error(f"Community post image upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save community post image.")


# ── List approved posts (public / citizen view) ─────────────────────────────
@router.get("", response_model=List[schemas.CommunityPostOut])
def get_community_posts(db: Session = Depends(get_db)):
    """
    Returns only APPROVED community posts (public feed).
    Citizens see this; pending/rejected posts are hidden.
    """
    return (
        db.query(models.CommunityPost)
        .filter(models.CommunityPost.status == "approved")
        .order_by(models.CommunityPost.created_at.desc())
        .all()
    )


# ── List pending posts (officer / admin only) ────────────────────────────────
@router.get("/pending", response_model=List[schemas.CommunityPostOut])
def get_pending_community_posts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        auth.require_role(["officer", "admin", "reviewer", "district_admin", "state_admin"])
    ),
):
    """
    Returns all PENDING community posts awaiting review.
    Only accessible by officers and admins.
    """
    return (
        db.query(models.CommunityPost)
        .filter(models.CommunityPost.status == "pending")
        .order_by(models.CommunityPost.created_at.desc())
        .all()
    )


# ── Create a new post ────────────────────────────────────────────────────────
from .ws import manager

@router.post("", response_model=schemas.CommunityPostOut)
async def create_community_post(
    post_in: schemas.CommunityPostCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        auth.require_role(["citizen", "officer", "admin", "reviewer", "district_admin", "state_admin"])
    ),
):
    """
    Creates a new community board post.
    - Citizens: post goes to status='pending' (awaiting officer/admin approval).
    - Officers / Admins: post is immediately 'approved' and broadcast.
    """
    # Determine initial status based on role
    officer_admin_roles = {"officer", "admin", "reviewer", "district_admin", "state_admin"}
    initial_status = "approved" if current_user.role in officer_admin_roles else "pending"

    image_url = post_in.image_url or "/uploads/community_19bbe54b-1fc2-47d8-a025-e588c420bc69.jpg"

    db_post = models.CommunityPost(
        title=post_in.title,
        content=post_in.content,
        category=post_in.category,
        contact_info=post_in.contact_info,
        image_url=image_url,
        status=initial_status,
        user_id=current_user.id,
    )
    db.add(db_post)
    db.commit()
    db.refresh(db_post)

    # Only broadcast immediately if approved
    if initial_status == "approved":
        await _broadcast_post(db_post, current_user, db)

    return db_post


# ── Review (approve / reject) a pending post ────────────────────────────────
class ReviewBody(BaseModel):
    action: str  # "approve" | "reject"


@router.put("/{post_id}/review", response_model=schemas.CommunityPostOut)
async def review_community_post(
    post_id: int,
    body: ReviewBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        auth.require_role(["officer", "admin", "reviewer", "district_admin", "state_admin"])
    ),
):
    """
    Officer / Admin approves or rejects a pending community post.
    On approval the post is broadcast via WebSocket and WhatsApp.
    """
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Community post not found.")

    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'.")

    if body.action == "approve":
        post.status = "approved"
        db.commit()
        db.refresh(post)
        # Broadcast to all connected clients + WhatsApp
        await _broadcast_post(post, current_user, db)
    else:
        post.status = "rejected"
        db.commit()
        db.refresh(post)

    return post


# ── Delete a post ────────────────────────────────────────────────────────────
@router.delete("/{post_id}")
def delete_community_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Deletes a community board post.
    Admins/officers or the post author can delete.
    """
    post = db.query(models.CommunityPost).filter(models.CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Community post not found.")

    admin_roles = {"admin", "officer", "state_admin", "district_admin", "reviewer"}
    is_admin = current_user.role in admin_roles
    is_author = post.user_id == current_user.id

    if not (is_admin or is_author):
        raise HTTPException(status_code=403, detail="You do not have permission to delete this post.")

    db.delete(post)
    db.commit()
    return {"status": "success", "message": f"Community post #{post_id} deleted successfully."}


# ── Internal helper ──────────────────────────────────────────────────────────
async def _broadcast_post(db_post: models.CommunityPost, current_user: models.User, db: Session):
    """Broadcast an approved community post via WebSocket and WhatsApp."""
    try:
        await manager.broadcast({
            "type": "COMMUNITY_ALERT_BROADCAST",
            "data": {
                "id": db_post.id,
                "title": db_post.title,
                "content": db_post.content,
                "category": db_post.category,
                "contact_info": db_post.contact_info,
                "image_url": db_post.image_url,
                "created_at": db_post.created_at.isoformat() if db_post.created_at else None,
                "username": current_user.username if current_user else "Anonymous",
            },
        })
    except Exception as e:
        logger.error(f"WebSocket broadcast failed: {e}")

    try:
        from .complaints import broadcast_community_post_alert
        await broadcast_community_post_alert(db, db_post)
    except Exception as e:
        logger.error(f"WhatsApp broadcast failed: {e}")
