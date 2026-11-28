import assert from 'node:assert/strict';
import test from 'node:test';
import { findPython, runPython } from './helpers/python-interpreter.mjs';

const python = findPython();

test('certification offline exercises pass their independent oracles and reject unfinished work', { skip: python.skip }, () => {
  const result = runPython(python, ['-m', 'unittest', 'discover', '-s', 'examples/certification-practice', '-v'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});


test('agentic teaching examples retain budgets and distinguish tool failure from completion', { skip: python.skip }, () => {
  const result = runPython(python, ['-m', 'unittest', 'discover', '-s', 'examples/agentic-mcp-lab', '-v'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
