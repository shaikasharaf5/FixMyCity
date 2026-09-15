import os
from pathlib import Path
from unittest.mock import patch

os.environ["TWILIO_VALIDATE_SIGNATURES"] = "false"

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app import models


def test_photo_then_location_creates_one_whatsapp_complaint():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()
    db.add(models.Department(name="Roads & Buildings", code="RND"))
    db.commit()

    def override_db():
        try:
            yield db
        finally:
            pass

    async def fake_download(_url: str, _content_type: str):
        image_path = Path(__file__).parent / "uploads" / "pothole_a.jpg"
        return "/uploads/pothole_a.jpg", image_path

    app.dependency_overrides[get_db] = override_db
    client = TestClient(app)

    with patch("app.routers.twilio_whatsapp._download_twilio_image", fake_download), patch(
        "app.routers.twilio_whatsapp._analyse_photo",
        return_value={
            "category": "Pothole",
            "severity": "high",
            "confidence": 0.94,
            "department": "Roads & Buildings",
        },
    ), patch("app.routers.twilio_whatsapp._extract_exif_gps", return_value=None):
        photo = client.post(
            "/api/integrations/twilio/whatsapp",
            data={
                "From": "whatsapp:+919900001111",
                "MessageSid": "SM_PHOTO_TEST",
                "NumMedia": "1",
                "MediaUrl0": "https://api.twilio.test/photo",
                "MediaContentType0": "image/jpeg",
            },
        )
        assert photo.status_code == 200
        assert "Photo analysed: Pothole" in photo.text

        location = client.post(
            "/api/integrations/twilio/whatsapp",
            data={
                "From": "whatsapp:+919900001111",
                "MessageSid": "SM_LOCATION_TEST",
                "NumMedia": "0",
                "Latitude": "17.4485",
                "Longitude": "78.3741",
            },
        )
        assert location.status_code == 200
        assert "registered successfully" in location.text
        complaint = db.query(models.Complaint).one()
        assert complaint.reporter_phone == "919900001111"
        assert complaint.before_image_url == "/uploads/pothole_a.jpg"

        retry = client.post(
            "/api/integrations/twilio/whatsapp",
            data={
                "From": "whatsapp:+919900001111",
                "MessageSid": "SM_LOCATION_TEST",
                "NumMedia": "0",
                "Latitude": "17.4485",
                "Longitude": "78.3741",
            },
        )
        assert "already registered" in retry.text
        assert db.query(models.Complaint).count() == 1

        legacy_url = client.post(
            "/api/complaints/webhook",
            data={
                "From": "whatsapp:+919900002222",
                "MessageSid": "SM_LEGACY_URL_TEST",
                "NumMedia": "0",
                "Body": "Hi",
            },
        )
        assert legacy_url.status_code == 200
        assert "Send one clear photo" in legacy_url.text

    app.dependency_overrides.clear()
    db.close()
