import os
from fastapi import FastAPI, Request, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal, get_db
from . import models, schemas, crud
from .routers import auth, complaints, departments, analytics, ws, chatbot, community, twilio_whatsapp, locations

# Create database tables
Base.metadata.create_all(bind=engine)
from .migrations import upgrade_complaint_workflow
upgrade_complaint_workflow(engine)

app = FastAPI(
    title="CiviTrack AI API",
    description="AI-Powered Smart Civic Infrastructure Management Platform Backend",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create uploads directory if not exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount uploads static folder
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Include routers
app.include_router(auth.router)
app.include_router(complaints.router)
app.include_router(departments.router)
app.include_router(analytics.router)
app.include_router(ws.router)
app.include_router(chatbot.router)
app.include_router(community.router)
app.include_router(twilio_whatsapp.router)
app.include_router(locations.router)

# Seed database on startup
@app.on_event("startup")
def startup_db_seed():
    db: Session = SessionLocal()
    try:
        # 1. Seed Departments
        departments_data = [
            {"name": "Roads & Buildings", "code": "RND"},
            {"name": "Water Supply & Sewerage", "code": "WSS"},
            {"name": "Waste Management", "code": "WM"},
            {"name": "Electricity Board", "code": "EB"}
        ]
        for dept in departments_data:
            existing = db.query(models.Department).filter(models.Department.code == dept["code"]).first()
            if not existing:
                new_dept = models.Department(name=dept["name"], code=dept["code"])
                db.add(new_dept)
        db.commit()

        # 2. Seed default admin, officer, and citizen users for instant testing/presentation
        # Standard passwords: 'password123'
        from .auth import get_password_hash
        hashed_pw = get_password_hash("password123")
        
        users_to_seed = [
            {"username": "admin", "email": "admin@civicsense.gov.in", "role": "state_admin", "phone_number": "910000000001"},
            {"username": "hyderabad_admin", "email": "hydadmin@civicsense.gov.in", "role": "district_admin", "phone_number": "910000000002"},
            {"username": "officer1", "email": "officer1@civicsense.gov.in", "role": "officer", "dept_code": "RND", "phone_number": "910000000013"},
            {"username": "officer_road", "email": "officer.road@civicsense.gov.in", "role": "officer", "dept_code": "RND", "phone_number": "910000000003"},
            {"username": "officer_water", "email": "officer.water@civicsense.gov.in", "role": "officer", "dept_code": "WSS", "phone_number": "910000000014"},
            {"username": "officer_waste", "email": "officer.waste@civicsense.gov.in", "role": "officer", "dept_code": "WM", "phone_number": "910000000004"},
            {"username": "officer_electric", "email": "officer.electric@civicsense.gov.in", "role": "officer", "dept_code": "EB", "phone_number": "910000000015"},
            {"username": "officer_review", "email": "reviewer@civicsense.gov.in", "role": "reviewer", "phone_number": "910000000005"},
            {"username": "citizen1", "email": "citizen1@gmail.com", "role": "citizen", "phone_number": "919988776656"},
            {"username": "citizen_demo", "email": "citizen@gmail.com", "role": "citizen", "phone_number": "919988776655"}
        ]

        for user_seed in users_to_seed:
            existing_user = db.query(models.User).filter(models.User.username == user_seed["username"]).first()
            if existing_user and user_seed["username"] in {"admin", "citizen1", "officer1"}:
                # Keep the three presentation identities deterministic for one-click role access.
                existing_user.hashed_password = hashed_pw
                existing_user.role = user_seed["role"]
                db.commit()
            if not existing_user:
                new_user = models.User(
                    username=user_seed["username"],
                    email=user_seed["email"],
                    hashed_password=hashed_pw,
                    role=user_seed["role"],
                    phone_number=user_seed.get("phone_number")
                )
                db.add(new_user)
                db.commit()
                db.refresh(new_user)

                # Provision Officer profile
                if user_seed["role"] == "officer" and "dept_code" in user_seed:
                    dept = db.query(models.Department).filter(models.Department.code == user_seed["dept_code"]).first()
                    if dept:
                        new_officer = models.Officer(
                            user_id=new_user.id,
                            department_id=dept.id,
                            district="Hyderabad"
                        )
                        db.add(new_officer)
                        db.commit()
        # Seeding of default complaints disabled to support fresh data only
        # citizen = db.query(models.User).filter(models.User.username == "citizen_demo").first()
        # if citizen:
        #     # Get department IDs
        #     rnd_dept = db.query(models.Department).filter(models.Department.code == "RND").first()
        #     wm_dept = db.query(models.Department).filter(models.Department.code == "WM").first()
        #     # Define complaints
        #     complaint_data = [
        #         {
        #             "category": "Pothole",
        #             "latitude": 17.3850,
        #             "longitude": 78.4867,
        #             "description": "Large pothole on Main St.",
        #             "district": "Hyderabad",
        #             "ward": "Ward 5",
        #             "before_image_url": "https://example.com/pothole.jpg",
        #         },
        #         {
        #             "category": "Garbage",
        #             "latitude": 17.4000,
        #             "longitude": 78.5000,
        #             "description": "Overflowing garbage bin.",
        #             "district": "Hyderabad",
        #             "ward": "Ward 7",
        #             "before_image_url": "https://example.com/garbage.jpg",
        #         },
        #         {
        #             "category": "Water Leakage",
        #             "latitude": 17.3900,
        #             "longitude": 78.4700,
        #             "description": "Pipe leakage causing water logging.",
        #             "district": "Hyderabad",
        #             "ward": "Ward 3",
        #             "before_image_url": "https://example.com/leakage.jpg",
        #         },
        #     ]
        #     for comp in complaint_data:
        #         complaint_schema = schemas.ComplaintCreate(**comp)
        #         crud.create_complaint(
        #             db,
        #             complaint_schema,
        #             citizen_id=citizen.id,
        #             severity="high",
        #             department_id=rnd_dept.id if comp["category"] != "Garbage" else wm_dept.id,
        #             description=comp["description"],
        #         )

        print("Database seeding completed successfully.")
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()

from fastapi.responses import PlainTextResponse, FileResponse
from fastapi import HTTPException

FRONTEND_DIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
    "frontend", "dist"
)

if os.path.exists(FRONTEND_DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST_DIR, "assets")), name="frontend-assets")

@app.get("/")
def read_root():
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "status": "online",
        "platform": "CiviTrack AI",
        "version": "1.0.0",
        "documentation": "/docs"
    }

@app.get("/webhook")
async def verify_webhook_root(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge")
):
    """
    Root endpoint for WhatsApp Webhook verification.
    """
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN")
    if verify_token and hub_mode == "subscribe" and hub_verify_token == verify_token:
        return PlainTextResponse(content=hub_challenge)
    return PlainTextResponse(content="Verification failed", status_code=403)

@app.post("/webhook")
async def receive_webhook_root(request: Request, db: Session = Depends(get_db)):
    """
    Root endpoint for incoming WhatsApp messages/status webhooks.
    """
    return await complaints.receive_whatsapp_webhook(request, db)

@app.get("/{path_name:path}")
async def serve_frontend_fallback(path_name: str):
    """
    Fallback catch-all route to serve the React application index.html for frontend client routing.
    """
    if path_name.startswith("api") or path_name.startswith("webhook") or path_name.startswith("docs") or path_name.startswith("openapi.json"):
        raise HTTPException(status_code=404, detail="Not Found")
    
    index_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Frontend build not found.")
