"""A simulated judge with known error rates and biases, for testing the evaluation methods themselves.

Chapter: LLM-as-a-judge
https://gimme-job.com/learn/llm?topic=model-graded-evaluation

A real judge is a model whose error rates are unknown until they are measured. To test that the
measurement and correction methods recover the truth, this judge knows the true verdict and makes
errors at configured rates. Decisions are seeded by the case ID, so every run is reproducible.
"""

import hashlib
import json
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class SimulatedJudge:
    tpr: float = 1.0               # chance of passing an answer that truly passes
    tnr: float = 1.0               # chance of failing an answer that truly fails
    position_bias: float = 0.0     # pairwise: chance of picking whichever answer is shown first
    verbosity_bias: float = 0.0    # chance of passing a failing answer if it is longer than 40 words
    seed: str = "judge"

    def _draw(self, *parts: str) -> float:
        digest = hashlib.sha256(json.dumps([self.seed, *parts]).encode()).hexdigest()
        return random.Random(digest).random()

    def judge(self, case_id: str, answer: str, truly_passes: bool) -> str:
        """Pointwise verdict as the raw JSON a model would return."""
        draw = self._draw("pointwise", case_id, answer)
        if truly_passes:
            verdict = "PASS" if draw < self.tpr else "FAIL"
        elif len(answer.split()) > 40 and self._draw("verbosity", case_id, answer) < self.verbosity_bias:
            verdict = "PASS"
        else:
            verdict = "FAIL" if draw < self.tnr else "PASS"
        return json.dumps({"critique": f"simulated critique for {case_id}", "verdict": verdict})

    def compare(self, case_id: str, first: str, second: str, better: str) -> str:
        """Pairwise: returns "first" or "second". `better` says which shown answer is truly better."""
        if self._draw("position", case_id, first, second) < self.position_bias:
            return "first"
        return better
