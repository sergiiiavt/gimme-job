"""Offline exercise checker. No API key, model, network or production writes.

Run: python examples/certification-practice/practice.py all
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
import sys

TRACKS = ('ctfl', 'genai', 'claude-101', 'claude-code', 'platform', 'architect', 'developer', 'copilot')
FIXTURES = Path(__file__).with_name('fixtures.json')


def boundary_values(lower, upper, variant):
    """Both shared partition borders; the domain is all integers."""
    if lower > upper or variant not in (2, 3):
        raise ValueError('Expected lower <= upper and variant 2 or 3')
    boundaries = {lower - 1, lower, upper, upper + 1}
    return sorted(boundaries if variant == 2 else
                  {value + offset for value in boundaries for offset in (-1, 0, 1)})


def discount_percent(member, subtotal):
    if subtotal < 0:
        raise ValueError('Subtotal cannot be negative')
    return (20 if member else 5) if subtotal >= 100 else (10 if member else 0)


def transition(state, event):
    transitions = {('draft', 'submit'): 'submitted', ('submitted', 'approve'): 'approved',
                   ('submitted', 'reject'): 'draft', ('approved', 'archive'): 'archived'}
    if (state, event) not in transitions:
        raise ValueError('Invalid transition')
    return transitions[state, event]


def detection_metrics(expected, predicted):
    truth, guesses = set(expected), set(predicted)
    tp, fp, fn = len(truth & guesses), len(guesses - truth), len(truth - guesses)
    return {'tp': tp, 'fp': fp, 'fn': fn,
            'precision': round(tp / len(guesses), 3) if guesses else None,
            'recall': round(tp / len(truth), 3) if truth else None}


def check_extraction(record):
    errors = []
    if set(record) != {'title', 'salary_min', 'salary_max', 'remote'}:
        errors.append('fields')
    if not isinstance(record.get('title'), str) or not record['title'].strip():
        errors.append('title')
    for field in ('salary_min', 'salary_max'):
        value = record.get(field)
        if value is not None and (type(value) is not int or value < 0):
            errors.append(field)
    if record.get('remote') not in ('yes', 'no', 'hybrid', 'unclear'):
        errors.append('remote')
    low, high = record.get('salary_min'), record.get('salary_max')
    if (low is None) != (high is None):
        errors.append('salary_pair')
    if type(low) is int and type(high) is int and low > high:
        errors.append('salary_order')
    return errors


def grounded_claims(facts, claims):
    """Check source values as well as source existence in this synthetic oracle."""
    return [claim['id'] for claim in claims
            if claim.get('source') not in facts or claim.get('value') != facts[claim['source']]]


def action_gate(tool, arguments, approval):
    """Simulation: approval is supplied by a trusted decision store, never model output.

    Real implementations also authenticate actors, authorize tenants and persist approvals.
    """
    if tool == 'read_job':
        return 'read_only'
    if tool != 'send_application':
        return 'denied'
    if set(arguments) != {'tenant', 'job_id', 'candidate_id'} or not all(
            isinstance(value, str) and value for value in arguments.values()):
        return 'invalid_arguments'
    expected = {'tool': tool, 'arguments': arguments, 'approved': True}
    return 'approved' if (isinstance(approval, dict) and approval.get('approved') is True
                          and approval == expected) else 'needs_approval'


def retry_allowed(status, attempt, retry_budget, safe_to_replay):
    return safe_to_replay and attempt < retry_budget and status in (429, 502, 503, 504, 529)


def trace_outcome(events, max_steps):
    evidence = []
    for event in events:
        if len(evidence) >= max_steps:
            return {'status': 'budget', 'evidence': evidence}
        evidence.append(event['id'])
        if event.get('is_error'):
            return {'status': 'error', 'evidence': evidence}
        if event.get('done'):
            return {'status': 'done', 'evidence': evidence}
    return {'status': 'incomplete', 'evidence': evidence}


def check_candidate(candidate, track):
    results = []
    for case in json.loads(FIXTURES.read_text())['checks']:
        if track != 'all' and track not in case['tracks']:
            continue
        try:
            actual = getattr(candidate, case['function'])(*case['arguments'])
            passed = 'raises' not in case and actual == case['expected']
        except Exception as error:
            passed = type(error).__name__ == case.get('raises')
            actual = {'exception': type(error).__name__, 'message': str(error)}
        results.append({'case': case['id'], 'passed': passed, 'actual': actual})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('track', choices=('all', *TRACKS))
    parser.add_argument('--candidate', type=Path)
    args = parser.parse_args()
    candidate = sys.modules[__name__]
    if args.candidate:
        spec = importlib.util.spec_from_file_location('student_solution', args.candidate.resolve())
        if spec is None or spec.loader is None:
            parser.error('Cannot load candidate Python file')
        candidate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(candidate)
    results = check_candidate(candidate, args.track)
    print(json.dumps({'track': args.track, 'passed': sum(item['passed'] for item in results),
                      'total': len(results), 'results': results}, indent=2))
    return 0 if all(item['passed'] for item in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
