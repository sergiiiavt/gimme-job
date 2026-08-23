const PYODIDE_INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.4/full/";
const MAX_CODE_LENGTH = 12_000;

const SEED_SQL = String.raw`
PRAGMA foreign_keys = OFF;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  birth_date TEXT,
  status TEXT,
  phone TEXT,
  role TEXT,
  created_at TEXT,
  updated_at TEXT
);
INSERT INTO users VALUES
  (1, 'anna@example.com', 'Anna', 'Novak', '1992-03-11', 'active', NULL, 'qa', '2026-01-05T09:00:00', '2026-08-20T10:00:00'),
  (2, 'mark@example.com', 'Mark', 'Stone', '1989-06-22', 'active', '+380501111111', 'dev', '2026-02-10T10:00:00', '2026-08-19T12:00:00'),
  (3, 'anna@example.com', 'Anna', 'Novak', '1992-03-11', 'inactive', NULL, 'qa', '2026-03-12T11:00:00', '2026-08-18T08:00:00'),
  (4, 'john@example.com', 'John', 'Miller', '1995-09-14', 'active', '+380502222222', 'analyst', '2026-04-02T12:00:00', '2026-08-17T09:00:00'),
  (5, NULL, 'Iryna', 'Bondar', '1991-12-01', 'pending', NULL, 'qa', '2026-05-01T08:00:00', '2026-08-16T09:00:00'),
  (6, 'qa@example.com', 'Olena', 'Test', '1994-02-18', 'active', '+380503333333', 'qa', '2026-06-03T08:00:00', '2026-08-15T09:00:00'),
  (7, 'qa@example.com', 'Oleh', 'Test', '1990-04-07', 'active', NULL, 'qa', '2026-07-04T08:00:00', '2026-08-14T09:00:00');

CREATE TABLE active_customers (id INTEGER PRIMARY KEY, email TEXT);
INSERT INTO active_customers VALUES
  (1, 'anna@example.com'), (2, 'mark@example.com'), (3, 'shared@example.com');
CREATE TABLE archived_customers (id INTEGER PRIMARY KEY, email TEXT);
INSERT INTO archived_customers VALUES
  (10, 'old@example.com'), (11, 'shared@example.com');

CREATE TABLE departments (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO departments VALUES (1, 'QA'), (2, 'Engineering'), (3, 'Data');

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department_id INTEGER,
  team_id INTEGER,
  salary INTEGER,
  score INTEGER
);
INSERT INTO employees VALUES
  (1, 'Anna', 1, 10, 5000, 96),
  (2, 'Mark', 2, 20, 5000, 91),
  (3, 'John', 1, 10, 4500, 88),
  (4, 'Iryna', 3, 30, 4000, 94),
  (5, 'Oleh', 1, 11, 3800, 84),
  (6, 'Marta', 2, 20, 3600, 82);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  created_at TEXT
);
INSERT INTO customers VALUES
  (1, 'Acme', 'acme@example.com', '2026-01-01T09:00:00'),
  (2, 'Beta', 'beta@example.com', '2026-02-01T09:00:00'),
  (3, 'Gamma', 'gamma@example.com', '2026-03-01T09:00:00'),
  (4, 'No Orders Ltd', 'none@example.com', '2026-04-01T09:00:00');

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  status TEXT,
  amount REAL,
  total REAL,
  currency TEXT,
  order_date TEXT,
  paid_at TEXT,
  created_at TEXT,
  updated_at TEXT
);
INSERT INTO orders VALUES
  (1, 1, 'paid', 120.00, 120.00, 'USD', '2026-08-01', '2026-08-01T10:00:00', '2026-08-01T09:00:00', '2026-08-01T10:00:00'),
  (2, 1, 'paid', 80.00, 80.00, 'USD', '2026-08-12', '2026-08-12T10:00:00', '2026-08-12T09:00:00', '2026-08-12T10:00:00'),
  (3, 1, 'cancelled', 55.00, 55.00, 'EUR', '2026-08-12', NULL, '2026-08-12T09:00:00', '2026-08-13T10:00:00'),
  (4, 2, 'paid', 220.00, 220.00, 'USD', '2026-08-03', '2026-08-03T10:00:00', '2026-08-03T09:00:00', '2026-08-03T10:00:00'),
  (5, 2, 'pending', 95.00, 95.00, NULL, '2026-08-20', NULL, '2026-08-20T09:00:00', '2026-08-20T10:00:00'),
  (6, 3, 'paid', 310.00, 310.00, 'USD', '2026-08-11', '2026-08-11T10:00:00', '2026-08-11T09:00:00', '2026-08-11T10:00:00'),
  (7, 999, 'paid', 42.00, 42.00, 'USD', '2026-08-09', '2026-08-09T10:00:00', '2026-08-09T09:00:00', '2026-08-09T10:00:00');

CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO categories VALUES (1, 'Hardware'), (2, 'Software');

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category_id INTEGER,
  revenue REAL,
  price REAL
);
INSERT INTO products VALUES
  (1, 'Sensor', 1, 9000, 75),
  (2, 'Gateway', 1, 7200, 120),
  (3, 'Cable', 1, 2100, 15),
  (4, 'Dashboard', 2, 15000, 250),
  (5, 'Agent', 2, 12000, 180),
  (6, 'Reporter', 2, 6000, 95);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER,
  product_id INTEGER,
  quantity INTEGER,
  unit_price REAL
);
INSERT INTO order_items VALUES
  (1, 1, 1, 1, 75), (2, 1, 3, 3, 15), (3, 2, 2, 1, 120),
  (4, 4, 4, 1, 250), (5, 5, 5, 1, 180), (6, 6, 6, 2, 95);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER,
  amount REAL,
  status TEXT,
  created_at TEXT
);
INSERT INTO payments VALUES
  (1, 1, 120, 'captured', '2026-08-01T10:00:00'),
  (2, 2, 80, 'captured', '2026-08-12T10:00:00'),
  (3, 4, 220, 'captured', '2026-08-03T10:00:00'),
  (4, 5, 95, 'pending', '2026-08-20T10:00:00');

CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER, bio TEXT);
INSERT INTO profiles VALUES (1, 1, 'QA lead'), (2, 2, 'Developer'), (3, 4, 'Analyst');

CREATE TABLE expected (id INTEGER, status TEXT, amount REAL);
INSERT INTO expected VALUES (1, 'paid', 120), (2, 'paid', 80), (3, 'pending', 50);
CREATE TABLE actual (id INTEGER, status TEXT, amount REAL);
INSERT INTO actual VALUES (1, 'paid', 120), (2, 'failed', 80), (4, 'paid', 25);

CREATE TABLE ledger (
  id INTEGER PRIMARY KEY,
  account_id INTEGER,
  occurred_at TEXT,
  amount REAL
);
INSERT INTO ledger VALUES
  (1, 10, '2026-08-01T08:00:00', 100),
  (2, 10, '2026-08-02T08:00:00', -20),
  (3, 10, '2026-08-03T08:00:00', 50),
  (4, 20, '2026-08-01T08:00:00', 200),
  (5, 20, '2026-08-05T08:00:00', -35);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  entity_id INTEGER,
  user_id INTEGER,
  sequence_no INTEGER,
  status TEXT,
  occurred_at TEXT
);
INSERT INTO events VALUES
  (1, 1, 1, 1, 'created', '2026-07-20T08:00:00'),
  (2, 1, 1, 2, 'running', '2026-08-02T08:00:00'),
  (3, 1, 1, 4, 'passed', '2026-08-03T08:00:00'),
  (4, 2, 2, 5, 'created', '2026-07-01T08:00:00'),
  (5, 2, 2, 6, 'failed', '2026-07-10T08:00:00'),
  (6, 3, 4, 8, 'created', '2026-08-18T08:00:00'),
  (7, 3, 4, 9, 'passed', '2026-08-19T08:00:00');

CREATE TABLE test_results (id INTEGER PRIMARY KEY, build_id INTEGER, status TEXT);
INSERT INTO test_results VALUES
  (1, 101, 'passed'), (2, 101, 'passed'), (3, 101, 'failed'),
  (4, 101, 'error'), (5, 102, 'passed'), (6, 102, 'failed');

CREATE TABLE parents (id INTEGER PRIMARY KEY, name TEXT);
INSERT INTO parents VALUES (1, 'A'), (2, 'B'), (3, 'C');
CREATE TABLE children (id INTEGER PRIMARY KEY, parent_id INTEGER, name TEXT);
INSERT INTO children VALUES (1, 1, 'A1'), (2, 1, 'A2'), (3, 2, 'B1');

CREATE TABLE sales (id INTEGER PRIMARY KEY, category_id INTEGER, amount REAL);
INSERT INTO sales VALUES
  (1, 1, 100), (2, 1, 150), (3, 1, 50),
  (4, 2, 300), (5, 2, 200), (6, 2, 100);
`;

const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input) {
  if (typeof input === "string") return new URL(input, self.location.href);
  if (input instanceof URL) return input;
  if (input && typeof input.url === "string") return new URL(input.url, self.location.href);
  throw new TypeError("Unsupported network request in the SQL runner.");
}

globalThis.fetch = (input, init = {}) => {
  let url;
  try {
    url = requestUrl(input);
  } catch (error) {
    return Promise.reject(error);
  }
  if (!url.href.startsWith(PYODIDE_INDEX_URL)) {
    return Promise.reject(new TypeError("Network access is disabled in the SQL runner."));
  }
  return nativeFetch(input, { ...init, credentials: "omit" });
};

function lockDownWorkerCapabilities() {
  const deny = () => {
    throw new Error("Browser and network APIs are disabled in the SQL runner.");
  };
  for (const name of ["fetch", "WebSocket", "WebTransport", "EventSource", "XMLHttpRequest", "Worker", "SharedWorker", "importScripts"]) {
    try {
      Object.defineProperty(globalThis, name, { configurable: false, value: deny, writable: false });
    } catch {
      // Some globals are non-configurable; the runner still never exposes them to user SQL.
    }
  }
}

const SQL_WRAPPER = String.raw`
import json
import re
import sqlite3

_MAX_ROWS = 200
_MAX_CELL_CHARS = 2000
_DEFAULT_PARAMS = {
    "n": 3,
    "cutoff": "2026-08-01T00:00:00",
    "last_created_at": "2026-08-20T10:00:00",
    "last_id": 7,
    "limit": 3,
    "status": "paid",
    "customer_id": 1,
    "order_id": 1,
    "id": 1,
    "email": "anna@example.com",
}
_BLOCKED = re.compile(r"\b(?:ATTACH|DETACH)\b|\bVACUUM\b|\bload_extension\s*\(", re.IGNORECASE)
_PARAM = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_]*)")


def _split_statements(source):
    statements = []
    buffer = []
    for char in source:
        buffer.append(char)
        if char == ";":
            candidate = "".join(buffer).strip()
            if sqlite3.complete_statement(candidate):
                if candidate:
                    statements.append(candidate)
                buffer = []
    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements


def _cell(value):
    if value is None or isinstance(value, (int, float, str)):
        if isinstance(value, str) and len(value) > _MAX_CELL_CHARS:
            return value[:_MAX_CELL_CHARS] + "…"
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        data = bytes(value)
        preview = data[:64].hex()
        suffix = "…" if len(data) > 64 else ""
        return f"0x{preview}{suffix}"
    text = str(value)
    return text[:_MAX_CELL_CHARS] + ("…" if len(text) > _MAX_CELL_CHARS else "")


if _BLOCKED.search(__query__):
    raise RuntimeError("ATTACH, DETACH, VACUUM and load_extension are disabled in the SQL runner.")

_statements = _split_statements(__query__)
if not _statements:
    raise RuntimeError("Enter a complete SQL statement before running.")

_conn = sqlite3.connect(":memory:")
try:
    _conn.executescript(__seed__)
    _baseline_changes = _conn.total_changes
    _columns = []
    _rows = []
    _truncated = False

    for _statement in _statements:
        _names = set(_PARAM.findall(_statement))
        _missing = sorted(name for name in _names if name not in _DEFAULT_PARAMS)
        if _missing:
            raise RuntimeError(
                "No sample value is configured for " + ", ".join(f":{name}" for name in _missing)
                + ". Replace the parameter with a literal and run again."
            )
        _bindings = {name: _DEFAULT_PARAMS[name] for name in _names}
        _cursor = _conn.execute(_statement, _bindings) if _bindings else _conn.execute(_statement)
        if _cursor.description:
            _columns = [item[0] for item in _cursor.description]
            _fetched = _cursor.fetchmany(_MAX_ROWS + 1)
            _truncated = len(_fetched) > _MAX_ROWS
            _rows = [[_cell(value) for value in row] for row in _fetched[:_MAX_ROWS]]
        else:
            _columns = []
            _rows = []
            _truncated = False

    _changes = _conn.total_changes - _baseline_changes
    _message = (
        f"{_changes} row{'s' if _changes != 1 else ''} changed."
        if _changes
        else "Query executed successfully."
    )
    __result_json__ = json.dumps({
        "columns": _columns,
        "rows": _rows,
        "changes": _changes,
        "statementCount": len(_statements),
        "truncated": _truncated,
        "message": _message,
    })
finally:
    _conn.close()
`;

const INSPECT_WRAPPER = String.raw`
import json
import sqlite3

_MAX_PREVIEW_ROWS = 50
_MAX_CELL_CHARS = 2000


def _cell(value):
    if value is None or isinstance(value, (int, float, str)):
        if isinstance(value, str) and len(value) > _MAX_CELL_CHARS:
            return value[:_MAX_CELL_CHARS] + "…"
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        data = bytes(value)
        preview = data[:64].hex()
        suffix = "…" if len(data) > 64 else ""
        return f"0x{preview}{suffix}"
    text = str(value)
    return text[:_MAX_CELL_CHARS] + ("…" if len(text) > _MAX_CELL_CHARS else "")


_conn = sqlite3.connect(":memory:")
try:
    _conn.executescript(__seed__)
    _tables = []
    _names = [row[0] for row in _conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )]

    for _name in _names:
        _safe_name = _name.replace('"', '""')
        _column_rows = _conn.execute(f'PRAGMA table_info("{_safe_name}")').fetchall()
        _columns = [
            {
                "name": row[1],
                "type": row[2] or "",
                "notNull": bool(row[3]),
                "primaryKey": bool(row[5]),
            }
            for row in _column_rows
        ]
        _row_count = _conn.execute(f'SELECT COUNT(*) FROM "{_safe_name}"').fetchone()[0]
        _fetched = _conn.execute(f'SELECT * FROM "{_safe_name}" LIMIT {_MAX_PREVIEW_ROWS + 1}').fetchall()
        _tables.append({
            "name": _name,
            "columns": _columns,
            "rows": [[_cell(value) for value in row] for row in _fetched[:_MAX_PREVIEW_ROWS]],
            "rowCount": _row_count,
            "truncated": len(_fetched) > _MAX_PREVIEW_ROWS,
        })

    __result_json__ = json.dumps({"tables": _tables})
finally:
    _conn.close()
`;

let pyodidePromise;

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import(`${PYODIDE_INDEX_URL}pyodide.mjs`);
      const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
      pyodide.setStdin({ error: true });
      lockDownWorkerCapabilities();
      return pyodide;
    })().catch((error) => {
      pyodidePromise = undefined;
      throw error;
    });
  }
  return pyodidePromise;
}

self.onmessage = async (event) => {
  const { id, code, action = "run" } = event.data ?? {};
  if (typeof id !== "number") return;
  if (action !== "run" && action !== "inspect") return;

  if (action === "run") {
    if (typeof code !== "string") return;
    if (!code.trim()) {
      self.postMessage({ id, type: "result", error: "Enter SQL before running." });
      return;
    }
    if (code.length > MAX_CODE_LENGTH) {
      self.postMessage({ id, type: "result", error: `SQL is limited to ${MAX_CODE_LENGTH} characters.` });
      return;
    }
  }

  let globals;
  try {
    const pyodide = await getPyodide();
    self.postMessage({ id, type: "running" });
    const createDict = pyodide.globals.get("dict");
    globals = createDict();
    createDict.destroy();
    globals.set("__seed__", SEED_SQL);

    if (action === "inspect") {
      await pyodide.runPythonAsync(INSPECT_WRAPPER, { globals });
    } else {
      globals.set("__query__", code);
      await pyodide.runPythonAsync(SQL_WRAPPER, { globals });
    }

    const raw = globals.get("__result_json__");
    if (raw == null) throw new Error("SQL runtime returned no result.");
    const result = JSON.parse(String(raw));
    self.postMessage({ id, type: "result", result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ id, type: "result", error: message.slice(0, 8_000) });
  } finally {
    globals?.destroy();
  }
};
