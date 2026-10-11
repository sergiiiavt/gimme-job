import math
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from classification import classification_report, load_pairs, main

HERE = Path(__file__).parent
TRIAGE = HERE / "data" / "triage_labels.jsonl"
LABELS = ["billing", "returns", "technical", "other"]
labelled_pairs = st.lists(st.tuples(st.sampled_from(LABELS), st.sampled_from(LABELS)), min_size=1, max_size=60)


def test_triage_report_matches_the_chapter():
    report = classification_report(load_pairs(TRIAGE))
    assert report.labels == tuple(LABELS)
    assert report.accuracy == 0.75
    assert (round(report.macro_f1, 2), round(report.weighted_f1, 2)) == (0.70, 0.77)
    technical = report.per_class["technical"]
    assert (technical.precision, technical.recall, technical.support) == (1.0, 0.6, 5)
    assert report.confusion[("technical", "other")] == 2, "technical tickets leak into other"


def test_command_line_report(capsys):
    assert main(["classification.py", str(TRIAGE)]) == 0
    lines = capsys.readouterr().out.splitlines()
    assert lines[0] == "human vs model    billing    returns  technical      other"
    assert lines[3] == "technical               0          0          3          2"
    assert lines[-1] == "accuracy=0.75  macro F1=0.70  weighted F1=0.77"


def test_an_invented_label_gets_its_own_column_and_lowers_macro_f1():
    pairs = [("billing", "billing"), ("returns", "returns"), ("returns", "refund_request")]
    report = classification_report(pairs, labels=["billing", "returns"])
    assert report.labels == ("billing", "returns", "refund_request")
    assert report.per_class["refund_request"].f1 == 0.0
    assert report.macro_f1 < report.weighted_f1


def test_listed_labels_that_never_occur_do_not_count_in_macro_f1():
    report = classification_report([("billing", "billing")], labels=LABELS)
    assert report.macro_f1 == 1.0


def test_an_empty_sample_is_an_error_not_a_perfect_score():
    with pytest.raises(ValueError):
        classification_report([])


@given(labelled_pairs)
def test_metrics_stay_in_range_and_counts_add_up(pairs):
    report = classification_report(pairs)
    assert sum(report.confusion.values()) == len(pairs)
    assert sum(metrics.support for metrics in report.per_class.values()) == len(pairs)
    values = [report.accuracy, report.macro_f1, report.weighted_f1]
    values += [value for m in report.per_class.values() for value in (m.precision, m.recall, m.f1)]
    assert all(0.0 <= value <= 1.0 for value in values)


@given(labelled_pairs)
def test_support_weighted_recall_equals_accuracy(pairs):
    report = classification_report(pairs)
    weighted_recall = sum(m.recall * m.support for m in report.per_class.values()) / len(pairs)
    assert math.isclose(weighted_recall, report.accuracy)


@given(labelled_pairs)
def test_swapping_human_and_model_swaps_precision_and_recall(pairs):
    report = classification_report(pairs)
    swapped = classification_report([(model, human) for human, model in pairs])
    for label in report.labels:
        assert swapped.per_class[label].precision == report.per_class[label].recall
        assert swapped.per_class[label].recall == report.per_class[label].precision


@given(st.lists(st.sampled_from(LABELS), min_size=1, max_size=40))
def test_perfect_predictions_score_one_everywhere(labels):
    report = classification_report([(label, label) for label in labels])
    assert report.accuracy == report.macro_f1 == report.weighted_f1 == 1.0
