import logging
import threading
from PIL import Image, ImageOps

logger = logging.getLogger("civitrack.ai.detector")
_MODEL = None
_PROCESSOR = None
_TEXT_FEATURES = None
_MODEL_LOCK = threading.Lock()
CLIP_MODEL_ID = "openai/clip-vit-base-patch32"
CATEGORY_TO_DEPT = {
    "Pothole": "Roads & Buildings", "Garbage": "Waste Management",
    "Water Leakage": "Water Supply & Sewerage", "Open Manhole": "Water Supply & Sewerage",
    "Fallen Tree": "Roads & Buildings", "Electric Pole Damage": "Electricity Board",
    "Flooded Road": "Water Supply & Sewerage", "Broken Traffic Sign": "Roads & Buildings",
    "Broken Streetlight": "Electricity Board"
}
ISSUE_PROMPTS = {
    "Pothole": ["a pothole in an asphalt road", "a damaged street with a deep hole", "broken road pavement with potholes"],
    "Garbage": ["a pile of garbage dumped on the street", "scattered litter and plastic waste on the ground", "an overflowing rubbish bin with trash around it"],
    "Water Leakage": ["water leaking from a broken water pipe", "a burst water supply pipe on a street", "water flowing from a damaged roadside pipeline"],
    "Open Manhole": ["an open uncovered manhole in a street", "a missing drain cover leaving an open hole", "a broken manhole cover on a road"],
    "Fallen Tree": ["a fallen tree blocking a road", "a broken tree trunk lying across a street", "large fallen branches obstructing a sidewalk"],
    "Electric Pole Damage": ["a broken electricity utility pole with damaged wires", "a leaning damaged concrete power pole", "a fallen electric pole with hanging power cables"],
    "Flooded Road": ["a flooded street submerged in water", "a waterlogged road after heavy rain", "flood water covering a roadway"],
    "Broken Traffic Sign": ["a damaged traffic sign on a road", "a bent broken road sign", "a fallen traffic sign lying on the ground"],
    "Broken Streetlight": ["a broken streetlight with a damaged lamp", "a hanging broken street lamp fixture", "a visibly damaged street lighting fixture"],
}
# Separate healthy-scene competitors keep a normal pole/bin/tree from being
# labelled damaged simply because CLIP recognises the object.
HEALTHY_PROMPTS = [
    "a clean smooth undamaged road", "a normal upright electricity pole with intact wires",
    "a working undamaged streetlight", "a healthy standing tree", "a clean rubbish bin",
    "an intact road sign", "a closed intact manhole cover", "a normal water pipe",
    "a portrait or selfie of a person", "an indoor room", "a document or screenshot",
    "an animal", "a natural lake or river", "a normal building",
]


def region_proposals(width, height):
    """Overlapping crops, including tall crops so poles aren't centre-cropped out."""
    boxes = [(0, 0, width, height)]
    for sx, sy, positions in [(.55, .55, (0, .5, 1)), (.8, .8, (0, 1)), (.5, 1, (0, .5, 1))]:
        for px in positions:
            for py in ((0,) if sy == 1 else positions):
                w, h = max(1, round(width * sx)), max(1, round(height * sy))
                x, y = round((width - w) * px), round((height - h) * py)
                box = (x, y, x + w, y + h)
                if box not in boxes:
                    boxes.append(box)
    return boxes


def _features(value):
    # Transformers 4 returns a tensor; Transformers 5 may wrap pooled features.
    return value.pooler_output if hasattr(value, "pooler_output") else value


def _load_clip():
    global _MODEL, _PROCESSOR, _TEXT_FEATURES
    if _MODEL is not None and _TEXT_FEATURES is not None:
        return
    import torch
    from transformers import CLIPModel, CLIPProcessor
    # Prefer cached weights. A fresh installation downloads this public model once.
    try:
        model = CLIPModel.from_pretrained(CLIP_MODEL_ID, local_files_only=True)
        processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID, local_files_only=True)
    except OSError:
        model = CLIPModel.from_pretrained(CLIP_MODEL_ID)
        processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID)
    model.eval()
    groups = list(ISSUE_PROMPTS.values()) + [[prompt] for prompt in HEALTHY_PROMPTS]
    prompts = ["A photo of " + prompt.removeprefix("a ") + "." for group in groups for prompt in group]
    with torch.inference_mode():
        features = _features(model.get_text_features(**processor(text=prompts, return_tensors="pt", padding=True)))
        features = features / features.norm(dim=-1, keepdim=True)
        offset, averages = 0, []
        for group in groups:
            feature = features[offset:offset + len(group)].mean(dim=0)
            averages.append(feature / feature.norm())
            offset += len(group)
        _TEXT_FEATURES = torch.stack(averages)
    _MODEL, _PROCESSOR = model, processor


def select_issue(scores):
    """Conservative heuristic, not a calibrated probability of correctness."""
    import torch
    count = len(ISSUE_PROMPTS)
    row = scores[0]
    values, indices = row[:count].topk(2)
    index = int(indices[0])
    probability = float(torch.softmax(row * 100, dim=0)[index])
    accepted = (float(values[0]) >= .22 and float(values[0] - row[count:].max()) >= .015
                and float(values[0] - values[1]) >= .008 and probability >= .30)
    if not accepted:
        return None, probability, None
    # Localisation is a separate crop-similarity estimate. Never invent a box
    # when no crop supports the whole-image classification.
    crop_index = int(scores[1:, index].argmax()) + 1 if len(scores) > 1 else None
    if crop_index is not None:
        crop = scores[crop_index]
        others = torch.cat((crop[:index], crop[index + 1:]))
        if float(crop[index]) < float(row[index]) - .005 or float(crop[index] - others.max()) < .015:
            crop_index = None
    return index, probability, crop_index

def run_object_detection(image_path: str) -> dict:
    """CLIP prompt-ensemble classification with approximate crop localisation."""
    import torch
    with Image.open(image_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
    width, height = image.size
    proposals = region_proposals(width, height)
    with _MODEL_LOCK, torch.inference_mode():
        _load_clip()
        features = []
        for start in range(0, len(proposals), 4):
            # Letterboxing preserves the entire crop, unlike CLIP's default
            # centre crop, which can hide roadside garbage or the top of a pole.
            crops = [ImageOps.pad(image.crop(box), (224, 224), color=(123, 117, 104)) for box in proposals[start:start + 4]]
            batch = _PROCESSOR(images=crops, return_tensors="pt", do_center_crop=False)
            encoded = _features(_MODEL.get_image_features(**batch))
            features.append(encoded / encoded.norm(dim=-1, keepdim=True))
        scores = torch.cat(features) @ _TEXT_FEATURES.T
        index, confidence, crop_index = select_issue(scores)
    category = list(ISSUE_PROMPTS)[index] if index is not None else "None"
    detections = []
    if index is not None and crop_index is not None:
        x1, y1, x2, y2 = proposals[crop_index]
        detections.append({"category": category, "confidence": round(confidence, 3),
                           "bbox": [x1, y1, x2, y2],
                           "bbox_normalized": [x1 / width, y1 / height, x2 / width, y2 / height]})
    top = {"category": category, "confidence": round(confidence, 3) if index is not None else 0.0,
           "bbox": detections[0]["bbox"] if detections else [0, 0, 0, 0]}
    severity = {"Pothole": "high", "Garbage": "medium", "Water Leakage": "medium",
                "Fallen Tree": "medium", "Broken Streetlight": "low", "Electric Pole Damage": "critical",
                "Open Manhole": "high", "Flooded Road": "high", "Broken Traffic Sign": "medium"}.get(category, "low")
    return {**top, "severity": severity, "department": CATEGORY_TO_DEPT.get(category, "None"),
            "detections": detections, "image_width": width, "image_height": height,
            "localization_available": bool(detections), "localization_method": "clip_crop_similarity",
            "confidence_kind": "relative_match_score", "needs_review": True, "detector": CLIP_MODEL_ID}

DISTRICT_CENTERS = {
    "Adilabad": [19.6747, 78.5320],
    "Bhadradri Kothagudem": [17.5305, 80.6276],
    "Hanamkonda": [18.0146, 79.5694],
    "Hyderabad": [17.3850, 78.4867],
    "Jagtial": [18.7983, 78.9157],
    "Jangaon": [17.7214, 79.1623],
    "Jayashankar Bhupally": [18.4352, 79.8660],
    "Jogulamba Gadwal": [16.2730, 77.8016],
    "Kamareddy": [18.3182, 78.3352],
    "Karimnagar": [18.4386, 79.1288],
    "Khammam": [17.2473, 80.1514],
    "Kumuram Bheem Asifabad": [19.3637, 79.2929],
    "Mahabubabad": [17.5960, 80.0152],
    "Mahabubnagar": [16.7371, 77.9897],
    "Mancherial": [18.8753, 79.4315],
    "Medak": [18.0335, 78.2625],
    "Medchal-Malkajgiri": [17.5683, 78.5314],
    "Mulugu": [18.1887, 80.1770],
    "Nagarkurnool": [16.4859, 78.3346],
    "Nalgonda": [17.0575, 79.2684],
    "Narayanpet": [16.7441, 77.4984],
    "Nirmal": [19.0964, 78.3429],
    "Nizamabad": [18.6725, 78.0941],
    "Peddapalli": [18.6186, 79.3813],
    "Rajanna Sircilla": [18.3941, 78.8356],
    "Rangareddy": [17.1812, 78.4239],
    "Sangareddy": [17.6193, 78.0911],
    "Siddipet": [18.1018, 78.8520],
    "Suryapet": [17.1438, 79.6238],
    "Vikarabad": [17.3364, 77.9048],
    "Wanaparthy": [16.3622, 78.0625],
    "Warangal": [17.9689, 79.5941],
    "Yadadri Bhuvanagiri": [17.5103, 78.8872]
}

DISTRICT_WARDS = {
  "Adilabad": ["Mavala", "KRP Road", "Bhuktapur", "Adilabad Town", "Dasnapur"],
  "Bhadradri Kothagudem": ["Kothagudem Town", "Palwancha", "Yellandu", "Manuguru", "Bhadrachalam"],
  "Hanamkonda": ["Hanamkonda Chowrasta", "Subedari", "Kazipet", "Waddepally", "Gopalapuram"],
  "Hyderabad": ["Kukatpally", "Madhapur", "Jubilee Hills", "Banjara Hills", "Khairatabad", "Mehdipatnam"],
  "Jagtial": ["Jagtial Town", "Metpally", "Korutla", "Dharmapuri", "Raikal"],
  "Jangaon": ["Jangaon Town", "Station Ghanpur", "Palakurthy", "Bachannapet", "Zaffergadh"],
  "Jayashankar Bhupally": ["Bhupalpally Town", "Mulugu Road", "Chityal", "Kataram", "Mahadevpur"],
  "Jogulamba Gadwal": ["Gadwal Town", "Alampur", "Dharur", "Maldakal", "Kaloor"],
  "Kamareddy": ["Kamareddy Town", "Banswada", "Yellareddy", "Domakonda", "Machareddy"],
  "Karimnagar": ["Karimnagar Town", "Huzurabad", "Choppadandi", "Manakondur", "Kothapally"],
  "Khammam": ["Khammam Town", "Wyra", "Sathupally", "Madhira", "Kallur"],
  "Kumuram Bheem Asifabad": ["Asifabad Town", "Kagaznagar", "Sirpur", "Rebbena", "Wankidi"],
  "Mahabubabad": ["Mahabubabad Town", "Dornakal", "Maripeda", "Kesamudram", "Nellikudur"],
  "Mahabubnagar": ["Mahabubnagar Town", "Jadcherla", "Devarkadra", "Nawabpet", "Balanagar"],
  "Mancherial": ["Mancherial Town", "Bellampally", "Chennur", "Mandamarri", "Luxettipet"],
  "Medak": ["Medak Town", "Ramayampet", "Narsapur", "Chegunta", "Tupran"],
  "Medchal-Malkajgiri": ["Alwal", "Malkajgiri", "Kompally", "Medchal Town", "Quthbullapur"],
  "Mulugu": ["Mulugu Town", "Eturnagaram", "Venkatapur", "Mangapet", "Tadvai"],
  "Nagarkurnool": ["Nagarkurnool Town", "Achampet", "Kollapur", "Kalwakurthy", "Bijinapally"],
  "Nalgonda": ["Nalgonda Town", "Miryalaguda", "Devarakonda", "Nagarjuna Sagar", "Nakrekal"],
  "Narayanpet": ["Narayanpet Town", "Kosgi", "Damaragidda", "Makthal", "Utkoor"],
  "Nirmal": ["Nirmal Town", "Bhainsa", "Khanapur", "Lokeshwaram", "Mudhole"],
  "Nizamabad": ["Nizamabad Town", "Armoor", "Bodhan", "Bheemgal", "Dichpally"],
  "Peddapalli": ["Peddapalli Town", "Ramagundam", "Godavarikhani", "Manthani", "Sultanabad"],
  "Rajanna Sircilla": ["Sircilla Town", "Vemulawada", "Mustabad", "Yellareddypet", "Chandurthi"],
  "Rangareddy": ["Gachibowli", "Sherilingampally", "Rajendranagar", "Narsingi", "Manikonda"],
  "Sangareddy": ["Patancheru", "Sangareddy Town", "Ameenpur", "Beeramguda", "RC Puram"],
  "Siddipet": ["Siddipet Town", "Gajwel", "Dubbak", "Husnabad", "Cherial"],
  "Suryapet": ["Suryapet Town", "Kodad", "Huzurnagar", "Thungathurthy", "Chivvemla"],
  "Vikarabad": ["Vikarabad Town", "Tandur", "Pargi", "Kodangal", "Dharur"],
  "Wanaparthy": ["Wanaparthy Town", "Pebbair", "Kothakota", "Revally", "Gopalpet"],
  "Warangal": ["Warangal Fort", "Narsampet", "Wardhannapet", "Geesugonda", "Rayaparthy"],
  "Yadadri Bhuvanagiri": ["Bhuvanagiri Town", "Alair", "Bhongir", "Choutuppal", "Ramannapet"]
}

def snapToTelanganaBounds(lat: float, lon: float) -> tuple[float, float]:
    inBounds = lat >= 15.8 and lat <= 19.9 and lon >= 77.1 and lon <= 81.3
    if inBounds:
        return lat, lon
    
    # Snap to the closest district center coordinate
    nearest = "Hyderabad"
    minD = float('inf')
    for dist, c in DISTRICT_CENTERS.items():
        d = (lat - c[0])**2 + (lon - c[1])**2
        if d < minD:
            minD = d
            nearest = dist
            
    return DISTRICT_CENTERS[nearest][0], DISTRICT_CENTERS[nearest][1]

def localGeofenceLookup(lat: float, lon: float) -> dict:
    """
    Looks up the district and ward for a given coordinate.
    """
    lat, lon = snapToTelanganaBounds(lat, lon)
    nearest = "Hyderabad"
    minD = float('inf')
    for dist, c in DISTRICT_CENTERS.items():
        d = (lat - c[0])**2 + (lon - c[1])**2
        if d < minD:
            minD = d
            nearest = dist
            
    wards = DISTRICT_WARDS.get(nearest, ["Kukatpally"])
    idx = abs(int((lat + lon) * 1000)) % len(wards)
    return {"district": nearest, "ward": wards[idx]}
