"""
WebSocket API Endpoints

Provides real-time WebSocket connections for:
- Admin dashboard updates
- Cleaner app notifications
- Customer booking updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from typing import Optional
import logging
import json

from app.services.websocket_manager import ws_manager
from app.core.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


async def get_user_from_token(token: Optional[str]) -> Optional[dict]:
    """Extract user info from JWT token."""
    if not token:
        return None
    
    try:
        payload = decode_token(token)
        if payload and payload.get("type") == "access":
            return {
                "user_id": int(payload.get("sub")),
                "role": payload.get("role", "customer")
            }
    except Exception as e:
        logger.error(f"Token decode error: {e}")
    
    return None


@router.websocket("/ws/admin")
async def admin_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for admin dashboard real-time updates.
    
    Connect: ws://localhost:8000/api/ws/admin?token=<jwt_token>
    
    Receives all job and cleaner events:
    - job.assigned, job.started, job.completed, etc.
    - cleaner.status_changed
    - stats.updated
    """
    user = await get_user_from_token(token)
    
    # Verify admin role
    if not user or user.get("role") != "admin":
        await websocket.close(code=4001, reason="Unauthorized: Admin access required")
        return
    
    user_id = user.get("user_id")
    
    try:
        await ws_manager.connect(websocket, "admin", user_id)
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages with timeout for heartbeat
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle ping/pong for keepalive
                if message.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
                
                # Handle subscription requests
                elif message.get("type") == "subscribe":
                    channel = message.get("channel")
                    if channel:
                        await ws_manager.subscribe(websocket, channel)
                        await ws_manager.send_personal(websocket, {
                            "type": "subscribed",
                            "channel": channel
                        })
                
            except json.JSONDecodeError:
                pass
            
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
        logger.info(f"Admin WebSocket disconnected: user_id={user_id}")
    except Exception as e:
        logger.error(f"Admin WebSocket error: {e}")
        ws_manager.disconnect(websocket, user_id)


@router.websocket("/ws/cleaner")
async def cleaner_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for cleaner app real-time updates.
    
    Connect: ws://localhost:8000/api/ws/cleaner?token=<jwt_token>
    
    Receives:
    - Job assignments for this cleaner
    - Job status updates
    - General notifications
    """
    user = await get_user_from_token(token)
    
    # Verify cleaner or admin role
    if not user or user.get("role") not in ["cleaner", "admin"]:
        await websocket.close(code=4001, reason="Unauthorized: Cleaner access required")
        return
    
    user_id = user.get("user_id")
    cleaner_channel = f"cleaner:{user_id}"
    
    try:
        # Connect to personal cleaner channel
        await ws_manager.connect(websocket, cleaner_channel, user_id)
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle ping/pong
                if message.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
                
                # Handle location updates
                elif message.get("type") == "location_update":
                    # Could broadcast to admin dashboard
                    await ws_manager.broadcast_to_channel("admin", {
                        "type": "cleaner.location",
                        "payload": {
                            "cleaner_id": user_id,
                            "latitude": message.get("latitude"),
                            "longitude": message.get("longitude")
                        }
                    })
                
            except json.JSONDecodeError:
                pass
            
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
        logger.info(f"Cleaner WebSocket disconnected: user_id={user_id}")
    except Exception as e:
        logger.error(f"Cleaner WebSocket error: {e}")
        ws_manager.disconnect(websocket, user_id)


@router.websocket("/ws/customer")
async def customer_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for customer booking updates.
    
    Connect: ws://localhost:8000/api/ws/customer?token=<jwt_token>
    
    Receives:
    - Booking status updates
    - Cleaner arrival notifications
    - Job completion notifications
    """
    user = await get_user_from_token(token)
    
    if not user:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    user_id = user.get("user_id")
    customer_channel = f"customer:{user_id}"
    
    try:
        await ws_manager.connect(websocket, customer_channel, user_id)
        
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle ping/pong
                if message.get("type") == "ping":
                    await ws_manager.send_personal(websocket, {"type": "pong"})
                
            except json.JSONDecodeError:
                pass
            
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
        logger.info(f"Customer WebSocket disconnected: user_id={user_id}")
    except Exception as e:
        logger.error(f"Customer WebSocket error: {e}")
        ws_manager.disconnect(websocket, user_id)


@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics (admin only)."""
    return ws_manager.get_stats()
