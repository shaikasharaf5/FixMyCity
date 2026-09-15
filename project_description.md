# CiviTrack AI: Complete Project Technical Description

This document serves as a comprehensive technical guide and reference for **CiviTrack AI – Smart Civic Infrastructure Management Platform**. It describes the design patterns, code implementation, AI pipelines, database models, and user workflows.

---

## 1. Project Overview & Motivation
**CiviTrack AI** is an AI-powered smart civic infrastructure management platform. The system bridges the gap between citizens (who report civic defects like potholes, trash, and broken lights) and local government authorities (who inspect, assign, and repair them).

### Key Innovation Objectives
- **Zero-Touch Dispatching**: Automating the classification of defects and routing them to correct departments immediately using specialized object-detection models.
- **Trained Deep Learning Baselines**: Employs three custom-trained YOLOv8/PyTorch models trained on distinct datasets to accurately segment and locate multiple civic infrastructure problems.
- **Auditability**: Visual verification of work using before/after photo evidence and interactive sliders.
- **Geospatial Deduplication**: Preventing municipal resource waste by detecting and merging multiple reports of the same physical defect within a $50\text{-meter}$ radius using the Haversine formula.
- **Multi-channel Accessibility**: Providing integration with the WhatsApp Cloud API to support conversational reporting.

---

## 2. Technical Stack
- **Backend API**: Python 3.10+, FastAPI (asynchronous ASGI framework), Uvicorn.
- **Database Layer**: MySQL relational database managed via SQLAlchemy ORM.
- **Deep Learning / AI Core**: PyTorch, Ultralytics YOLOv8, OpenCV (image preprocessing).
- **Real-Time Streaming**: HTML5 WebSockets (bidirectional server pushes).
- **Frontend SPA**: React 19, TypeScript, Vite.
- **Maps Rendering**: Leaflet, React-Leaflet, OpenStreetMap API.
- **Messaging Integration**: WhatsApp Cloud API.

---

## 3. Custom-Trained AI Image Analysis Module

Instead of generic zero-shot architectures, CiviTrack AI implements specialized, high-accuracy object-detection models built on **YOLOv8** and **PyTorch**, trained on three custom-curated datasets:

1. **`Environmental_Hazards_clean` Model**:
   - **Target Categories**: Potholes, Garbage accumulation, Fallen trees, Damaged roads, and Flooded roads (waterlogging).
   - **Characteristics**: Focuses on large-scale urban blockages and pavement hazards.
2. **`Water_Leak_clean` Model**:
   - **Target Categories**: Water leakage (broken pipes), Sewer overflows/sewage, and Open manholes.
   - **Characteristics**: Trained on water/sewage defects and underground access hazards.
3. **`Civic-issues.v1i.yolo26` Model**:
   - **Target Categories**: Broken streetlights, Damaged electric poles, and Broken traffic signs.
   - **Characteristics**: Focused on utility assets, structural signs, and lighting fixtures.

### AI Processing Workflow:
- **Preprocessing (OpenCV)**: Resizing incoming uploads, applying noise reduction (Gaussian blur), and enhancing contrast (CLAHE) to improve detection accuracy under variable lighting.
- **Inference Pipeline**: Images are passed in parallel or sequentially through the three custom-trained YOLOv8 models. Bounding boxes are predicted with associated class labels and confidence scores.
- **Confidence Filter**: Detections with a confidence score below **0.45** are ignored to prevent false alarms. The highest scoring detection determines the primary ticket category.

---

## 4. Core Backend Router Architectures

### A. Complaints Router (`complaints.py`)
This is the core functional driver that manages:
- **Image Upload Analysis (`/api/complaints/analyze`)**: Receives form data containing image files and GPS coordinates (latitude, longitude). It saves files, runs the OpenCV preprocessing and the three YOLOv8 models, maps the detected defect to a department, triggers the duplicate check, and generates descriptive notes.
- **Issue Submission (`/api/complaints/create`)**: Writes the complaint record to the MySQL database. If flagged as a duplicate, it creates a self-referencing link (`duplicate_of_id`) to the parent complaint.
- **Officer Management**: Routes endpoints for task assignments, status transitions (e.g., `assigned` $\rightarrow$ `in_progress` $\rightarrow$ `resolved`), and resolution submissions (capturing "after" photo URLs).
- **Engagement (Upvotes & Comments)**: Endpoints to upvote parent issues or write comments.

### B. Chatbot Router (`chatbot.py`)
Allows natural language querying of the complaints database:
- **NLP Parsing Engine**: A regex pattern parser that scans queries to extract intent (Greeting, Single Ticket, Counts, List Queries) and filters (Category, Status, District, Ward, Severity).
- **LLM Context Injection**: Builds a structured context string from the database results and prompts an LLM to write a conversational response.

### C. Real-Time Streaming (`ws.py`)
Implements bidirectional WebSockets:
- Keeps a memory registry of active WebSocket connections.
- Broadcasts JSON events (e.g., `"TICKET_RESOLVED"`, `"TICKET_ASSIGNED"`) dynamically, forcing active UI dashboards to refresh data in real time.

### D. Analytics Router (`analytics.py`)
Handles complex SQL aggregations to feed the admin charts:
- Resolves overall metrics: resolution rate, open tickets, critical issue alerts.
- Computes **SLA (Service Level Agreement)** adherence rates.
- Breaks down loads across departments.

---

## 5. Database Models & Schema (`models.py` via MySQL)
The database contains six interconnected tables:

1. **`User`**: User credentials, phone numbers, and roles (`citizen`, `officer`, `district_admin`, `state_admin`).
2. **`Department`**: Contains department codes (`RND` for Roads & Buildings, `WSS` for Water Supply & Sewerage, `WM` for Waste Management, `EB` for Electricity Board).
3. **`Officer`**: Maps field inspectors to specific departments and municipal jurisdictions.
4. **`Complaint`**: Holds coordinate points, categories, statuses, upvotes, before/after image URLs, and self-referencing `duplicate_of_id` links.
5. **`Notification`**: Broadcasts alerts to citizen and officer feeds.
6. **`AuditLog`**: Records admin/officer actions for auditability.

---

## 6. Frontend Component Structure
- **`CitizenPortal.tsx`**: Citizens upload pictures, triggering HTML5 geolocation lookups. Renders marker pins on a Leaflet map.
- **`GovDashboard.tsx`**: Real-time work list filtered by department. Renders the before/after slider comparison view once resolution tasks are finished.
- **`AdminDashboard.tsx`**: High-level charts (resolution rates, load distributions, SLA analytics) and regional spatial heatmaps.
- **`WhatsAppSimulator.tsx`**: A mock phone device rendering chat histories. Simulates WhatsApp Cloud API webhook integration, showing automated chatbot replies.
- **`ChatBot.tsx`**: Floating dialogue widget supporting NLP queries.
- **`CommunityBoard.tsx`**: Social feedback area for local upvoting and discussion.
