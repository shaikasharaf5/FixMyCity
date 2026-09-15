import os
from sqlalchemy.orm import Session
from app import crud, models, schemas, database
from app.auth import get_password_hash

# Ensure tables exist
models.Base.metadata.create_all(bind=database.engine)

# ── Demo credentials for quick login ───────────────────────────────────────
DEMO_USERS = [
    {
        "username": "citizen_demo",
        "email": "citizen_demo@example.com",
        "role": "citizen",
        "password": "password123",
        "phone_number": "1234567890",
    },
    {
        "username": "citizen1",
        "email": "citizen1@example.com",
        "role": "citizen",
        "password": "password123",
        "phone_number": "1234567891",
    },
    {
        "username": "officer",
        "email": "officer@example.com",
        "role": "officer",
        "password": "password123",
        "phone_number": "1111111111",
        "department_code": "RND",
    },
    {
        "username": "officer1",
        "email": "officer1@example.com",
        "role": "officer",
        "password": "password123",
        "phone_number": "1111111112",
        "department_code": "RND",
    },
    {
        "username": "officer_road",
        "email": "officer_road@example.com",
        "role": "officer",
        "password": "password123",
        "phone_number": "1111111113",
        "department_code": "RND",
    },
    {
        "username": "officer_waste",
        "email": "officer_waste@example.com",
        "role": "officer",
        "password": "password123",
        "phone_number": "1111111114",
        "department_code": "WM",
    },
    {
        "username": "officer_review",
        "email": "officer_review@example.com",
        "role": "officer",
        "password": "password123",
        "phone_number": "1111111115",
        "department_code": "RND",
    },
    {
        "username": "hyderabad_admin",
        "email": "hyderabad_admin@example.com",
        "role": "admin",
        "password": "password123",
        "phone_number": "9999999998",
    },
    {
        "username": "admin",
        "email": "admin@example.com",
        "role": "admin",
        "password": "password123",
        "phone_number": "9999999999",
    },
]


def get_or_create_department(db: Session, code: str):
    dept = crud.get_department_by_code(db, code)
    if not dept:
        dept = models.Department(name=code + " Department", code=code)
        db.add(dept)
        db.commit()
        db.refresh(dept)
    return dept


def seed_demo():
    db = database.SessionLocal()
    try:
        for u in DEMO_USERS:
            existing = crud.get_user_by_username(db, u["username"])
            if existing:
                # Refresh password to known demo password
                existing.hashed_password = get_password_hash(u["password"])
                existing.role = u["role"]
                db.commit()
                print(f"  Updated: {u['username']} ({u['role']})")
                continue

            user_in = schemas.UserCreate(
                username=u["username"],
                email=u["email"],
                password=u["password"],
                role=u["role"],
                phone_number=u.get("phone_number", ""),
            )
            db_user = crud.create_user(db, user_in)

            # Create Officer entity for the 'officer' role
            if u["role"] == "officer":
                dept = get_or_create_department(db, u.get("department_code", "RD"))
                officer_in = schemas.OfficerCreate(
                    user_id=db_user.id,
                    department_id=dept.id,
                    district="Hyderabad",
                )
                crud.create_officer(db, officer_in)

            print(f"  Created:  {u['username']} ({u['role']})")

        db.commit()
        print("\n  Demo users seeded - 3 credentials ready:")
        print("   citizen_demo / password123")
        print("   officer      / password123")
        print("   admin        / password123")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
