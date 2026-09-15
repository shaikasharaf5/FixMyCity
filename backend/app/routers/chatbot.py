from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
import re
import os
import openai
from dotenv import load_dotenv

from pydantic import BaseModel
from typing import List, Optional
from ..database import get_db
from .. import crud, models, schemas

# Load environment variables
load_dotenv()

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])

class ChatbotQuery(BaseModel):
    query: str

class ChatbotResponse(BaseModel):
    response: str
    complaints: List[schemas.ComplaintOut] = []

# List of database categories and districts for NLP parsing
KNOWN_CATEGORIES = {
    "pothole": "Pothole",
    "garbage": "Garbage",
    "trash": "Garbage",
    "waste": "Garbage",
    "water leak": "Water Leakage",
    "leakage": "Water Leakage",
    "manhole": "Open Manhole",
    "tree": "Fallen Tree",
    "pole": "Electric Pole Damage",
    "electricity": "Electric Pole Damage",
    "flood": "Flooded Road",
    "waterlogging": "Flooded Road",
    "sign": "Broken Traffic Sign",
    "light": "Broken Streetlight",
    "streetlight": "Broken Streetlight"
}

KNOWN_DISTRICTS = [
    "Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial", 
    "Jangaon", "Jayashankar Bhupally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", 
    "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial", 
    "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", 
    "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", 
    "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", 
    "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"
]

def parse_query(query: str):
    """
    Advanced NLP parser extracting filters and intent from query string.
    """
    q = query.lower().strip()
    filters = {}
    intent = "query_complaints"

    # 1. Greetings
    greetings = ["hi", "hello", "hey", "greetings", "good morning", "good afternoon"]
    if any(q.startswith(g) or q == g for g in greetings):
        return {"intent": "greeting", "filters": {}}

    # 2. Help
    help_words = ["help", "what can you do", "how to use", "commands", "features"]
    if any(hw in q for hw in help_words):
        return {"intent": "help", "filters": {}}

    # 2.5. Missing Item / Lost & Found
    missing_words = ["missing", "lost", "found", "stolen", "item", "wallet", "phone", "bag", "key", "pet"]
    if any(mw in q for mw in missing_words):
        return {"intent": "missing_item", "filters": {}}

    # 3. Count Intent
    count_patterns = [r"how many", r"count of", r"number of", r"total"]
    if any(re.search(pat, q) for pat in count_patterns):
        intent = "count_complaints"

    # 4. ID Extraction (skips numbers preceded by ward/sector/zone)
    id_val = None
    m_id = re.search(r"\b(?:complaint|complaiant|id|ticket|issue|#|show|view|get|detail|details|info)\s*#?\s*(\d+)\b", q)
    if not m_id:
        m_id = re.search(r"\b(\d+)(?:st|nd|rd|th)\b", q)
    if not m_id:
        m_id = re.search(r"^\s*#?\s*(\d+)\s*$", q)
        
    if m_id:
        id_val = int(m_id.group(1))
        filters["id"] = id_val
        intent = "show_single"
        return {"intent": intent, "filters": filters}

    # 5. Extract Category
    for key, val in KNOWN_CATEGORIES.items():
        if key in q:
            filters["category"] = val
            break

    # 6. Extract Status
    status_map = {
        "pending": "pending",
        "under_review": "under_review",
        "review": "under_review",
        "assigned": "assigned",
        "in_progress": "in_progress",
        "progress": "in_progress",
        "resolved": "resolved",
        "solved": "resolved",
        "fixed": "resolved",
        "duplicate": "duplicate"
    }
    for key, val in status_map.items():
        if key in q:
            filters["status"] = val
            break

    # 7. Extract District
    for dist in KNOWN_DISTRICTS:
        if dist.lower() in q:
            filters["district"] = dist
            break

    # 8. Extract Ward
    ward_match = re.search(r"\bward\s*([a-zA-Z0-9_]+)\b", q)
    if ward_match:
        val = ward_match.group(1)
        filters["ward"] = f"Ward {val.upper()}" if val.isdigit() else val.title()

    # 9. Extract Severity
    severity_keywords = ["low", "medium", "high", "critical", "urgent"]
    for sev in severity_keywords:
        if sev in q:
            filters["severity"] = "critical" if sev == "urgent" else sev
            break

    # 10. Date/Time Range
    today = date.today()
    if "today" in q:
        filters["date_from"] = datetime.combine(today, datetime.min.time())
        filters["date_to"] = datetime.combine(today, datetime.max.time())
    elif "yesterday" in q:
        y = today - timedelta(days=1)
        filters["date_from"] = datetime.combine(y, datetime.min.time())
        filters["date_to"] = datetime.combine(y, datetime.max.time())
    elif "last week" in q:
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
        filters["date_from"] = datetime.combine(start, datetime.min.time())
        filters["date_to"] = datetime.combine(end, datetime.max.time())
    else:
        m = re.search(r"(\d{4}-\d{2}-\d{2})", q)
        if m:
            d = datetime.strptime(m.group(1), "%Y-%m-%d").date()
            filters["date_from"] = datetime.combine(d, datetime.min.time())
            filters["date_to"] = datetime.combine(d, datetime.max.time())

    return {"intent": intent, "filters": filters}

def get_llm_response(query: str, complaints_context: list, intent: str) -> Optional[str]:
    """
    Tries to invoke Gemini (or OpenAI) API for native ChatGPT-style replies.
    Returns None if no API keys are configured.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
    model = "gemini-1.5-flash"
    
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = None
        model = "gpt-4o-mini"
        
    if not api_key:
        return None
        
    try:
        # Build live database context representation
        context_str = ""
        if complaints_context:
            context_str = "Live Complaints from database matching query:\n"
            for c in complaints_context:
                context_str += f"- ID: #{c.id}, Category: {c.category}, Status: {c.status}, District: {c.district}, Ward: {c.ward}, Severity: {c.severity}, Upvotes: {c.upvotes}, Description: {c.description}\n"
        else:
            context_str = "No matching complaints found in the database.\n"
            
        system_instruction = (
            "You are CivicSense AI, a smart conversational municipal chatbot for Telangana.\n"
            "You help users search and analyze civic complaints in real-time.\n"
            "Answer the user query conversationally using ONLY the database context provided above.\n"
            "Guidelines:\n"
            "1. Be extremely polite, direct, and conversational—exactly like ChatGPT.\n"
            "2. Format your response beautifully using markdown (bold text, lists, and tables).\n"
            "3. If the user greets you or asks for general help, respond conversationally.\n"
            "4. NEVER invent complaints not present in the context. If the context has no complaints, politely explain that none were found."
        )
        
        if base_url:
            client = openai.OpenAI(api_key=api_key, base_url=base_url)
        else:
            client = openai.OpenAI(api_key=api_key)
            
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"Database Context:\n{context_str}\n\nUser Query: {query}"}
            ],
            temperature=0.3,
            max_tokens=800
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"ChatGPT/Gemini API call failed: {e}")
        return None

def generate_local_response(query: str, results: list, intent: str, filters: dict) -> str:
    """
    High-fidelity local fallback response generator when no API keys are present.
    """
    if intent == "greeting":
        return (
            "Hello! I am CivicSense AI, your smart municipal assistant. 🤖\n\n"
            "How can I help you today? You can query active complaints across Telangana using natural language. "
            "For example, try asking:\n"
            "- *\"Show all water leakage issues in Hyderabad\"*\n"
            "- *\"What is the status of complaint #57?\"*\n"
            "- *\"How many issues are resolved?\"*\n"
            "- *\"Show complaints reported today\"*"
        )
        
    if intent == "help":
        return (
            "### How to use CivicSense AI Chat 💡\n\n"
            "I can search, count, and analyze municipal complaints in real-time. Here are the query formats I support:\n\n"
            "1. **Filter by District**: *\"hyderabad complaints\"* or *\"issues in rangareddy\"*\n"
            "2. **Filter by Category**: *\"fallen tree issues\"* or *\"potholes\"*\n"
            "3. **Filter by Severity**: *\"critical complaints in warangal\"*\n"
            "4. **Filter by Status**: *\"resolved issues\"* or *\"pending complaints\"*\n"
            "5. **Filter by Date**: *\"reported today\"* or *\"yesterday's issues\"*\n"
            "6. **Count Complaints**: *\"how many complaints are resolved?\"*\n"
            "7. **Specific Complaint ID**: *\"show complaint #60\"*\n\n"
            "Simply type your question below!"
        )

    if intent == "missing_item":
        return (
            "🔍 **Missing Item & Lost/Found Assistance** 📢\n\n"
            "To report or search for a missing item, you have two instant options:\n\n"
            "1. **Neighborhood Community Board (Web UI)**:\n"
            "   Go to the **Community Board** tab, click **\"Create Alert / Post\"**, select **Missing Person Alert** or **Lost & Found Item**, and fill in the details. Your post will be published and a WhatsApp alert will be broadcasted to local members immediately!\n\n"
            "2. **WhatsApp Bot**:\n"
            "   Send a text message directly to our WhatsApp bot starting with *\"Missing...\"* or *\"Lost...\"* (e.g., *\"Missing black wallet near Ward 5\"*). The bot will automatically publish it and dispatch WhatsApp alerts to citizens."
        )

    if intent == "show_single":
        if not results:
            return f"I searched the database but could not find any complaint with ID **#{filters.get('id')}**. Please verify the ID and try again."
        c = results[0]
        severity_emoji = "🔴" if c.severity == "critical" else "orange_circle" if c.severity == "high" else "🟡" if c.severity == "medium" else "🔵"
        status_emoji = "✅" if c.status == "resolved" else "⏳" if c.status == "in_progress" else "📋"
        
        return (
            f"Here are the details for Complaint **#{c.id}**:\n\n"
            f"📄 **Category**: {c.category}\n"
            f"{status_emoji} **Status**: `{c.status.upper().replace('_', ' ')}`\n"
            f"📍 **Location**: {c.district} (Ward: {c.ward})\n"
            f"🔴 **Severity**: {c.severity.upper()}\n"
            f"👍 **Upvotes/Likes**: {c.upvotes}\n"
            f"📅 **Reported**: {c.created_at.strftime('%B %d, %Y')}\n\n"
            f"💬 **Description**: {c.description}\n\n"
            "Is there anything else you'd like to check about this ticket?"
        )

    if intent == "count_complaints":
        count = len(results)
        filter_desc = []
        if "category" in filters: filter_desc.append(f"**{filters['category']}**")
        if "status" in filters: filter_desc.append(f"**{filters['status']}** status")
        if "district" in filters: filter_desc.append(f"in **{filters['district']}**")
        if "ward" in filters: filter_desc.append(f"in **{filters['ward']}**")
        if "severity" in filters: filter_desc.append(f"**{filters['severity']}** severity")
        if "date_from" in filters: filter_desc.append("reported today")
        
        filter_str = ", ".join(filter_desc)
        filter_suffix = f" matching {filter_str}" if filter_str else ""
        
        resolved_count = sum(1 for c in results if c.status == "resolved")
        pending_count = count - resolved_count
        
        return (
            f"I analyzed the municipal database and found a total of **{count}** complaints{filter_suffix}.\n\n"
            f"- ⏳ **Pending/Active**: {pending_count}\n"
            f"- ✅ **Resolved**: {resolved_count}\n\n"
            "If you want to view a list of these complaints, you can ask me to list them!"
        )

    # General list matching
    if not results:
        return (
            "I checked the database but found no complaints matching your criteria. "
            "Make sure the spelling of the category or district is correct, or try a broader search!"
        )
        
    count = len(results)
    response = f"I found **{count}** matching complaints in the database:\n\n"
    
    # Render beautiful markdown table
    response += "| ID | Category | Status | District | Ward | Severity |\n"
    response += "|---|---|---|---|---|---|\n"
    for c in results[:15]:
        response += f"| #{c.id} | {c.category} | `{c.status}` | {c.district} | {c.ward} | {c.severity.upper()} |\n"
        
    if count > 15:
        response += f"\n*(Showing top 15 of {count} total matching complaints. You can narrow down your query by adding filters.)*\n"
        
    response += "\nTo view detailed info for any complaint, just type something like *\"show complaint #ID\"*."
    return response

@router.post("/query", response_model=ChatbotResponse)
def query_complaints(payload: ChatbotQuery, db: Session = Depends(get_db)):
    """
    Accepts a natural-language query and processes it using the advanced NLP logic.
    Returns a conversational text response along with any queried complaints.
    """
    parse_result = parse_query(payload.query)
    intent = parse_result["intent"]
    filters = parse_result["filters"]

    results = []
    
    # Perform database query if intent requires fetching complaints
    if intent in ["query_complaints", "count_complaints", "show_single"]:
        if "id" in filters:
            complaint = crud.get_complaint(db, filters["id"])
            if complaint:
                results = [complaint]
        else:
            query = db.query(models.Complaint)
            if "status" in filters:
                query = query.filter(models.Complaint.status == filters["status"])
            if "category" in filters:
                query = query.filter(models.Complaint.category == filters["category"])
            if "district" in filters:
                query = query.filter(models.Complaint.district.ilike(filters["district"]))
            if "ward" in filters:
                query = query.filter(models.Complaint.ward == filters["ward"])
            if "severity" in filters:
                query = query.filter(models.Complaint.severity == filters["severity"])
            if "date_from" in filters and "date_to" in filters:
                query = query.filter(models.Complaint.created_at >= filters["date_from"],
                                     models.Complaint.created_at <= filters["date_to"])
            results = query.order_by(models.Complaint.created_at.desc()).all()

    # Get response: try LLM first, fallback to rule-based engine
    chatbot_text = get_llm_response(payload.query, results, intent)
    if not chatbot_text:
        chatbot_text = generate_local_response(payload.query, results, intent, filters)

    return ChatbotResponse(response=chatbot_text, complaints=results)
