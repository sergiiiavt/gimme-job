"""PreToolUse teaching hook: only the matched Write/Edit tool calls are covered."""
import json
from pathlib import Path
import sys
try:
    event = json.load(sys.stdin)
    if not isinstance(event, dict) or not isinstance(event.get('tool_input'), dict):
        raise ValueError('Expected hook event and tool_input objects')
    path = event['tool_input'].get('file_path', '')
    if event.get('tool_name') in ('Write', 'Edit') and Path(path).name == '.env.training':
        raise ValueError('Training policy blocks writes to .env.training')
except (ValueError, TypeError) as error:
    print(str(error), file=sys.stderr)
    raise SystemExit(2)
