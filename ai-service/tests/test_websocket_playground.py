from __future__ import annotations

import json
import unittest

from fastapi.testclient import TestClient

from gimmejob_ai.application import app


class WebSocketPlaygroundTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_echo_text_and_json(self) -> None:
        with self.client.websocket_connect("/v1/playground/ws?room=test-echo") as socket:
            connected = socket.receive_json()
            self.assertEqual(connected["type"], "connected")
            self.assertEqual(connected["room"], "test-echo")
            socket.receive_json()  # presence

            socket.send_text("hello")
            text_echo = socket.receive_json()
            self.assertEqual(text_echo["type"], "echo")
            self.assertEqual(text_echo["data"], "hello")
            self.assertEqual(text_echo["format"], "text")

            socket.send_text(json.dumps({"action": "echo", "message": "json hello"}))
            json_echo = socket.receive_json()
            self.assertEqual(json_echo["type"], "echo")
            self.assertEqual(json_echo["data"], "json hello")

    def test_broadcast_reaches_two_clients_in_same_room(self) -> None:
        with self.client.websocket_connect("/v1/playground/ws?room=broadcast") as first:
            first.receive_json()
            first.receive_json()
            with self.client.websocket_connect("/v1/playground/ws?room=broadcast") as second:
                second.receive_json()
                first.receive_json()  # presence after second client joins
                second.receive_json()  # presence after second client joins

                first.send_text(json.dumps({"action": "broadcast", "message": "room message"}))
                first_broadcast = first.receive_json()
                second_broadcast = second.receive_json()

                self.assertEqual(first_broadcast["type"], "broadcast")
                self.assertEqual(second_broadcast["type"], "broadcast")
                self.assertEqual(second_broadcast["data"], "room message")
                self.assertEqual(second_broadcast["room"], "broadcast")

    def test_whoami_reports_room(self) -> None:
        with self.client.websocket_connect("/v1/playground/ws?room=identity") as socket:
            socket.receive_json()
            socket.receive_json()
            socket.send_text(json.dumps({"action": "whoami"}))
            identity = socket.receive_json()
            self.assertEqual(identity["type"], "identity")
            self.assertEqual(identity["room"], "identity")
            self.assertGreaterEqual(identity["roomConnections"], 1)


if __name__ == "__main__":
    unittest.main()
