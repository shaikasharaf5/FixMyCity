# CiviTrack

A civic-service reporting application connecting citizens, a central control
room, and field officers. Built with React, TypeScript, Vite, Tailwind CSS,
FastAPI, SQLAlchemy/SQLite, CLIP, Leaflet/OpenStreetMap, and Twilio WhatsApp.

## Workflow

Citizens submit a photo and location. The central room assigns an inspection.
The assigned officer submits photographic evidence and marks the report real or
fake. Real reports require central approval before the same officer performs the
work and submits completion evidence. Fake reports are declined.

## Local setup

Use Python 3.11+ and a current Node.js version supported by Vite 8.

Backend (PowerShell, from the project root):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\venv\Scripts\python.exe run.py
```

Frontend (a separate terminal, from the project root):

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. API documentation is at http://localhost:8001/docs.
The backend creates its local database and demonstration accounts on startup.
CLIP weights download on the first scan if not already cached; initial analysis
can take longer. No trained YOLO weights are required by the active CLIP path.

Configure your own Twilio credentials in `backend/.env` before using WhatsApp.
See [Twilio setup](backend/TWILIO_SETUP.md) and
[CLIP behaviour and limitations](backend/CLIP_DETECTION.md).

## Checks

```powershell
cd backend
.\venv\Scripts\python.exe -m unittest test_clip_detection test_workspace_flows -v
cd ../frontend
npm run build
```

## Data and deployment

Credentials, databases, uploaded complaint photos, backups, dependency folders,
and downloaded model weights are deliberately excluded from version control.
A clone does not include existing local complaints or evidence.

This is a development/demo application, not a hardened government production
deployment. Demo accounts, JWT signing configuration, access controls, CORS,
public upload access, and integration endpoints need a security review before
deployment with real citizen data. CLIP suggestions and approximate highlighted
regions require human verification; model match scores are not accuracy claims.
