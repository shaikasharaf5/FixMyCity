import os
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

# Sample images available in backend/uploads
BEFORE_IMAGES = {
    "Pothole": ["/uploads/pothole_a.jpg", "/uploads/pothole_b.jpg"],
    "Garbage": ["/uploads/garbage_b.jpg", "/uploads/whatsapp_simulated_0855624d-19a3-4a63-86ce-fb78c90e29fe.png"],
    "Water Leakage": ["/uploads/leak_a.jpg", "/uploads/leak_b.jpg"],
    "Open Manhole": ["/uploads/manhole_b.jpg"],
    "Fallen Tree": ["/uploads/whatsapp_simulated_1ae8df39-e8f2-4a63-8bd0-0dfdd6475dc8.webp"],
    "Electric Pole Damage": ["/uploads/whatsapp_simulated_fe72d4b4-201b-4f71-99ed-45dc869bba28.jpg"],
    "Flooded Road": ["/uploads/twilio_1d36b9fa-6e31-4d14-992a-751a08410c16.jpg"],
    "Broken Traffic Sign": ["/uploads/twilio_4d093e79-079e-4565-a329-569a784b12e9.jpg"],
    "Broken Streetlight": ["/uploads/twilio_faf02e9a-5733-4b8e-86c3-ab4971e0a590.jpg"]
}

AFTER_IMAGES = {
    "Pothole": ["/uploads/pothole_b.jpg"],
    "Garbage": ["/uploads/whatsapp_simulated_0855624d-19a3-4a63-86ce-fb78c90e29fe.png"],
    "Water Leakage": ["/uploads/leak_b.jpg"],
    "Open Manhole": ["/uploads/manhole_b.jpg"]
}

# Coordinate map for districts in Telangana
DISTRICT_CENTERS = {
    "Hyderabad": [17.3850, 78.4867],
    "Rangareddy": [17.1812, 78.4239],
    "Medchal-Malkajgiri": [17.5683, 78.5314],
    "Warangal": [17.9689, 79.5941],
    "Karimnagar": [18.4386, 79.1288],
    "Nalgonda": [17.0575, 79.2684],
    "Nizamabad": [18.6725, 78.0941],
    "Khammam": [17.2473, 80.1514]
}

DISTRICT_WARDS = {
    "Hyderabad": ["Kukatpally", "Madhapur", "Jubilee Hills", "Banjara Hills", "Khairatabad", "Mehdipatnam"],
    "Rangareddy": ["Gachibowli", "Sherilingampally", "Rajendranagar", "Narsingi", "Manikonda"],
    "Medchal-Malkajgiri": ["Alwal", "Malkajgiri", "Kompally", "Medchal Town", "Quthbullapur"],
    "Warangal": ["Warangal Fort", "Narsampet", "Wardhannapet", "Geesugonda", "Rayaparthy"],
    "Karimnagar": ["Karimnagar Town", "Huzurabad", "Choppadandi", "Manakondur", "Kothapally"]
}

SEVERITY_LEVELS = ["low", "medium", "high", "critical"]
STATUS_OPTIONS = ["pending", "under_review", "assigned", "in_progress", "resolved"]

COMPLAINT_TEMPLATES = {
    "Pothole": "Deep pothole reported on the main road segment. High hazard for two-wheelers during night driving.",
    "Garbage": "Uncontrolled public garbage dump blocking the pedestrian walkway. Foul smell emanating from the site.",
    "Water Leakage": "Drinking water pipeline leak causing massive wastage and waterlogging on the side streets.",
    "Open Manhole": "Hazardous open manhole on the main crossing. Extremely dangerous, requires immediate gating.",
    "Fallen Tree": "Large tree branch collapsed across the traffic lane. Minor congestion reported in the area.",
    "Electric Pole Damage": "Electric utility pole tilted at a dangerous angle. Exposed wiring sparking during light rain.",
    "Flooded Road": "Heavy waterlogging near storm drain entrance. Commuters are facing issues navigating this intersection.",
    "Broken Traffic Sign": "Major speed limit and navigation sign knocked down. Causing lane confusion.",
    "Broken Streetlight": "Streetlights inactive for 3 blocks. Neighborhood is pitch black and unsafe at night."
}

def seed_data():
    db = SessionLocal()
    try:
        existing_count = db.query(models.Complaint).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} complaints. Preserving existing data.")
            return

        print("Fetching Departments and Users...")
        departments = db.query(models.Department).all()
        dept_map = {d.code: d for d in departments}

        # Department mappings
        category_depts = {
            "Pothole": "RND",
            "Garbage": "WM",
            "Water Leakage": "WSS",
            "Open Manhole": "WSS",
            "Fallen Tree": "RND",
            "Electric Pole Damage": "EB",
            "Flooded Road": "RND",
            "Broken Traffic Sign": "RND",
            "Broken Streetlight": "EB"
        }

        citizen = db.query(models.User).filter(models.User.role == "citizen").first()
        citizen_id = citizen.id if citizen else 1

        officers = db.query(models.Officer).all()
        officer_map = {o.department.code: o for o in officers if o.department}

        print("Generating realistic mock complaints...")
        complaints_list = []

        # Create around 50 complaints
        for i in range(1, 55):
            category = random.choice(list(COMPLAINT_TEMPLATES.keys()))
            description_base = COMPLAINT_TEMPLATES[category]
            description = f"{description_base} [Mock Telemetry Incident #{i:03d}]"
            
            # Select district and coordinates
            district = random.choice(list(DISTRICT_CENTERS.keys()))
            center = DISTRICT_CENTERS[district]
            
            # Add small random offset to center coordinates (Telangana region)
            lat = center[0] + random.uniform(-0.04, 0.04)
            lon = center[1] + random.uniform(-0.04, 0.04)
            
            wards = DISTRICT_WARDS.get(district, ["Sector 1", "Sector 2", "Ward A", "Ward B"])
            ward = random.choice(wards)

            severity = random.choice(SEVERITY_LEVELS)
            status = random.choice(STATUS_OPTIONS)

            # Map department
            dept_code = category_depts.get(category, "RND")
            dept = dept_map.get(dept_code)
            dept_id = dept.id if dept else None

            # Get images
            before_imgs = BEFORE_IMAGES.get(category, ["/uploads/pothole_a.jpg"])
            before_img = random.choice(before_imgs)
            after_img = None
            if status == "resolved":
                after_imgs = AFTER_IMAGES.get(category, ["/uploads/pothole_b.jpg"])
                after_img = random.choice(after_imgs)

            # Assign officer if in progress or resolved
            officer_id = None
            if status in ["assigned", "in_progress", "resolved"]:
                off = officer_map.get(dept_code)
                if off:
                    officer_id = off.id

            upvotes = random.randint(1, 45)
            
            # Random date within last 30 days
            created_at = datetime.utcnow() - timedelta(days=random.randint(1, 30), hours=random.randint(0, 23))

            complaint = models.Complaint(
                citizen_id=citizen_id,
                department_id=dept_id,
                category=category,
                severity=severity,
                description=description,
                latitude=lat,
                longitude=lon,
                district=district,
                ward=ward,
                status=status,
                upvotes=upvotes,
                before_image_url=before_img,
                after_image_url=after_img,
                officer_id=officer_id,
                created_at=created_at,
                updated_at=created_at + timedelta(days=random.randint(1, 2)) if status == "resolved" else created_at
            )
            complaints_list.append(complaint)
            db.add(complaint)

        db.commit()
        print(f"Successfully seeded {len(complaints_list)} complaints across Telangana.")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
