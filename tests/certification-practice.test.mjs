import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('certification offline exercises pass their independent oracles and reject unfinished work', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'examples/certification-practice', '-v'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});


test('agentic teaching examples retain budgets and distinguish tool failure from completion', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'examples/agentic-mcp-lab', '-v'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
