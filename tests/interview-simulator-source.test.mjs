import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InterviewSimulator from "../app/interview/simulator/interview-simulator.tsx";

test("interview simulator source renders its initial workspace", () => {
  const html = renderToStaticMarkup(React.createElement(InterviewSimulator));

  assert.match(html, /Interview simulator/);
  assert.match(html, /Configure interview/);
  assert.match(html, /Start \d+-question interview/);
  assert.match(html, /Areas to practice/);
});
