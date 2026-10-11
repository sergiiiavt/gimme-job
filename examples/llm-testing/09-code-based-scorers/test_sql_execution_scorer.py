import json
import sqlite3
from pathlib import Path

import pytest

from sql_scorer import BASE_ORDERS, fixture_database, main, run_query, score_sql

HERE = Path(__file__).parent
SQL_CASES_PATH = HERE / "data" / "sql_cases.jsonl"
SQL_CASES = [json.loads(line) for line in SQL_CASES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
BY_ID = {case["id"]: case for case in SQL_CASES}


@pytest.mark.parametrize("case", SQL_CASES, ids=[case["id"] for case in SQL_CASES])
def test_generated_queries_are_judged_by_their_rows(case):
    score = score_sql(case["generated"], case["reference"])
    assert score.passed is (case["verdict"] == "pass"), f"{case['why']} -> {score.reason}"


def test_different_query_text_with_the_same_rows_passes():
    assert BY_ID["s1"]["generated"] != BY_ID["s1"]["reference"]
    assert score_sql(BY_ID["s3"]["generated"], BY_ID["s3"]["reference"]).passed


def test_one_database_accepts_queries_that_are_right_only_by_coincidence():
    for case_id in ("s4", "s5"):
        case = BY_ID[case_id]
        assert score_sql(case["generated"], case["reference"], fixtures={"base": BASE_ORDERS}).passed
        score = score_sql(case["generated"], case["reference"])
        assert not score.passed and score.reason.startswith("boundary database")


@pytest.mark.parametrize("statement", [
    "DELETE FROM orders",
    "UPDATE orders SET total = 0",
    "INSERT INTO orders VALUES ('A-9999', 'eve', 'pending', 1.0, '2026-10-01')",
    "DROP TABLE orders",
    "CREATE TABLE notes (text TEXT)",
    "PRAGMA writable_schema = ON",
    "ATTACH DATABASE 'stolen.db' AS stolen",
])
def test_writes_are_refused_and_leave_the_data_unchanged(statement):
    connection = fixture_database(BASE_ORDERS)
    with pytest.raises(sqlite3.DatabaseError, match="not authorized"):
        run_query(connection, statement)
    [(count, total)] = run_query(connection, "SELECT COUNT(*), SUM(total) FROM orders")
    assert count == 6 and total == pytest.approx(570.4)


def test_only_one_statement_runs_per_call():
    connection = fixture_database(BASE_ORDERS)
    with pytest.raises(sqlite3.ProgrammingError):
        run_query(connection, "SELECT 1; DROP TABLE orders")
    assert run_query(connection, "SELECT COUNT(*) FROM orders") == [(6,)]


def test_runaway_queries_are_interrupted_and_the_budget_resets():
    connection = fixture_database(BASE_ORDERS)
    with pytest.raises(sqlite3.OperationalError, match="interrupted"):
        run_query(connection, "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n) SELECT COUNT(*) FROM n")
    assert run_query(connection, "SELECT COUNT(*) FROM orders") == [(6,)]


def test_row_order_matters_only_when_the_reference_sorts():
    reference = "SELECT customer FROM orders WHERE status = 'delivered'"
    assert score_sql(reference + " ORDER BY customer DESC", reference).passed
    assert not score_sql(reference + " ORDER BY customer DESC", reference + " ORDER BY customer").passed


def test_floats_are_compared_after_rounding():
    assert score_sql("SELECT 0.1 + 0.2", "SELECT 0.3").passed


def test_command_line_report(capsys):
    assert main(["sql_scorer.py", str(SQL_CASES_PATH)]) == 0
    out = capsys.readouterr().out
    assert "s7 FAIL base database: DatabaseError: not authorized" in out
    assert "s9 FAIL base database: OperationalError: interrupted" in out
    assert out.rstrip().endswith("execution accuracy: 2/10")
