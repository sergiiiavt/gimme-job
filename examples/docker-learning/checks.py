"""Network checks shared by the Compose test service and the course CI gate."""

import json
import os
import sys
import urllib.error
import urllib.request


def request(base_url, path, method="GET"):
    message = urllib.request.Request(base_url + path, method=method)
    try:
        with urllib.request.urlopen(message, timeout=5) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as response:
        return response.code, json.load(response)


def check(base_url, require_existing=False):
    assert request(base_url, "/health") == (200, {"status": "ok"})
    status, before = request(base_url, "/counter")
    assert status == 200 and isinstance(before["value"], int)
    if require_existing:
        assert before["value"] > 0, "Counter was lost when the API container was recreated"
    assert request(base_url, "/counter", "POST") == (200, {"value": before["value"] + 1})
    assert request(base_url, "/counter") == (200, {"value": before["value"] + 1})
    assert request(base_url, "/missing") == (404, {"error": "not found"})
    assert request(base_url, "/missing", "POST") == (404, {"error": "not found"})
    print("PASS: readiness, increment, read, unknown routes" + (", persistence" if require_existing else ""))


if __name__ == "__main__":
    check(os.environ.get("API_URL", "http://api:8000"), "--require-existing" in sys.argv)
