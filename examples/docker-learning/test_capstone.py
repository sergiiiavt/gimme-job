"""Check the teaching API without requiring Docker or third-party dependencies."""

import json
import os
import signal
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from checks import check, request


class CapstoneTest(unittest.TestCase):
    def start_api(self):
        self.process = subprocess.Popen(
            [sys.executable, "-u", str(Path(__file__).with_name("app.py"))],
            env={**os.environ, "PORT": "0", "DB_PATH": self.database_path},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        ready = json.loads(self.process.stdout.readline())
        self.base_url = f'http://127.0.0.1:{ready["port"]}'

    def stop_api(self):
        if self.process.poll() is None:
            self.process.send_signal(signal.SIGTERM)
        try:
            self.process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.communicate()
            self.fail("API did not stop gracefully")
        self.assertEqual(self.process.returncode, 0)

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database_path = str(Path(self.directory.name) / "counter.sqlite")
        self.start_api()
        self.addCleanup(lambda: self.stop_api() if self.process.poll() is None else None)

    def test_contract_and_persistence_after_process_replacement(self):
        check(self.base_url)
        before = request(self.base_url, "/counter")[1]
        self.stop_api()
        self.start_api()
        self.assertEqual(request(self.base_url, "/counter"), (200, before))
        check(self.base_url, require_existing=True)

    def test_storage_failure_is_reported_without_internal_details(self):
        with sqlite3.connect(self.database_path) as database:
            database.execute("DROP TABLE counter")
        self.assertEqual(request(self.base_url, "/health"), (503, {"error": "storage unavailable"}))
        self.assertEqual(request(self.base_url, "/counter", "POST"), (503, {"error": "storage unavailable"}))

    def test_concurrent_increments_are_not_lost(self):
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: request(self.base_url, "/counter", "POST"), range(12)))
        self.assertTrue(all(status == 200 for status, _ in results))
        self.assertEqual(request(self.base_url, "/counter"), (200, {"value": 12}))


if __name__ == "__main__":
    unittest.main()
