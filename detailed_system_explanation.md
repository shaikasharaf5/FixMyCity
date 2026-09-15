# CiviTrack AI: Detailed System Explanation & Workflow

This document provides a detailed breakdown of each technology used in **CiviTrack AI**, explaining what it is, its purpose, how it is integrated into the project, and tracing the complete end-to-end workflow of the platform.

---

## Part 1: Technology Stack Deep Dive

### 1. FastAPI
* **What is it?**  
  A modern, fast (high-performance), web framework for building APIs with Python 3.8+ based on standard Python type hints.
* **What is its use?**  
  It allows developers to build robust REST and WebSocket backend services asynchronously, offering automatic validation of incoming requests and interactive Swagger documentation out of the box.
* **How is it used in CiviTrack AI?**  
  It acts as the core backend API server engine. It defines all routing endpoints (auth, complaints, chatbot, notifications, analytics), handles asynchronous image file uploads, compiles response schemas, and mounts directories to serve static verification images.

### 2. Uvicorn
* **What is it?**  
  An lightning-fast ASGI (Asynchronous Server Gateway Interface) web server implementation for Python.
* **What is its use?**  
  It runs asynchronous web applications (like FastAPI) in a loop, handling incoming TCP/HTTP connection threads and routing them to the FastAPI router.
* **How is it used in CiviTrack AI?**  
  It is the execution host server. When `run.py` is executed, it invokes Uvicorn to listen on port `8000`, spawning and keeping the FastAPI app active.

### 3. MySQL & SQLAlchemy ORM
* **What is it?**  
  *MySQL* is a high-performance relational database management system.  
  *SQLAlchemy* is a Python Object-Relational Mapper (ORM) that maps Python classes to database tables.
* **What is its use?**  
  They manage data storage and retrieval. Instead of writing raw SQL strings, developers write Python code to create, read, update, and delete records, which SQLAlchemy compiles into SQL.
* **How is it used in CiviTrack AI?**  
  * MySQL stores all tables: `User`, `Department`, `Officer`, `Complaint`, `Notification`, and `AuditLog`.
  * SQLAlchemy connects models in `models.py` (e.g. tracking duplicate complaints recursively with a self-referencing relationship, mapping officers to departments, and linking complaints to resolving officers).

### 4. React 18, Vite, & TypeScript
* **What is it?**  
  *React 18* is a component-based frontend library for rendering user interfaces.  
  *Vite* is a frontend build tool that serves code quickly during development and bundles it for production.  
  *TypeScript* is a typed superset of JavaScript.
* **What is its use?**  
  They form the client application development environment, helping developers build bug-free, reactive user dashboards that render UI changes in real time.
* **How is it used in CiviTrack AI?**  
  The frontend codebase compiles into a Single Page Application (SPA). React manages tabs and states, TypeScript guarantees correct JSON interfaces between API and UI, and Vite compiles the static bundle.

### 5. Tailwind CSS
* **What is it?**  
  A utility-first CSS framework.
* **What is its use?**  
  It allows styling elements directly in HTML/React code using short helper classes (e.g., `flex`, `grid`, `border-indigo-900`, `hover:bg-indigo-800`), eliminating the need to write separate stylesheets.
* **How is it used in CiviTrack AI?**  
  It styles the visual design of the portal, including the dark-theme layouts, glowing borders, custom grids, animations, and transitions.

### 6. Leaflet & React-Leaflet
* **What is it?**  
  Open-source interactive map rendering libraries.
* **What is its use?**  
  They display maps, load tiles from OpenStreetMap, and map GPS markers (latitude and longitude coordinates) onto a visual map canvas.
* **How is it used in CiviTrack AI?**  
  Used to render map views in the Citizen Portal and Gov Dashboard. They load coordinate coordinates of complaints, placing colored icons (rose for critical, amber for high, yellow for medium) to denote severity.

### 7. PyTorch & Ultralytics YOLOv8 (Trained Models)
* **What is it?**  
  *PyTorch* is an open-source machine learning library.  
  *YOLOv8 (You Only Look Once)* is a state-of-the-art real-time object detection architecture.
* **What is its use?**  
  They perform target classification and segment civic issues from images by localizing features within bounding boxes.
* **How is it used in CiviTrack AI?**  
  The `detector.py` module loads three distinct YOLOv8 models. When an image is uploaded, it is preprocessed using OpenCV (Gaussian blur and contrast equalization) and run through the models to detect environmental hazards, water leaks, or utility issues. Detections are filtered by confidence to determine the primary category.

### 8. OpenAI & Gemini SDKs
* **What is it?**  
  Developer toolkits used to call Large Language Model (LLM) APIs.
* **What is its use?**  
  They generate natural language text and handle conversational inquiries.
* **How is it used in CiviTrack AI?**  
  * In the AI engine, they generate professional, structured dispatcher notes based on the ticket metadata.
  * In the ChatBot router, they parse natural language query context and return conversational markdown tables/lists of complaints.

### 9. WebSockets
* **What is it?**  
  A protocol providing full-duplex, real-time communication channels over a single TCP connection.
* **What is its use?**  
  Allows the server to push updates directly to clients instantly, without the client needing to poll or refresh.
* **How is it used in CiviTrack AI?**  
  `ws.py` manages a global socket registry. When an officer resolves an issue, the backend immediately pushes an update event to all active citizen and admin map views, updating statuses instantly.

### 10. JWT & Bcrypt (Authentication)
* **What is it?**  
  *JWT (JSON Web Tokens)* are secure keys containing user information.  
  *Bcrypt* is a password hashing algorithm.
* **What is its use?**  
  They secure the application, verifying user identity and ensuring that only authorized users can access specific dashboard views.
* **How is it used in CiviTrack AI?**  
  Users login with their password, which is verified against the hashed password stored in the database using Bcrypt. The backend issues a JWT token. The React frontend stores this token and includes it in the header of API requests to authorize access to citizen, officer, or admin routes.

---

## Part 2: End-to-End Workflow Explanation

Here is the exact lifecycle of an issue from reporting to resolution:

[Citizen Portal / WhatsApp]
         | (1. Photo Upload + Coordinates)
         v
[FastAPI: /api/complaints/analyze]
         | (2. Running OpenCV and YOLOv8 Models)
         v
   [YOLOv8 Models] ---> Resolves Category (e.g., Pothole) & Department (Roads)
         |
         v
[Haversine Duplicate Check]
         |
         +---> (3a. Found Duplicates within 50m) ---> Set status to "duplicate"
         |                                            Link to Parent ticket
         |                                            Increment parent upvotes
         |
         +---> (3b. Unique Ticket) ---> Generate LLM Dispatch Note
                                        Save as "pending" in MySQL
                                        Broadcast via WebSockets
                                             |
                                             v
                                 [Officer Console Queue]
                                             | (4. Officer accepts task)
                                             v
                                        [In Progress]
                                             | (5. Repairs finished)
                                             | (6. Upload "after" photo)
                                             v
                                   [FastAPI: /resolve]
                                             |
                                             v
                                        [Resolved]
                                             | (7. Broadcast socket event)
                                             v
                                [Citizen / Admin Dashboards]
                                (Renders before/after slider view)
```

### Stage A: Issue Reporting
1. **Reporting via Citizen Portal**:
   - A resident navigates to the portal, clicks "Report an Issue", and selects a photograph.
   - The browser prompts for location access, retrieving the latitude and longitude coordinate variables.
   - The user selects the file, and React sends a multipart/form-data request to the backend.
2. **Reporting via WhatsApp Bot**:
   - The resident sends a message containing an image to the simulated WhatsApp Bot.
   - The mock phone simulator posts this message to the backend webhook.
   - The chatbot's NLP parsing engine extracts the intent and targets, assigning a random mock location.

### Stage B: Backend AI and Deduplication Processing
3. **Dual-Pass Classification**:
   - The API receives the image and runs the classifier.
   - If the filename contains a keyword (e.g. `pothole.jpg`), it is classified as `"Pothole"` with 98% confidence.
   - Otherwise, the image is preprocessed (resized, noise reduced, CLAHE enhanced) via OpenCV, and passed through the three custom YOLOv8 models. Bounding boxes are generated, detections below 0.45 confidence are filtered out, and the category is resolved based on the highest-scoring detection.
4. **Geospatial Deduplication**:
   - The system queries all active, non-resolved complaints of the same category in the MySQL database.
   - It calculates the great-circle distance between coordinates using the **Haversine formula**.
   - If another ticket of the same category exists within **50 meters**:
     - The new ticket's status is set to `"duplicate"`.
     - Its parent reference is updated to point to the existing ticket.
     - The parent ticket's upvote count is incremented.
     - The new reporter is registered to receive notifications.
5. **LLM Note Generation**:
   - If unique, the system passes the metadata to the generator, which outputs a structured dispatch note.
   - The complaint is written to the MySQL database with a status of `"pending"`.
6. **Real-time Broadcast**:
   - A WebSocket event notifies all active client dashboards of the new ticket.

### Stage C: Officer Action
7. **Task Assignment**:
   - The ticket is assigned to a field officer based on the department and district.
   - The ticket status is updated to `"assigned"`.
8. **Repair Execution**:
   - The officer views the ticket in their queue, reviews the map pin, reads the LLM-generated note, and heads to the site.
   - The officer updates the ticket status to `"in_progress"`.
   - Once repairs are complete, the officer uploads a verification photo of the resolved site and submits the update.

### Stage D: Resolution Verification
9. **Status Update**:
   - The backend transitions the status to `"resolved"`, logs the "after" photo URL, and commits the transaction.
10. **WebSocket Sync**:
    - The server broadcasts a `"complaint_resolved"` payload over WebSockets.
11. **Citizen Verification**:
    - The citizen's portal map pin turns green.
    - Clicking the pin displays the ticket details, rendering the **Before/After Image Slider** to visually verify the resolved state.
