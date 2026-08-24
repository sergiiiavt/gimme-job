from __future__ import annotations

import unittest

from gimmejob_ai.rag_metrics import evaluate_retrieval


class RagMetricsTests(unittest.TestCase):
    def test_perfect_ranking_scores_one(self) -> None:
        metrics = evaluate_retrieval(["a", "b"], ["a", "b", "c"], 2)
        self.assertEqual(metrics.precision_at_k, 1.0)
        self.assertEqual(metrics.recall_at_k, 1.0)
        self.assertEqual(metrics.hit_rate_at_k, 1.0)
        self.assertEqual(metrics.reciprocal_rank, 1.0)
        self.assertEqual(metrics.ndcg_at_k, 1.0)

    def test_late_relevant_result_reduces_rank_metrics(self) -> None:
        metrics = evaluate_retrieval(["target"], ["noise-1", "target", "noise-2"], 3)
        self.assertAlmostEqual(metrics.precision_at_k, 1 / 3)
        self.assertEqual(metrics.recall_at_k, 1.0)
        self.assertEqual(metrics.hit_rate_at_k, 1.0)
        self.assertEqual(metrics.reciprocal_rank, 0.5)
        self.assertGreater(metrics.ndcg_at_k, 0.0)
        self.assertLess(metrics.ndcg_at_k, 1.0)

    def test_missing_relevant_results_score_zero(self) -> None:
        metrics = evaluate_retrieval(["target"], ["noise"], 1)
        self.assertEqual(metrics.precision_at_k, 0.0)
        self.assertEqual(metrics.recall_at_k, 0.0)
        self.assertEqual(metrics.hit_rate_at_k, 0.0)
        self.assertEqual(metrics.reciprocal_rank, 0.0)
        self.assertEqual(metrics.ndcg_at_k, 0.0)

    def test_empty_expected_set_is_not_treated_as_failure(self) -> None:
        metrics = evaluate_retrieval([], ["anything"], 1)
        self.assertEqual(metrics.recall_at_k, 1.0)
        self.assertEqual(metrics.hit_rate_at_k, 1.0)
        self.assertEqual(metrics.reciprocal_rank, 1.0)
        self.assertEqual(metrics.ndcg_at_k, 1.0)

    def test_invalid_k_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            evaluate_retrieval(["a"], ["a"], 0)


if __name__ == "__main__":
    unittest.main()
