from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

router = APIRouter()

MAX_MESSAGE_BYTES = 700_000
MAX_TEXT_MESSAGE_CHARS = 4_000
MAX_IMAGE_DATA_URL_CHARS = 520_000
MAX_ROOM_CONNECTIONS = 32
MAX_DELAY_MS = 5_000
IMAGE_DATA_URL_PREFIXES = (
    "data:image/jpeg;base64,",
    "data:image/png;base64,",
    "data:image/webp;base64,",
)


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
    cleaned = "".join(character for character in value.strip() if character.isalnum() or character in "-_")
    return (cleaned or "playground")[:40]


def _image_payload_error(payload: dict[str, object]) -> str | None:
    data_url = payload.get("dataUrl")
    if not isinstance(data_url, str) or not data_url.startswith(IMAGE_DATA_URL_PREFIXES):
        return "Image payload must be a JPEG, PNG or WebP data URL."
    if len(data_url) > MAX_IMAGE_DATA_URL_CHARS:
        return f"Image payload exceeds {MAX_IMAGE_DATA_URL_CHARS} characters."

    width = payload.get("width")
    height = payload.get("height")
    if not isinstance(width, (int, float)) or not isinstance(height, (int, float)) or width <= 0 or height <= 0:
        return "Image payload must include positive width and height."
    if width > 4096 or height > 4096:
        return "Image dimensions must not exceed 4096 pixels."

    name = payload.get("name")
    if name is not None and (not isinstance(name, str) or len(name) > 180):
        return "Image name must be at most 180 characters."

    caption = payload.get("caption")
    if caption is not None and (not isinstance(caption, str) or len(caption) > MAX_TEXT_MESSAGE_CHARS):
        return f"Image caption must be at most {MAX_TEXT_MESSAGE_CHARS} characters."
    return None


async def _handle_json(room: str, client: Client, message: dict[str, object]) -> bool:
    action = str(message.get("action", "echo")).strip().lower()

    if action == "echo":
        await client.websocket.send_json(_event("echo", connectionId=client.id, data=message.get("message", message.get("data"))))
        return False

    if action == "broadcast":
        payload = message.get("message", message.get("data"))
        if isinstance(payload, str) and len(payload) > MAX_TEXT_MESSAGE_CHARS:
            await client.websocket.send_json(_event("error", message=f"Chat text exceeds {MAX_TEXT_MESSAGE_CHARS} characters."))
            return False
        if isinstance(payload, dict) and payload.get("kind") == "image":
            image_error = _image_payload_error(payload)
            if image_error:
                await client.websocket.send_json(_event("error", message=image_error))
                return False
        await rooms.broadcast(
            room,
            _event("broadcast", room=room, fromConnectionId=client.id, data=payload),
        )
        return False

    if action == "delay":
        raw_delay = message.get("milliseconds", 1000)
        try:
            delay_ms = max(0, min(int(raw_delay), MAX_DELAY_MS))
        except (TypeError, ValueError):
            delay_ms = 1000
        await asyncio.sleep(delay_ms / 1000)
        await client.websocket.send_json(_event("delayed", connectionId=client.id, delayMs=delay_ms, data=message.get("message", message.get("data"))))
        return False

    if action == "heartbeat":
        await client.websocket.send_json(_event("heartbeat", connectionId=client.id, status="alive"))
        return False

    if action == "whoami":
        await client.websocket.send_json(_event("identity", connectionId=client.id, room=room, roomConnections=await rooms.count(room)))
        return False

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
        return True

    await client.websocket.send_json(
        _event(
            "error",
            message=f"Unknown action: {action}",
            supportedActions=["echo", "broadcast", "delay", "heartbeat", "whoami", "close"],
        )
    )
    return False


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
            if await _handle_json(room_name, client, parsed):
                break
    except WebSocketDisconnect:
        pass
    finally:
        await rooms.disconnect(room_name, client.id)
        await rooms.broadcast(
            room_name,
            _event("presence", room=room_name, roomConnections=await rooms.count(room_name)),
        )
