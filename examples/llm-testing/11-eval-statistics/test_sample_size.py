import math
import random

import pytest

from paired_tests import mcnemar_exact
from sample_size import cases_for_margin, cases_to_detect, main, margin_for_cases, minimum_detectable_difference


def test_values_from_the_chapter():
    assert [cases_for_margin(m) for m in (0.10, 0.05, 0.03, 0.02)] == [97, 385, 1068, 2401]
    assert cases_for_margin(0.05, 0.9) == 139
    assert cases_to_detect(0.80, 0.83, discordant=0.10) == (2626, 870)


def test_margin_and_cases_are_inverse():
    assert margin_for_cases(385) == pytest.approx(0.05, abs=0.0005)


def test_pairing_needs_fewer_cases_when_versions_rarely_disagree():
    unpaired, paired = cases_to_detect(0.80, 0.85, discordant=0.10)
    assert paired < unpaired / 2


def test_a_difference_larger_than_the_disagreement_is_impossible():
    with pytest.raises(ValueError):
        cases_to_detect(0.80, 0.90, discordant=0.05)


def test_minimum_detectable_difference_inverts_the_sample_size_formula():
    _, paired = cases_to_detect(0.80, 0.83, discordant=0.10)
    assert minimum_detectable_difference(paired, 0.10) == pytest.approx(0.03, abs=0.0005)
    sizes = [100, 300, 1000, 3000]
    detectable = [minimum_detectable_difference(n, 0.10) for n in sizes]
    assert detectable == sorted(detectable, reverse=True)
    assert math.isinf(minimum_detectable_difference(20, 0.10)), "20 cases cannot detect any difference"


def test_the_planned_sample_really_has_about_80_percent_power():
    """Simulate paired experiments of the planned size where B is truly 5 points better."""
    _, n = cases_to_detect(0.80, 0.85, discordant=0.10)
    rng = random.Random(9)
    detected = 0
    experiments = 400
    for _ in range(experiments):
        only_a = only_b = 0
        for _ in range(n):
            draw = rng.random()
            only_b += draw < 0.075            # (discordant + difference) / 2
            only_a += 0.075 <= draw < 0.100   # (discordant - difference) / 2
        detected += mcnemar_exact(only_a, only_b) <= 0.05
    assert 0.70 <= detected / experiments <= 0.90


def test_command_line(capsys):
    assert main(["sample_size.py", "50", "1000"]) == 0
    lines = capsys.readouterr().out.splitlines()
    assert lines[1].split()[-1] == "none"
    assert lines[2].split() == ["1000", "3.1%", "1.9%", "2.8%"]
