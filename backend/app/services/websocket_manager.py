"""
WebSocket Manager

Manages WebSocket connections for real-time updates.
Supports multiple channels: admin dashboard, cleaner app, customer notifications.
"""
import asyncio
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
import json
import logging

from app.services.events import event_publisher, Event, EventType

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections with channel-based routing.
    
    Channels:
    - admin: Admin dashboard real-time updates
    - cleaner:{user_id}: Cleaner-specific updates
    - customer:{user_id}: Customer-specific updates
    """
    
    _instance: Optional['ConnectionManager'] = None
    
    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # Channel -> Set of WebSocket connections
        self._channels: Dict[str, Set[WebSocket]] = {}
        
        # WebSocket -> List of subscribed channels
        self._subscriptions: Dict[WebSocket, Set[str]] = {}
        
        # User ID -> WebSocket mapping
        self._user_connections: Dict[int, Set[WebSocket]] = {}
        
        self._initialized = True
        
        # Subscribe to all events for broadcasting
        event_publisher.subscribe_all(self._handle_event)
    
    async def connect(
        self,
        websocket: WebSocket,
        channel: str,
        user_id: Optional[int] = None
    ) -> None:
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        
        # Add to channel
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(websocket)
        
        # Track subscriptions
        if websocket not in self._subscriptions:
            self._subscriptions[websocket] = set()
        self._subscriptions[websocket].add(channel)
        
        # Track user connection
        if user_id:
            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            self._user_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected: channel={channel}, user_id={user_id}")
        
        # Send connection confirmation
        await self.send_personal(websocket, {
            "type": "connected",
            "channel": channel,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None) -> None:
        """Remove a WebSocket connection."""
        # Remove from all subscribed channels
        if websocket in self._subscriptions:
            for channel in self._subscriptions[websocket]:
                if channel in self._channels:
                    self._channels[channel].discard(websocket)
                    if not self._channels[channel]:
                        del self._channels[channel]
            del self._subscriptions[websocket]
        
        # Remove from user connections
        if user_id and user_id in self._user_connections:
            self._user_connections[user_id].discard(websocket)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        
        logger.info(f"WebSocket disconnected: user_id={user_id}")
    
    async def subscribe(self, websocket: WebSocket, channel: str) -> None:
        """Subscribe a connection to an additional channel."""
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(websocket)
        
        if websocket in self._subscriptions:
            self._subscriptions[websocket].add(channel)
    
    async def unsubscribe(self, websocket: WebSocket, channel: str) -> None:
        """Unsubscribe a connection from a channel."""
        if channel in self._channels:
            self._channels[channel].discard(websocket)
        
        if websocket in self._subscriptions:
            self._subscriptions[websocket].discard(channel)
    
    async def send_personal(self, websocket: WebSocket, data: Dict[str, Any]) -> None:
        """Send message to a specific connection."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
    
    async def broadcast_to_channel(self, channel: str, data: Dict[str, Any]) -> None:
        """Broadcast message to all connections in a channel."""
        if channel not in self._channels:
            return
        
        disconnected = []
        for websocket in self._channels[channel]:
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected sockets
        for ws in disconnected:
            self.disconnect(ws)
    
    async def send_to_user(self, user_id: int, data: Dict[str, Any]) -> None:
        """Send message to all connections of a specific user."""
        if user_id not in self._user_connections:
            return
        
        disconnected = []
        for websocket in self._user_connections[user_id]:
            try:
                await websocket.send_json(data)
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected sockets
        for ws in disconnected:
            self.disconnect(ws, user_id)
    
    async def _handle_event(self, event: Event) -> None:
        """Handle events from the event publisher and broadcast to appropriate channels."""
        event_data = event.to_dict()
        
        # Always broadcast to admin channel
        await self.broadcast_to_channel("admin", event_data)
        
        # Route to specific channels based on event type
        if event.type in [
            EventType.JOB_ASSIGNED,
            EventType.JOB_STARTED,
            EventType.JOB_COMPLETED,
            EventType.JOB_CANCELLED,
            EventType.JOB_FAILED
        ]:
            # Send to assigned cleaner
            cleaner_id = event.payload.get("cleaner_id")
            if cleaner_id:
                await self.broadcast_to_channel(f"cleaner:{cleaner_id}", event_data)
            
            # Send to customer
            customer_id = event.payload.get("customer_id")
            if customer_id:
                await self.broadcast_to_channel(f"customer:{customer_id}", event_data)
        
        elif event.type == EventType.CLEANER_STATUS_CHANGED:
            cleaner_id = event.payload.get("cleaner_id")
            if cleaner_id:
                await self.broadcast_to_channel(f"cleaner:{cleaner_id}", event_data)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": sum(len(conns) for conns in self._channels.values()),
            "channels": {
                channel: len(connections)
                for channel, connections in self._channels.items()
            },
            "users_connected": len(self._user_connections)
        }


# Global connection manager instance
ws_manager = ConnectionManager()
