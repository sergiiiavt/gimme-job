from __future__ import annotations

import json
import unittest
from contextlib import contextmanager
from typing import Iterator

from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession

from gimmejob_ai.application import app
from gimmejob_ai.websocket_playground import MAX_MESSAGE_BYTES, _normalize_room


class WebSocketPlaygroundTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    @contextmanager
    def connected_socket(self, room: str, expected_room: str | None = None) -> Iterator[WebSocketTestSession]:
        with self.client.websocket_connect(f"/v1/playground/ws?room={room}") as socket:
            connected = socket.receive_json()
            self.assertEqual(connected["type"], "connected")
            self.assertEqual(connected["room"], expected_room or room)
            socket.receive_json()  # initial presence event
            yield socket

    @staticmethod
    def send_action(socket: WebSocketTestSession, action: str, **payload: object) -> dict[str, object]:
        socket.send_text(json.dumps({"action": action, **payload}))
        return socket.receive_json()

    def test_echo_text_and_json(self) -> None:
        with self.connected_socket("test-echo") as socket:
            socket.send_text("hello")
            text_echo = socket.receive_json()
            self.assertEqual(text_echo["type"], "echo")
            self.assertEqual(text_echo["data"], "hello")
            self.assertEqual(text_echo["format"], "text")

            json_echo = self.send_action(socket, "echo", message="json hello")
            self.assertEqual(json_echo["type"], "echo")
            self.assertEqual(json_echo["data"], "json hello")

    def test_broadcast_reaches_two_clients_in_same_room(self) -> None:
        with self.connected_socket("broadcast") as first:
            with self.connected_socket("broadcast") as second:
                first.receive_json()  # presence after second client joins
                broadcast = self.send_action(first, "broadcast", message="room message")
                second_broadcast = second.receive_json()

                self.assertEqual(broadcast["type"], "broadcast")
                self.assertEqual(second_broadcast["type"], "broadcast")
                self.assertEqual(second_broadcast["data"], "room message")
                self.assertEqual(second_broadcast["room"], "broadcast")

    def test_identity_and_heartbeat(self) -> None:
        with self.connected_socket("identity") as socket:
            identity = self.send_action(socket, "whoami")
            self.assertEqual(identity["type"], "identity")
            self.assertEqual(identity["room"], "identity")
            self.assertGreaterEqual(identity["roomConnections"], 1)

            heartbeat = self.send_action(socket, "heartbeat")
            self.assertEqual(heartbeat["type"], "heartbeat")
            self.assertEqual(heartbeat["status"], "alive")

    def test_delay_clamps_and_handles_invalid_values(self) -> None:
        with self.connected_socket("delay") as socket:
            immediate = self.send_action(socket, "delay", milliseconds=-10, message="now")
            self.assertEqual(immediate["type"], "delayed")
            self.assertEqual(immediate["delayMs"], 0)
            self.assertEqual(immediate["data"], "now")

            fallback = self.send_action(socket, "delay", milliseconds="not-a-number")
            self.assertEqual(fallback["type"], "delayed")
            self.assertEqual(fallback["delayMs"], 1000)

    def test_validation_errors_are_returned_as_frames(self) -> None:
        with self.connected_socket("validation") as socket:
            socket.send_text("[]")
            array_error = socket.receive_json()
            self.assertEqual(array_error["type"], "error")
            self.assertEqual(array_error["message"], "JSON messages must be objects.")

            unknown = self.send_action(socket, "does-not-exist")
            self.assertEqual(unknown["type"], "error")
            self.assertIn("does-not-exist", unknown["message"])
            self.assertIn("echo", unknown["supportedActions"])

            socket.send_text("x" * (MAX_MESSAGE_BYTES + 1))
            oversized = socket.receive_json()
            self.assertEqual(oversized["type"], "error")
            self.assertIn(str(MAX_MESSAGE_BYTES), oversized["message"])

    def test_room_name_is_normalized(self) -> None:
        self.assertEqual(_normalize_room("  qa room!@#  "), "qaroom")
        self.assertEqual(_normalize_room("!!!"), "playground")
        self.assertEqual(len(_normalize_room("a" * 100)), 40)

        with self.connected_socket("qa%20room!", expected_room="qa20room") as socket:
            identity = self.send_action(socket, "whoami")
            self.assertEqual(identity["room"], "qa20room")

    def test_close_action_uses_requested_reason_and_sanitizes_reserved_code(self) -> None:
        with self.connected_socket("close-normal") as socket:
            socket.send_text(json.dumps({"action": "close", "code": 1000, "reason": "done"}))
            closed = socket.receive()
            self.assertEqual(closed["type"], "websocket.close")
            self.assertEqual(closed["code"], 1000)
            self.assertEqual(closed["reason"], "done")

        with self.connected_socket("close-reserved") as socket:
            socket.send_text(json.dumps({"action": "close", "code": 1006, "reason": "reserved"}))
            closed = socket.receive()
            self.assertEqual(closed["type"], "websocket.close")
            self.assertEqual(closed["code"], 1000)


if __name__ == "__main__":
    unittest.main()
