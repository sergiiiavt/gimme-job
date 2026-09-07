"""Read-only Locust workload for the public GimmeJob production surface.

The default target is the local development server. Production runs require an
explicit acknowledgement and are capped by default to 10 users and 10 minutes.
If no task selector is supplied for production, the workload safely defaults to
the real anonymous Vacancies UI scenario instead of running every diagnostic.
"""

import logging
import os
from typing import NoReturn
from urllib.parse import urlparse

from locust import HttpUser, between, events, tag, task
from locust.exception import StopUser


LOGGER = logging.getLogger(__name__)
LOCAL_HOST = "http://127.0.0.1:4173"
PRODUCTION_HOSTS = {"gimme-job.com", "www.gimme-job.com"}
PRODUCTION_ACKNOWLEDGEMENT = "gimme-job.com"
DEFAULT_PRODUCTION_TAG = "vacancies-ui"


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer, got {raw!r}.") from error
    if value < 1:
        raise RuntimeError(f"{name} must be greater than zero.")
    return value


def _non_negative_float(name: str, default: float) -> float:
    raw = os.getenv(name, str(default))
    try:
        value = float(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be a number, got {raw!r}.") from error
    if value < 0:
        raise RuntimeError(f"{name} must not be negative.")
    return value


def _configured_user_count(environment: object) -> int:
    runner = getattr(environment, "runner", None)
    parsed_options = getattr(environment, "parsed_options", None)
    values = (
        getattr(runner, "target_user_count", 0),
        getattr(parsed_options, "num_users", 0),
    )
    return max(int(value or 0) for value in values)


def _configured_run_seconds(environment: object) -> float | None:
    parsed_options = getattr(environment, "parsed_options", None)
    value = getattr(parsed_options, "run_time", None)
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _effective_host(environment: object) -> str:
    environment_host = getattr(environment, "host", None)
    if isinstance(environment_host, str) and environment_host.strip():
        return environment_host.rstrip("/")
    return os.getenv("GIMMEJOB_HOST", LOCAL_HOST).rstrip("/")


def _selected_tags(environment: object) -> list[str] | tuple[str, ...] | set[str] | None:
    environment_tags = getattr(environment, "tags", None)
    if environment_tags:
        return environment_tags
    parsed_options = getattr(environment, "parsed_options", None)
    parsed_tags = getattr(parsed_options, "tags", None)
    return parsed_tags or None


def _stop_run(user: HttpUser, reason: str) -> NoReturn:
    LOGGER.error("GimmeJob load-test safety guard stopped the run: %s", reason)
    runner = getattr(user.environment, "runner", None)
    if runner is not None:
        runner.quit()
    raise StopUser()


def _status_failure(response: object, expected_status: int = 200) -> str:
    error = getattr(response, "error", None)
    status_code = getattr(response, "status_code", 0)
    if status_code == 0 and error:
        return f"request failed before receiving an HTTP response: {error}"
    return f"expected HTTP {expected_status}, received {status_code}"


@events.init.add_listener
def select_safe_default_production_scenario(environment: object, **_kwargs: object) -> None:
    """Default an untagged production run to the real Vacancies UI workload.

    Locust fires ``init`` before it filters tasks by tags. Setting
    ``environment.tags`` here therefore gives Azure portal runs a deterministic,
    safe default even when the portal test configuration omitted LOCUST_TAGS.
    Explicit selectors still win and can be used for isolated diagnostics.
    """

    parsed_host = urlparse(_effective_host(environment))
    hostname = (parsed_host.hostname or "").lower()
    if hostname not in PRODUCTION_HOSTS or _selected_tags(environment):
        return

    setattr(environment, "tags", [DEFAULT_PRODUCTION_TAG])
    LOGGER.warning(
        "No task selector supplied for production; defaulting to %s.",
        DEFAULT_PRODUCTION_TAG,
    )


class GimmeJobPublicReader(HttpUser):
    """Read-only public scenarios, including the real Vacancies UI request flow."""

    host = os.getenv("GIMMEJOB_HOST", LOCAL_HOST).rstrip("/")
    wait_time = between(2, 5)

    def on_start(self) -> None:
        parsed_host = urlparse(_effective_host(self.environment))
        hostname = (parsed_host.hostname or "").lower()
        if hostname in PRODUCTION_HOSTS:
            if parsed_host.scheme != "https":
                _stop_run(self, "production tests require an https:// host")

            acknowledgement = os.getenv("GIMMEJOB_PRODUCTION_ACK", "")
            if acknowledgement != PRODUCTION_ACKNOWLEDGEMENT:
                _stop_run(
                    self,
                    "set GIMMEJOB_PRODUCTION_ACK=gimme-job.com before targeting production",
                )

            if not _selected_tags(self.environment):
                _stop_run(
                    self,
                    "production scenario selection failed before users started",
                )

            max_users = _positive_int("GIMMEJOB_MAX_USERS", 10)
            configured_users = _configured_user_count(self.environment)
            if configured_users > max_users:
                _stop_run(
                    self,
                    f"configured users ({configured_users}) exceed GIMMEJOB_MAX_USERS ({max_users})",
                )

            max_run_seconds = _positive_int("GIMMEJOB_MAX_RUN_SECONDS", 600)
            configured_run_seconds = _configured_run_seconds(self.environment)
            if configured_run_seconds is None:
                _stop_run(
                    self,
                    "production tests require an explicit --run-time or LOCUST_RUN_TIME",
                )
            if configured_run_seconds > max_run_seconds:
                _stop_run(
                    self,
                    "configured duration "
                    f"({configured_run_seconds:g}s) exceeds GIMMEJOB_MAX_RUN_SECONDS "
                    f"({max_run_seconds}s)",
                )

        self.client.headers.update(
            {
                "accept": "application/json, text/html;q=0.9",
                "user-agent": "GimmeJob-authorized-Locust/1.0",
            }
        )

    def _expect_html(self, path: str, marker: str | None, name: str) -> None:
        with self.client.get(path, name=name, catch_response=True) as response:
            if response.status_code != 200:
                response.failure(_status_failure(response))
                return
            if "text/html" not in response.headers.get("content-type", ""):
                response.failure("expected an HTML response")
                return
            if marker and marker not in response.text:
                response.failure(f"expected page marker {marker!r}")

    def _expect_public_auth_state(self) -> None:
        with self.client.get(
            "/api/auth-state",
            name="GET /api/auth-state [vacancies UI]",
            catch_response=True,
        ) as response:
            if response.status_code != 401:
                response.failure(_status_failure(response, 401))
                return
            # The real Vacancies route branches on HTTP status only. For an
            # anonymous production visitor, 401 is the expected successful path.
            response.success()

    def _expect_dashboard(self, name: str) -> None:
        with self.client.get(
            "/api/dashboard",
            name=name,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(_status_failure(response))
                return
            try:
                payload = response.json()
            except ValueError:
                response.failure("dashboard response is not valid JSON")
                return
            if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
                response.failure("dashboard response does not match the vacancy UI contract")

    @tag("vacancies-ui", "real-ui", "d1")
    @task(6)
    def vacancies_ui(self) -> None:
        """Model the actual anonymous /vacancies request sequence used by the frontend."""

        self._expect_html("/vacancies", None, "GET /vacancies [UI page]")
        self._expect_public_auth_state()
        self._expect_dashboard("GET /api/dashboard [vacancies UI]")

    @tag("health", "smoke", "api", "worker")
    @task(1)
    def health(self) -> None:
        with self.client.get("/api/health", name="GET /api/health", catch_response=True) as response:
            if response.status_code != 200:
                response.failure(_status_failure(response))
                return
            try:
                payload = response.json()
            except ValueError:
                response.failure("health response is not valid JSON")
                return
            if (
                not isinstance(payload, dict)
                or payload.get("ok") is not True
                or payload.get("service") != "jobpilot-cloud"
            ):
                response.failure("health response does not match the public contract")

    @tag("home", "diagnostic", "edge", "html")
    @task(1)
    def home_page(self) -> None:
        self._expect_html("/", "Why I created this site", "GET / [public home]")

    @tag("reference", "diagnostic", "worker", "html")
    @task(1)
    def uncached_reference_page(self) -> None:
        self._expect_html(
            "/reference/qa-fundamentals",
            "Core QA distinctions",
            "GET /reference/qa-fundamentals [uncached]",
        )

    @tag("jobs-api", "infra", "d1", "api")
    @task(1)
    def public_jobs(self) -> None:
        with self.client.get(
            "/api/public/jobs",
            name="GET /api/public/jobs [infra D1]",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(_status_failure(response))
                return
            try:
                payload = response.json()
            except ValueError:
                response.failure("public jobs response is not valid JSON")
                return
            if (
                not isinstance(payload, dict)
                or not isinstance(payload.get("jobs"), list)
                or not payload.get("generatedAt")
            ):
                response.failure("public jobs response does not match the public contract")

    @tag("dashboard", "diagnostic", "d1", "api", "heavy")
    @task(1)
    def public_dashboard(self) -> None:
        self._expect_dashboard("GET /api/dashboard [diagnostic D1 heavy]")


@events.quitting.add_listener
def apply_exploratory_thresholds(environment: object, **_kwargs: object) -> None:
    """Return a failing process exit code when the exploratory guardrails are missed."""

    stats = getattr(getattr(environment, "stats", None), "total", None)
    if stats is None or stats.num_requests == 0:
        setattr(environment, "process_exit_code", 1)
        LOGGER.error("No requests completed during the GimmeJob load test.")
        return

    failures: list[str] = []
    max_failure_ratio = _non_negative_float("GIMMEJOB_MAX_FAILURE_RATIO", 0.01)
    max_p95_ms = _non_negative_float("GIMMEJOB_MAX_P95_MS", 10000)
    p95_ms = stats.get_response_time_percentile(0.95) or 0

    if stats.fail_ratio > max_failure_ratio:
        failures.append(
            f"failure ratio {stats.fail_ratio:.2%} exceeded {max_failure_ratio:.2%}"
        )
    if p95_ms > max_p95_ms:
        failures.append(f"p95 {p95_ms:.0f} ms exceeded {max_p95_ms:.0f} ms")

    if failures:
        setattr(environment, "process_exit_code", 1)
        LOGGER.error("GimmeJob exploratory thresholds failed: %s", "; ".join(failures))
