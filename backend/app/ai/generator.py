import random

HAZARDS = {
    "Pothole": "vehicular safety, causing sudden braking and potential wheel rim/suspension damage on high-speed routes.",
    "Damaged Road": "general safety, leading to traffic jams and increased risks of head-on collisions due to lane deviation.",
    "Garbage": "public hygiene and sanitation, attracting vermin, causing foul odors, and posing biohazard risks to residents.",
    "Water Leakage": "infrastructure stability and water wastage, causing pavement erosion and reducing water supply pressure.",
    "Open Manhole": "extreme pedestrian and vehicle danger, representing a direct falling hazard, especially during low light or rains.",
    "Fallen Tree": "traffic obstruction and blockages, potentially damaging overhead wires or blocking emergency response vehicles.",
    "Electric Pole Damage": "electrocution and fire hazards, risking localized power failures and severe safety threats to pedestrians.",
    "Flooded Road": "vehicle engine failures, structural damage to asphalt, and breeding grounds for vector-borne diseases.",
    "Broken Traffic Sign": "traffic confusion, risking high-speed collisions at intersections due to lack of standard regulatory warnings.",
    "Broken Streetlight": "street safety, increasing nighttime crime risks and decreasing visibility for drivers, leading to accidents."
}

def generate_complaint_description(
    category: str, 
    severity: str, 
    district: str, 
    ward: str, 
    latitude: float, 
    longitude: float, 
    department: str
) -> str:
    """
    Generates a highly professional and structured complaint description 
    acting as an automated AI dispatcher note.
    """
    if category == "None":
        return "No issues to report. The uploaded image does not contain any active municipal defects or civic issues."

    hazard = HAZARDS.get(category, "public safety and normal civilian operations.")
    
    # Define templates to add variability
    intro_options = [
        f"Critical Infrastructure Notice: A {severity.upper()} severity {category} has been detected in {district} district (Ward: {ward}).",
        f"Automated Smart City Dispatch: A {severity.upper()} priority {category} is registered at coordinates {latitude:.5f}, {longitude:.5f} ({district} - Ward {ward}).",
        f"Civic Monitoring Alert: Inspected {category} issue flagged as {severity.upper()} severity in {district} District, Ward {ward}."
    ]
    
    body_options = [
        f"The issue presents a direct risk to {hazard} Immediate inspection and restoration activities are recommended to restore normal operations.",
        f"This condition is identified as an active threat to {hazard} The responsible field engineers should initiate standard repair procedures.",
        f"Localized assessment indicates concern regarding {hazard} We advise assigning a repair crew to prevent further degradation of municipal assets."
    ]
    
    concl_options = [
        f"Automated routing has dispatched this task to the {department} Department. Expected action: Assess, assign crew, and document before/after resolution.",
        f"The {department} Department has been notified for queue planning, site inspection, and status reporting in the municipal dashboard.",
        f"This task is auto-routed to the {department} Department for priority resolution. Live map pin has been enabled for public tracking."
    ]

    intro = random.choice(intro_options)
    body = random.choice(body_options)
    concl = random.choice(concl_options)
    
    return f"{intro}\n\n{body}\n\n{concl}"
