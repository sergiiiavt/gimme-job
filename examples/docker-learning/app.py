"""Local Docker teaching API. The standard-library server is not a production server."""

import json
import os
import signal
import sqlite3
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


@contextmanager
def connect():
    database = sqlite3.connect(os.environ.get("DB_PATH", "/data/counter.sqlite"), timeout=3)
    try:
        with database:
            yield database
    finally:
        database.close()


def initialize():
    with connect() as database:
        database.execute("CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL)")
        database.execute("INSERT OR IGNORE INTO counter VALUES (1, 0)")


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path not in ("/health", "/counter"):
            self.respond(404, {"error": "not found"})
            return
        try:
            with connect() as database:
                value = database.execute("SELECT value FROM counter WHERE id = 1").fetchone()[0]
            self.respond(200, {"status": "ok"} if self.path == "/health" else {"value": value})
        except sqlite3.Error:
            self.respond(503, {"error": "storage unavailable"})

    def do_POST(self):
        if self.path != "/counter":
            self.respond(404, {"error": "not found"})
            return
        try:
            with connect() as database:
                database.execute("BEGIN IMMEDIATE")
                database.execute("UPDATE counter SET value = value + 1 WHERE id = 1")
                value = database.execute("SELECT value FROM counter WHERE id = 1").fetchone()[0]
            self.respond(200, {"value": value})
        except sqlite3.Error:
            self.respond(503, {"error": "storage unavailable"})

    def log_message(self, format_string, *args):
        print(json.dumps({"event": "http", "message": format_string % args}), flush=True)


def main():
    initialize()
    server = ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8000"))), Handler)

    def stop(_signum, _frame):
        # shutdown() must run outside the serve_forever thread.
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    print(json.dumps({"event": "ready", "port": server.server_port}), flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
