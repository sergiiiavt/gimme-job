import json
import math
import random
from pathlib import Path
from statistics import median

import pytest
from hypothesis import given
from hypothesis import strategies as st

from drift_monitoring import (control_limits, detection_probability, in_judge_sample, main, p_chart,
                              population_stability_index, psi_level)
from make_production_data import daily_checks

DAILY = Path(__file__).parent / "data" / "daily_checks.jsonl"
DAYS = [json.loads(line) for line in DAILY.read_text(encoding="utf-8").splitlines() if line.strip()]


def simulated_days(rng: random.Random, rates: list[float], judged: int = 200) -> list[dict]:
    return [{"day": day, "judged": judged, "passed": rng.binomialvariate(judged, rate)}
            for day, rate in enumerate(rates, 1)]


def reference_mix(days: list[dict]) -> dict[str, int]:
    mix: dict[str, int] = {}
    for day in days:
        for language, count in day["languages"].items():
            mix[language] = mix.get(language, 0) + count
    return mix


def test_the_data_file_is_reproducible():
    assert daily_checks() == DAYS


def test_the_incident_crosses_the_limit_and_the_slow_shift_is_caught_by_the_run_rule():
    center, statuses = p_chart(DAYS, baseline_days=10)
    alerts = {status.day: status.alert for status in statuses if status.alert}
    assert [day for day, alert in alerts.items() if "control limit" in alert] == [11, 12]
    assert [day for day, alert in alerts.items() if "in a row" in alert] == [22, 23, 24]
    # from day 15 every day is below the center line, and no single day is below the limit
    assert all(status.low < status.rate < center for status in statuses[14:])


def test_the_language_mix_shifts_from_day_15():
    reference = reference_mix(DAYS[:10])
    levels = [psi_level(population_stability_index(reference, day["languages"])) for day in DAYS]
    assert set(levels[:14]) == {"stable"}
    assert set(levels[14:]) == {"moderate shift"}


def test_three_standard_errors_rarely_alarm_on_a_stable_process_and_two_often_do():
    rates = [day["passed"] / day["judged"] for day in simulated_days(random.Random(1), [0.89] * 5000)]

    def alarm_rate(sigmas: float) -> float:
        low, high = control_limits(0.89, 200, sigmas)
        return sum(1 for rate in rates if not low <= rate <= high) / len(rates)

    assert alarm_rate(3) < 0.01
    assert 0.03 < alarm_rate(2) < 0.09


@pytest.mark.parametrize("drop", [0.02, 0.05, 0.08])
def test_the_detection_probability_matches_simulation(drop):
    rng = random.Random(2)
    low, _ = control_limits(0.89, 200)
    caught = sum(1 for _ in range(4000) if rng.binomialvariate(200, 0.89 - drop) / 200 < low) / 4000
    assert caught == pytest.approx(detection_probability(0.89, drop, 200), abs=0.04)


def first_alert(statuses, kind: str) -> float:
    return next((status.day for status in statuses if status.alert and kind in status.alert), math.inf)


def test_the_run_rule_finds_a_two_point_drop_sooner_and_raises_more_false_alarms():
    rng = random.Random(3)
    limit_only, with_run_rule = [], []
    for _ in range(500):
        _, statuses = p_chart(simulated_days(rng, [0.89] * 10 + [0.87] * 60), baseline_days=10)
        limit = first_alert(statuses[10:], "control limit") - 10
        limit_only.append(limit)
        with_run_rule.append(min(limit, first_alert(statuses[10:], "in a row") - 10))
    assert median(with_run_rule) < 0.75 * median(limit_only)

    false_limit = false_any = 0
    for _ in range(500):
        _, statuses = p_chart(simulated_days(rng, [0.89] * 40), baseline_days=10)
        limit = first_alert(statuses[10:], "control limit")
        false_limit += limit < math.inf
        false_any += min(limit, first_alert(statuses[10:], "in a row")) < math.inf
    assert false_any > 1.5 * false_limit  # use run rules on a few main metrics, not on every slice


def test_psi_by_hand_and_the_example_of_the_chapter():
    assert population_stability_index({"en": 70, "uk": 30}, {"en": 60, "uk": 40}) == pytest.approx(
        -0.1 * math.log(6 / 7) + 0.1 * math.log(4 / 3))
    chapter = population_stability_index({"en": 0.72, "uk": 0.25, "other": 0.03}, {"en": 0.55, "uk": 0.38, "other": 0.07})
    assert chapter == pytest.approx(0.13, abs=0.005) and psi_level(chapter) == "moderate shift"


MIXES = st.dictionaries(st.sampled_from(["en", "uk", "pl", "de", "other"]), st.integers(1, 10_000), min_size=1)


@given(MIXES, MIXES)
def test_psi_is_never_negative_and_symmetric(expected, actual):
    forward = population_stability_index(expected, actual)
    assert forward >= 0
    assert forward == pytest.approx(population_stability_index(actual, expected))


@given(MIXES, st.integers(2, 50))
def test_psi_depends_on_shares_not_on_volume(mix, factor):
    assert population_stability_index(mix, {key: count * factor for key, count in mix.items()}) == pytest.approx(0, abs=1e-12)


def test_a_language_that_was_never_seen_before_is_a_major_shift():
    index = population_stability_index({"en": 1000}, {"en": 900, "de": 100})
    assert math.isfinite(index) and psi_level(index) == "major shift"


def test_judge_sampling_is_stable_nested_and_redrawn_by_a_new_salt():
    ids = [f"conv-{number}" for number in range(20_000)]
    five = [conversation for conversation in ids if in_judge_sample(conversation, 0.05)]
    assert len(five) / len(ids) == pytest.approx(0.05, abs=0.006)
    assert five == [conversation for conversation in ids if in_judge_sample(conversation, 0.05)]
    # raising the rate keeps every conversation that was already sampled
    assert set(five) <= {conversation for conversation in ids if in_judge_sample(conversation, 0.10)}
    redrawn = {conversation for conversation in ids if in_judge_sample(conversation, 0.05, salt="judge-sample-2")}
    assert len(set(five) & redrawn) < 0.15 * len(five)


def test_the_command_line_reports_the_alerts(capsys):
    assert main(["drift_monitoring.py", str(DAILY)]) == 1
    lines = capsys.readouterr().out.splitlines()
    assert sum(1 for line in lines if "below the control limit" in line) == 2
    assert sum(1 for line in lines if "input mix: moderate shift" in line) == 10
