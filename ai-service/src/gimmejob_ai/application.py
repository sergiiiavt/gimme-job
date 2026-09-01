from __future__ import annotations

from .main import app
from .websocket_playground import router as websocket_playground_router

app.include_router(websocket_playground_router)
