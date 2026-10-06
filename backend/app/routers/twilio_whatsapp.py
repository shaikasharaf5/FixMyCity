import json
import asyncio
import logging
import mimetypes
import os
import re
import uuid
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from PIL import Image
from sqlalchemy.orm import Session
from starlette.requests import ClientDisconnect
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from .. import crud, models, schemas
from ..ai import detector, duplicates, generator
from ..database import get_db
from .ws import manager

logger = logging.getLogger("civitrack.twilio")
router = APIRouter(prefix="/api/integrations/twilio", tags=["Twilio WhatsApp"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_BYTES = 12 * 1024 * 1024
SUPPORTED_IMAGES = {"image/jpeg", "image/png", "image/webp"}
LOW_CONFIDENCE_THRESHOLD = 0.30


def _clean_phone(value: str) -> str:
    return value.replace("whatsapp:", "").replace("+", "").strip()


def _reply(message: str, status_code: int = 200) -> Response:
    twiml = MessagingResponse()
    twiml.message(message)
    return Response(content=str(twiml), media_type="application/xml", status_code=status_code)


def _webhook_url(request: Request) -> str:
    # Use the exact public URL configured in Twilio when a reverse proxy rewrites host/scheme.
    configured = os.getenv("TWILIO_WEBHOOK_URL")
    if configured:
        configured_parts = urlsplit(configured)
        if configured_parts.path and configured_parts.path != request.url.path:
            query = f"?{request.url.query}" if request.url.query else ""
            return f"{configured_parts.scheme}://{configured_parts.netloc}{request.url.path}{query}"
        return configured
    public_base = os.getenv("NGROK_URL")
    if public_base:
        query = f"?{request.url.query}" if request.url.query else ""
        return f"{public_base.rstrip('/')}{request.url.path}{query}"
    return str(request.url)


def _validate_signature(request: Request, form: object) -> None:
    should_validate = os.getenv("TWILIO_VALIDATE_SIGNATURES", "true").lower() not in {"0", "false", "no"}
    if not should_validate:
        return
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    if not auth_token:
        raise HTTPException(status_code=503, detail="TWILIO_AUTH_TOKEN is not configured")
    signature = request.headers.get("X-Twilio-Signature", "")
    if not signature or not RequestValidator(auth_token).validate(_webhook_url(request), form, signature):
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")


def _parse_coordinates(text: str) -> Optional[tuple[float, float]]:
    patterns = (
        r"lat(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*[,; ]+\s*(?:lon|lng|longitude)\s*[:=]\s*(-?\d+(?:\.\d+)?)",
        r"(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            lat, lon = float(match.group(1)), float(match.group(2))
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return lat, lon
    return None


def _rational(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        numerator, denominator = value  # type: ignore[misc]
        return float(numerator) / float(denominator)


def _dms_to_decimal(values: object, ref: str) -> float:
    degrees, minutes, seconds = values  # type: ignore[misc]
    result = _rational(degrees) + _rational(minutes) / 60 + _rational(seconds) / 3600
    return -result if ref in {"S", "W"} else result


def _extract_exif_gps(image_path: Path) -> Optional[tuple[float, float]]:
    try:
        with Image.open(image_path) as image:
            exif = image.getexif()
            gps = exif.get_ifd(34853) if exif else None
            if not gps or 2 not in gps or 4 not in gps:
                return None
            lat = _dms_to_decimal(gps[2], str(gps.get(1, "N")))
            lon = _dms_to_decimal(gps[4], str(gps.get(3, "E")))
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return lat, lon
    except Exception as exc:
        logger.info("No readable GPS metadata in WhatsApp image: %s", exc)
    return None


async def _download_twilio_image(media_url: str, declared_type: str) -> tuple[str, Path]:
    if declared_type not in SUPPORTED_IMAGES:
        raise ValueError("Only JPEG, PNG, and WebP photos are supported")

    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    if not account_sid or not auth_token:
        raise RuntimeError("Twilio credentials are not configured")

    extension = mimetypes.guess_extension(declared_type) or ".jpg"
    if extension == ".jpe":
        extension = ".jpg"
    filename = f"twilio_{uuid.uuid4()}{extension}"
    file_path = UPLOAD_DIR / filename
    total = 0

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=25) as client:
            for attempt in range(3):
                try:
                    async with client.stream("GET", media_url, auth=(account_sid, auth_token)) as response:
                        response.raise_for_status()
                        actual_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
                        if actual_type and actual_type not in SUPPORTED_IMAGES:
                            raise ValueError("Twilio media is not a supported photo")
                        with file_path.open("wb") as output:
                            async for chunk in response.aiter_bytes():
                                total += len(chunk)
                                if total > MAX_IMAGE_BYTES:
                                    raise ValueError("Photo exceeds the 12 MB processing limit")
                                output.write(chunk)
                    break
                except httpx.ConnectError:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(1)
        if total == 0:
            raise ValueError("Twilio returned an empty media file")
        return f"/uploads/{filename}", file_path
    except Exception:
        file_path.unlink(missing_ok=True)
        raise


def _analyse_photo(file_path: Path) -> dict:
    result = detector.run_object_detection(str(file_path))
    category = result.get("category") or "Unclassified Civic Issue"
    if category == "None":
        category = "Unclassified Civic Issue"
    return {
        "category": category,
        "severity": result.get("severity") or "medium",
        "confidence": float(result.get("confidence") or 0),
        "department": result.get("department") or detector.CATEGORY_TO_DEPT.get(category, "Roads & Buildings"),
    }


async def _create_complaint(db: Session, phone: str, image_url: str, draft: dict, lat: float, lon: float) -> models.Complaint:
    location = detector.localGeofenceLookup(lat, lon)
    category = draft["category"]
    severity = draft["severity"]
    department_name = draft["department"]
    department = crud.get_department_by_name(db, name=department_name)
    if not department:
        code = "".join(word[0] for word in department_name.split()).upper()[:12]
        department = crud.create_department(db, schemas.DepartmentCreate(name=department_name, code=code))

    citizen = db.query(models.User).filter(models.User.phone_number == phone).first()
    description = draft.get("user_description") or generator.generate_complaint_description(
        category=category,
        severity=severity,
        district=location["district"],
        ward=location["ward"],
        latitude=lat,
        longitude=lon,
        department=department_name,
    )
    complaint = models.Complaint(
        citizen_id=citizen.id if citizen else None,
        reporter_phone=phone,
        department_id=department.id,
        category=category,
        severity=severity,
        description=description,
        latitude=lat,
        longitude=lon,
        district=location["district"],
        ward=location["ward"],
        before_image_url=image_url,
        status="pending",
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    crud.create_audit_log(
        db,
        user_id=citizen.id if citizen else None,
        action="CREATE_COMPLAINT_WHATSAPP",
        target_type="complaint",
        target_id=complaint.id,
        details=f"Twilio WhatsApp photo classified as {category} and routed to {department_name}",
    )
    payload = schemas.ComplaintOut.model_validate(complaint).model_dump(mode="json")
    await manager.notify_officers_new_complaint(payload, complaint.district, department.id)
    return complaint


def _remember_event(db: Session, sid: str, phone: str, status: str, complaint_id: int | None = None) -> None:
    event = db.query(models.TwilioInboundEvent).filter(models.TwilioInboundEvent.message_sid == sid).first()
    if not event:
        db.add(models.TwilioInboundEvent(message_sid=sid, sender_phone=phone, status=status, complaint_id=complaint_id))
    else:
        event.status = status
        event.complaint_id = complaint_id
    db.commit()


def _success_message(complaint: models.Complaint) -> str:
    return (
        f"Complaint CT-{complaint.id:05d} registered successfully.\n"
        f"Detected: {complaint.category} ({complaint.severity.upper()})\n"
        f"Assigned department: {complaint.department.name if complaint.department else 'Municipal control room'}\n"
        f"Location: {complaint.district}, {complaint.ward}\n"
        "The Central Room can now review and assign an officer."
    )

def _public_feed_url(complaint_id: int) -> str:
    configured = os.getenv("WEBSITE_URL", "").strip().rstrip("/")
    if not configured or "your-civitrack-domain.example" in configured:
        webhook = os.getenv("TWILIO_WEBHOOK_URL", "")
        configured = webhook.split("/api/", 1)[0].rstrip("/") or "http://localhost:5173"
    return f"{configured}/community?complaint={complaint_id}"

def _comparison_description(draft: dict) -> str:
    return draft.get("user_description") or draft.get("caption") or draft.get("category", "")


@router.post("/whatsapp", response_class=Response)
async def receive_twilio_whatsapp(request: Request, db: Session = Depends(get_db)) -> Response:
    """Receive real Twilio WhatsApp photos and convert them into actionable complaints."""
    try:
        form = await request.form()
    except ClientDisconnect:
        logger.warning("Twilio disconnected before the WhatsApp form was fully received")
        return _reply("We did not receive the complete WhatsApp message. Please resend the photo.")
    _validate_signature(request, form)

    phone = _clean_phone(str(form.get("From", "")))
    message_sid = str(form.get("MessageSid", ""))
    body = str(form.get("Body", "")).strip()
    if not phone or not message_sid:
        return _reply("The sender or message identifier is missing. Please try again.", 400)

    existing = db.query(models.TwilioInboundEvent).filter(models.TwilioInboundEvent.message_sid == message_sid).first()
    if existing:
        if existing.complaint_id:
            return _reply(f"Complaint CT-{existing.complaint_id:05d} was already registered from this message.")
        return _reply("This message was already received and is being processed.")

    latitude = form.get("Latitude")
    longitude = form.get("Longitude")
    coords = None
    if latitude and longitude:
        try:
            coords = (float(str(latitude)), float(str(longitude)))
        except ValueError:
            coords = None
    coords = coords or _parse_coordinates(body)
    media_count = int(str(form.get("NumMedia", "0")) or "0")

    if media_count > 0:
        media_url = str(form.get("MediaUrl0", ""))
        media_type = str(form.get("MediaContentType0", "")).split(";", 1)[0].lower()
        try:
            image_url, image_path = await _download_twilio_image(media_url, media_type)
            analysis = _analyse_photo(image_path)
        except (httpx.HTTPError, OSError, RuntimeError, ValueError) as exc:
            logger.warning("Twilio image processing failed for %s: %s", message_sid, exc)
            _remember_event(db, message_sid, phone, "failed")
            return _reply(f"We could not process that photo: {exc}. Please send a clear JPEG, PNG, or WebP image.")

        coords = coords or _extract_exif_gps(image_path)
        draft = {**analysis, "caption": body, "source_message_sid": message_sid}
        needs_description = analysis["category"] == "Unclassified Civic Issue" or analysis["confidence"] < LOW_CONFIDENCE_THRESHOLD
        if needs_description:
            crud.create_or_update_whatsapp_session(
                db,
                phone_number=phone,
                state="awaiting_description",
                last_image_url=image_url,
                last_media_id=json.dumps(draft),
            )
            _remember_event(db, message_sid, phone, "awaiting_description")
            return _reply(
                "I could not identify the issue confidently from this photo. "
                "Please describe the problem in a message first (for example, 'fallen tree blocking the road'). "
                "After that, share your WhatsApp location."
            )
        if coords:
            duplicate = duplicates.find_duplicate_complaint(
                db=db, latitude=coords[0], longitude=coords[1], category=draft["category"],
                description=_comparison_description(draft), max_distance_meters=20.0
            )
            if duplicate:
                return _reply(
                    f"A similar complaint already exists nearby: CT-{duplicate.id:05d}.\n"
                    f"Open the original report in the FixMyCity feed: {_public_feed_url(duplicate.id)}\n"
                    "You can like, comment, or share the original report instead."
                )
            complaint = await _create_complaint(db, phone, image_url, draft, *coords)
            _remember_event(db, message_sid, phone, "complaint_created", complaint.id)
            return _reply(_success_message(complaint))

        crud.create_or_update_whatsapp_session(
            db,
            phone_number=phone,
            state="awaiting_location",
            last_image_url=image_url,
            last_media_id=json.dumps(draft),
        )
        _remember_event(db, message_sid, phone, "awaiting_location")
        confidence = round(analysis["confidence"] * 100 if analysis["confidence"] <= 1 else analysis["confidence"])
        return _reply(
            f"Photo analysed: {analysis['category']} ({confidence}% confidence).\n"
            f"Routing: {analysis['department']}.\n"
            "Now share your current WhatsApp location. The complaint will be registered automatically."
        )

    session = crud.get_whatsapp_session(db, phone_number=phone)
    if session and session.state == "awaiting_description" and session.last_image_url and body:
        try:
            draft = json.loads(session.last_media_id or "{}")
            draft["user_description"] = body
            crud.create_or_update_whatsapp_session(
                db,
                phone_number=phone,
                state="awaiting_location",
                last_image_url=session.last_image_url,
                last_media_id=json.dumps(draft),
            )
            _remember_event(db, message_sid, phone, "awaiting_location")
            return _reply("Thanks. Now share your current WhatsApp location to register the complaint.")
        except (ValueError, json.JSONDecodeError):
            return _reply("I could not save that description. Please send the issue description again.")
    if coords and session and session.state == "awaiting_location" and session.last_image_url:
        try:
            draft = json.loads(session.last_media_id or "{}")
            if not draft.get("category"):
                raise ValueError("AI draft is missing")
            duplicate = duplicates.find_duplicate_complaint(
                db=db, latitude=coords[0], longitude=coords[1], category=draft["category"],
                description=_comparison_description(draft), max_distance_meters=20.0
            )
            if duplicate:
                return _reply(
                    f"A similar complaint already exists nearby: CT-{duplicate.id:05d}.\n"
                    f"Open the original report in the FixMyCity feed: {_public_feed_url(duplicate.id)}\n"
                    "You can like, comment, or share the original report instead."
                )
            complaint = await _create_complaint(db, phone, session.last_image_url, draft, *coords)
            _remember_event(db, message_sid, phone, "complaint_created", complaint.id)
            crud.create_or_update_whatsapp_session(db, phone, "idle", "", "")
            return _reply(_success_message(complaint))
        except (ValueError, json.JSONDecodeError) as exc:
            logger.warning("Invalid Twilio complaint draft for %s: %s", phone, exc)
            return _reply("The saved photo session expired. Please send the issue photo again.")

    _remember_event(db, message_sid, phone, "instructions_sent")
    return _reply(
        "Send one clear photo of the civic issue. CiviTrack will analyse it immediately, then ask for your exact WhatsApp location to register and route the complaint."
    )
