"""Execution-based scoring of generated SQL: compare result sets, not query text.

Chapter: Code-based scorers and metrics (execution-based scoring)
https://gimme-job.com/learn/llm?topic=code-based-scorers

Every query runs on fixture databases with three safeguards:
- an authorizer that allows reading only, so a generated UPDATE, DELETE, DROP or PRAGMA is refused;
- a step budget that interrupts runaway queries such as an accidental cross join;
- one statement per call, so "SELECT ...; DROP TABLE ..." is refused as a whole.
A wrong query can return the right rows by coincidence on one database. Running it on several
databases, including one with boundary rows, catches that (the idea behind test-suite accuracy).

Usage:
    python sql_scorer.py data/sql_cases.jsonl
Each JSONL line holds {"id": ..., "question": ..., "reference": <SQL>, "generated": <SQL>, ...}.
"""

import json
import sqlite3
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

SCHEMA = """
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    customer TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    total REAL NOT NULL,
    created TEXT NOT NULL
);
"""

BASE_ORDERS = [
    ("A-1001", "olena", "delivered", 120.0, "2026-09-01"),
    ("A-1002", "taras", "processing", 45.5, "2026-09-03"),
    ("A-1003", "olena", "shipped", 80.0, "2026-09-05"),
    ("A-1004", "maria", "delivered", 210.0, "2026-09-07"),
    ("A-1005", "ivan", "pending", 15.0, "2026-09-09"),
    ("A-1006", "maria", "processing", 99.9, "2026-09-10"),
]
# Rows that tell apart queries the base data cannot: a total of exactly 100 and a cancelled order.
BOUNDARY_ORDERS = [
    *BASE_ORDERS,
    ("A-1007", "petro", "delivered", 100.0, "2026-09-11"),
    ("A-1008", "sofia", "cancelled", 300.0, "2026-09-12"),
]
FIXTURES = {"base": BASE_ORDERS, "boundary": BOUNDARY_ORDERS}

READ_ONLY_ACTIONS = frozenset({sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE})
STEP_BUDGET = 1_000        # progress-handler calls allowed per query
INSTRUCTIONS_PER_STEP = 1_000  # SQLite virtual-machine instructions between two calls


@dataclass(frozen=True)
class SqlScore:
    passed: bool
    reason: str


def _read_only(action: int, *_details) -> int:
    """SQLite authorizer callback; the details (table, column, database, trigger) are not needed here."""
    return sqlite3.SQLITE_OK if action in READ_ONLY_ACTIONS else sqlite3.SQLITE_DENY


def fixture_database(rows) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.executescript(SCHEMA)
    connection.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?)", rows)
    connection.commit()
    connection.set_authorizer(_read_only)  # installed after the setup, which needs to write
    return connection


def run_query(connection: sqlite3.Connection, sql: str, step_budget: int = STEP_BUDGET) -> list[tuple]:
    steps = 0

    def over_budget() -> bool:
        nonlocal steps
        steps += 1
        return steps > step_budget  # a true value interrupts the query

    connection.set_progress_handler(over_budget, INSTRUCTIONS_PER_STEP)
    try:
        return connection.execute(sql).fetchall()
    finally:
        connection.set_progress_handler(None, 0)


def _normalized(rows: list[tuple]) -> list[tuple]:
    return [tuple(round(value, 6) if isinstance(value, float) else value for value in row) for row in rows]


def _is_ordered(sql: str) -> bool:
    return " order by " in f" {' '.join(sql.lower().split())} "


def score_sql(generated: str, reference: str, fixtures: dict = FIXTURES) -> SqlScore:
    """Pass when the generated query returns the reference rows on every fixture database.
    Row order matters only when the reference query sorts."""
    for name, rows in fixtures.items():
        connection = fixture_database(rows)
        try:
            expected = _normalized(run_query(connection, reference))
            try:
                actual = _normalized(run_query(connection, generated))
            except sqlite3.Error as error:
                return SqlScore(False, f"{name} database: {type(error).__name__}: {error}")
        finally:
            connection.close()
        same = actual == expected if _is_ordered(reference) else Counter(actual) == Counter(expected)
        if not same:
            return SqlScore(False, f"{name} database: expected {expected[:4]}, got {actual[:4]}")
    return SqlScore(True, f"same rows on {len(fixtures)} databases")


def main(argv: list[str]) -> int:
    cases = [json.loads(line) for line in Path(argv[1]).read_text(encoding="utf-8").splitlines() if line.strip()]
    passed = 0
    for case in cases:
        score = score_sql(case["generated"], case["reference"])
        passed += score.passed
        print(f"{case['id']} {'PASS' if score.passed else 'FAIL'} {score.reason}")
    print(f"execution accuracy: {passed}/{len(cases)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
