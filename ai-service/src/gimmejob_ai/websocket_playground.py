from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

router = APIRouter()

MAX_MESSAGE_BYTES = 16_384
MAX_ROOM_CONNECTIONS = 32
MAX_DELAY_MS = 5_000


def _timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def _event(event_type: str, **payload: object) -> dict[str, object]:
    return {"type": event_type, "timestamp": _timestamp(), **payload}


@dataclass(frozen=True)
class Client:
    id: str
    websocket: WebSocket


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket) -> Client | None:
        await websocket.accept()
        async with self._lock:
            connections = self._rooms[room]
            if len(connections) >= MAX_ROOM_CONNECTIONS:
                await websocket.send_json(_event("error", message="Room is full."))
                await websocket.close(code=1013, reason="Room is full")
                return None
            client = Client(id=uuid4().hex[:12], websocket=websocket)
            connections[client.id] = websocket
            return client

    async def disconnect(self, room: str, client_id: str) -> None:
        async with self._lock:
            connections = self._rooms.get(room)
            if not connections:
                return
            connections.pop(client_id, None)
            if not connections:
                self._rooms.pop(room, None)

    async def broadcast(self, room: str, message: dict[str, object]) -> None:
        async with self._lock:
            targets = list(self._rooms.get(room, {}).values())
        for target in targets:
            try:
                await target.send_json(message)
            except RuntimeError:
                pass

    async def count(self, room: str) -> int:
        async with self._lock:
            return len(self._rooms.get(room, {}))


rooms = RoomManager()


def _normalize_room(value: str) -> str:
    cleaned = "".join(character for character in value.strip() if character.isalnum() or character in "-_" )
    return (cleaned or "playground")[:40]


async def _handle_json(room: str, client: Client, message: dict[str, object]) -> None:
    action = str(message.get("action", "echo")).strip().lower()

    if action == "echo":
        await client.websocket.send_json(_event("echo", connectionId=client.id, data=message.get("message", message.get("data"))))
        return

    if action == "broadcast":
        await rooms.broadcast(
            room,
            _event("broadcast", room=room, fromConnectionId=client.id, data=message.get("message", message.get("data"))),
        )
        return

    if action == "delay":
        raw_delay = message.get("milliseconds", 1000)
        try:
            delay_ms = max(0, min(int(raw_delay), MAX_DELAY_MS))
        except (TypeError, ValueError):
            delay_ms = 1000
        await asyncio.sleep(delay_ms / 1000)
        await client.websocket.send_json(_event("delayed", connectionId=client.id, delayMs=delay_ms, data=message.get("message", message.get("data"))))
        return

    if action == "heartbeat":
        await client.websocket.send_json(_event("heartbeat", connectionId=client.id, status="alive"))
        return

    if action == "whoami":
        await client.websocket.send_json(_event("identity", connectionId=client.id, room=room, roomConnections=await rooms.count(room)))
        return

    if action == "close":
        raw_code = message.get("code", 1000)
        try:
            code = int(raw_code)
        except (TypeError, ValueError):
            code = 1000
        if code < 1000 or code > 4999 or code in {1004, 1005, 1006, 1015}:
            code = 1000
        reason = str(message.get("reason", "Closed from playground"))[:120]
        await client.websocket.close(code=code, reason=reason)
        return

    await client.websocket.send_json(
        _event(
            "error",
            message=f"Unknown action: {action}",
            supportedActions=["echo", "broadcast", "delay", "heartbeat", "whoami", "close"],
        )
    )


@router.websocket("/v1/playground/ws")
async def websocket_playground(websocket: WebSocket, room: str = Query(default="playground")) -> None:
    room_name = _normalize_room(room)
    client = await rooms.connect(room_name, websocket)
    if client is None:
        return

    await websocket.send_json(
        _event(
            "connected",
            connectionId=client.id,
            room=room_name,
            roomConnections=await rooms.count(room_name),
            maxMessageBytes=MAX_MESSAGE_BYTES,
        )
    )
    await rooms.broadcast(
        room_name,
        _event("presence", room=room_name, roomConnections=await rooms.count(room_name)),
    )

    try:
        while True:
            text = await websocket.receive_text()
            if len(text.encode("utf-8")) > MAX_MESSAGE_BYTES:
                await websocket.send_json(_event("error", message=f"Message exceeds {MAX_MESSAGE_BYTES} bytes."))
                continue

            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                await websocket.send_json(_event("echo", connectionId=client.id, data=text, format="text"))
                continue

            if not isinstance(parsed, dict):
                await websocket.send_json(_event("error", message="JSON messages must be objects."))
                continue
            await _handle_json(room_name, client, parsed)
    except WebSocketDisconnect:
        pass
    finally:
        await rooms.disconnect(room_name, client.id)
        await rooms.broadcast(
            room_name,
            _event("presence", room=room_name, roomConnections=await rooms.count(room_name)),
        )
