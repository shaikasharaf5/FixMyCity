from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List, Set
import json
import logging

logger = logging.getLogger("civicsense.ws")

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of WebSockets (allowing multiple tabs per user)
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Maps role -> Set of user_ids for targeted notifications
        self.role_map: Dict[str, Set[int]] = {
            "citizen": set(),
            "officer": set(),
            "district_admin": set(),
            "state_admin": set()
        }
        # Maps user_id -> User details (district, department_id) for officer-specific routing
        self.user_metadata: Dict[int, Dict] = {}

    async def connect(self, websocket: WebSocket, user_id: int, role: str, metadata: dict = None):
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        
        if role in self.role_map:
            self.role_map[role].add(user_id)
            
        if metadata:
            self.user_metadata[user_id] = metadata
            
        logger.info(f"User {user_id} ({role}) connected via WebSocket. Active sessions: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Clean up role map
                for role in self.role_map:
                    self.role_map[role].discard(user_id)
                # Clean up metadata
                if user_id in self.user_metadata:
                    del self.user_metadata[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket.")

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            closed_sockets = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Error sending WebSocket message to user {user_id}: {e}")
                    closed_sockets.append(connection)
            
            # Clean up dead sockets
            for socket in closed_sockets:
                self.disconnect(user_id, socket)

    async def broadcast(self, message: dict):
        for user_id in list(self.active_connections.keys()):
            await self.send_to_user(user_id, message)

    async def notify_officers_new_complaint(self, complaint_data: dict, district: str, department_id: int):
        """
        Sends a real-time notification to officers working in the complaint's district and department,
        and also alerts district_admin and state_admin.
        """
        message = {
            "type": "NEW_COMPLAINT",
            "data": complaint_data
        }
        
        # 1. Alert relevant officers
        officer_ids = self.role_map.get("officer", set())
        for u_id in officer_ids:
            meta = self.user_metadata.get(u_id, {})
            # Check if officer matches the district and department of the complaint
            meta_district = meta.get("district", "").lower()
            meta_dept_id = meta.get("department_id")
            
            if meta_district == district.lower() and meta_dept_id == department_id:
                await self.send_to_user(u_id, message)

        # 2. Alert district administrators of the same district
        admin_ids = self.role_map.get("district_admin", set())
        for u_id in admin_ids:
            meta = self.user_metadata.get(u_id, {})
            meta_district = meta.get("district", "").lower()
            if meta_district == district.lower():
                await self.send_to_user(u_id, message)

        # 3. Alert all state administrators
        state_admin_ids = self.role_map.get("state_admin", set())
        for u_id in state_admin_ids:
            await self.send_to_user(u_id, message)

    async def notify_citizen_status_update(self, citizen_id: int, complaint_data: dict):
        """
        Notify the citizen when their complaint is updated.
        """
        message = {
            "type": "COMPLAINT_STATUS_UPDATE",
            "data": complaint_data
        }
        await self.send_to_user(citizen_id, message)

manager = ConnectionManager()

@router.websocket("/ws/{user_id}/{role}")
async def websocket_endpoint(
    websocket: WebSocket, 
    user_id: int, 
    role: str, 
    district: str = "all", 
    department_id: int = None
):
    metadata = {
        "district": district,
        "department_id": department_id
    }
    await manager.connect(websocket, user_id, role, metadata)
    try:
        while True:
            # Keep connection open and listen for any ping/pong messages
            data = await websocket.receive_text()
            # Respond to ping to keep connection alive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
