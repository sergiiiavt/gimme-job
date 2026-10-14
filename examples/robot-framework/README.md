# Robot Framework: offline reference project

A runnable, deliberately small automation framework: suite -> reusable domain resource -> typed Python library. No browser, server, live API, credentials or network needed after dependency installation.

## Run

```bash
python -m venv .venv
source .venv/bin/activate      # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r examples/robot-framework/requirements.txt
python -m robot --outputdir results examples/robot-framework/tests
```

The expected outcome is **4 passed tests** (two inventory flows plus two template cases). Open `results/log.html` and `results/report.html`, and retain `results/output.xml` for further processing. Run in a different order to inspect isolation. For a negative demonstration, change an expected remaining stock and confirm the run exits nonzero.

```bash
python -m robot --test "Rejects Reservation Beyond Stock" --outputdir results examples/robot-framework/tests/inventory.robot
python -m rebot --outputdir merged results/output.xml
```

`Inventory` uses Robot's `TEST` library scope and explicit reset/cleanup so cases do not depend on execution order. Keep domain assertions visible in tests/resource keywords and typed storage/validation in Python. This is a training reference, not a service-level inventory implementation.
