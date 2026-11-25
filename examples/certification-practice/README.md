# Certification practice: runnable offline exercises

Requires Python 3.10+; standard library only. All data is synthetic. These original
exercises are not official exam questions and do not predict a certification score.

```sh
python examples/certification-practice/practice.py all
python examples/certification-practice/practice.py ctfl --candidate examples/certification-practice/starter.py
python -m unittest discover -s examples/certification-practice -v
```

The reference passes every fixed case. The unfinished starter intentionally exits 1.
Copy the starter to a new scratch file and implement only the functions for your track.
`--candidate` executes your local Python file, so use a file you control.

| Track argument | Exercise | Evidence to retain |
| --- | --- | --- |
| `ctfl` | Integer partitions, both borders, discount rules, valid/invalid transitions | Coverage table, expected values and test results |
| `genai` | Distinct defect-ID metrics, source support and extraction | TP/FP/FN table; unsupported claim IDs |
| `claude-101` | Facts F1–F3; unknown salary stays unknown | A release note citing only supported facts |
| `claude-code` | Implement a small function; inspect hook behavior and failed traces | Minimal diff, oracle results and hook stderr/exit codes |
| `platform` | Tool-result schema, simulated approval boundary, stop reasons | Shape versus semantic validation; trace evidence |
| `architect` | Allowed actions, exact trusted approval, failed-worker handoff | Tenant mismatch denial and preserved partial evidence |
| `developer` | Replay-safe retries, exhausted budget, invalid output | Error matrix, idempotency assumptions and fixture report |
| `copilot` | Review the discount rules and check generated claims | Independent expected outputs before AI-generated code |

For boundary analysis, the input domain is **all integers**, valid interval inclusive.
The 3-value criterion covers each partition boundary plus both neighbours. For 1–100,
this gives `-1,0,1,2,99,100,101,102`; do not silently omit the invalid-partition borders.
Metrics use sets, round to 3 decimals and return null for an undefined denominator.
Salary bounds are both null or both nonnegative integers, low <= high; booleans are not integers.

Approvals in this simulation are trusted decisions bound to exact arguments, not model
text. A real service must authenticate the actor, authorize the tenant, persist and expire
approvals, and deduplicate writes. The retry function is a **policy decision**, not an
HTTP client: implement Retry-After, bounded exponential backoff/jitter, deadlines and
idempotency separately. Do not replay a non-idempotent write after an uncertain timeout.

The sample Claude Code hook reads JSON on stdin, writes rejection to stderr and exits 2;
allowed events exit 0. Test it with Write/Edit events for `.env.training` and `answer.py`.
It does not sandbox Bash, symlinks, other extensions or a remote backend. The settings
file is an example, not automatically installed into this repository.

Judge your work by explanation as well as a green run: can you derive the oracle,
explain a plausible wrong output, demonstrate its rejection and state what remains
unverified? Optional model-assisted practice needs an authorized tool/account and its
own usage budget. No paid calls or production changes are part of the baseline.
