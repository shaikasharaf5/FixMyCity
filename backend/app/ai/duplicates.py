import math
from sqlalchemy.orm import Session
from .. import models

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes the great-circle distance between two points on the Earth's surface
    using the Haversine formula. Returns distance in meters.
    """
    # Earth's radius in kilometers
    R = 6371.0
    
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(d_lat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    # Distance in meters
    distance = R * c * 1000.0
    return distance

def find_duplicate_complaint(
    db: Session, 
    latitude: float, 
    longitude: float, 
    category: str, 
    max_distance_meters: float = 50.0
) -> models.Complaint | None:
    """
    Searches the database for active (non-resolved, non-duplicate) complaints 
    of the same category within max_distance_meters of the given coordinates.
    """
    # Query all active complaints of the same category
    active_complaints = db.query(models.Complaint).filter(
        models.Complaint.category == category,
        models.Complaint.status.notin_(["resolved", "duplicate"]),
        models.Complaint.duplicate_of_id.is_(None)
    ).all()
    
    for complaint in active_complaints:
        dist = haversine_distance(latitude, longitude, complaint.latitude, complaint.longitude)
        if dist <= max_distance_meters:
            return complaint
            
    return None
