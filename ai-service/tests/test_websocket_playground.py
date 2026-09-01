from __future__ import annotations

import json
import unittest
from contextlib import contextmanager
from typing import Iterator

from fastapi.testclient import TestClient, WebSocketTestSession

from gimmejob_ai.application import app


class WebSocketPlaygroundTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    @contextmanager
    def connected_socket(self, room: str) -> Iterator[WebSocketTestSession]:
        with self.client.websocket_connect(f"/v1/playground/ws?room={room}") as socket:
            connected = socket.receive_json()
            self.assertEqual(connected["type"], "connected")
            self.assertEqual(connected["room"], room)
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

    def test_whoami_reports_room(self) -> None:
        with self.connected_socket("identity") as socket:
            identity = self.send_action(socket, "whoami")
            self.assertEqual(identity["type"], "identity")
            self.assertEqual(identity["room"], "identity")
            self.assertGreaterEqual(identity["roomConnections"], 1)


if __name__ == "__main__":
    unittest.main()
