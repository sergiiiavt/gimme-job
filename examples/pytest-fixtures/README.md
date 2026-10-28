# pytest fixture lifecycle + Playwright isolation — runnable examples

These examples do not need a deployed app, credentials, or network calls during test execution.

## Setup

From this directory, with Python 3.10+:

```bash
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
python -m pip install pytest pytest-playwright
python -m playwright install chromium
```

## Run

```bash
python -m pytest tests/test_scopes.py -q
python -m pytest tests/test_scopes.py -v --setup-show
python -m pytest tests/test_playwright_isolation.py -q --browser chromium
```

The first two commands require only `pytest` (no browser). The last one requires `pytest-playwright` and its Chromium browser bundle. If Linux reports missing system libraries, see the official [Playwright installation instructions](https://playwright.dev/python/docs/intro) and install the required dependencies using the supported platform instructions.

Read the files in this order: `tests/conftest.py` for the fixture graph and all five scopes; `tests/test_scopes.py` for caching within a test, isolation between tests, dependency injection, and parametrization; `tests/test_playwright_isolation.py` for per-test `page`/`context`, shared `browser`, and manual context cleanup.

## What to observe

- `--setup-show` reveals fixture setup/teardown. A function-scoped `cart` is created and torn down for every test case, including parametrized cases.
- `run_identity` is reused for this pytest process. A session-scoped fixture is **not** a global singleton across `pytest-xdist` workers.
- `cart_with_mouse` and `cart` in the same test reference the same object. A second test gets a new cart, regardless of test order.
- Playwright's `browser` is session-scoped, but `page` and `context` are function-scoped. The sample uses `page.set_content`, so it runs without an external application.
- `browser.new_context()` creates a context manually: close it yourself, and note that pytest-playwright CLI context options do not automatically affect manually created contexts.

Source references: [pytest fixture scope](https://docs.pytest.org/en/stable/how-to/fixtures.html), [pytest fixtures reference](https://docs.pytest.org/en/stable/reference/fixtures.html), [Playwright Python pytest plugin](https://playwright.dev/python/docs/test-runners).
