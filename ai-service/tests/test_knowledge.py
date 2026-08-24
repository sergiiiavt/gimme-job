from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from gimmejob_ai.knowledge import search_content


class KnowledgeSearchTests(unittest.TestCase):
    def test_search_prefers_matching_title_and_filters_language(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            (root / "sql.md").write_text(
                "# SQL joins\nINNER JOIN combines matching rows.\n",
                encoding="utf-8",
            )
            (root / "sql.uk.md").write_text(
                "# SQL об'єднання\nINNER JOIN поєднує рядки.\n",
                encoding="utf-8",
            )
            (root / "python.md").write_text(
                "# Python\nLists and dictionaries.\n",
                encoding="utf-8",
            )

            english = search_content("SQL joins", root, language="en")
            ukrainian = search_content("INNER JOIN", root, language="uk")

            self.assertEqual(english[0].path, "sql.md")
            self.assertNotIn("sql.uk.md", [hit.path for hit in english])
            self.assertEqual(ukrainian[0].path, "sql.uk.md")

    def test_search_bounds_result_count(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            for index in range(12):
                (root / f"item-{index}.md").write_text(
                    f"# Testing {index}\nTesting material.\n",
                    encoding="utf-8",
                )

            results = search_content("testing", root, language="en", limit=100)

            self.assertEqual(len(results), 8)

    def test_search_chunks_json_records_and_diversifies_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            large = {
                "lessons": [
                    {
                        "id": f"concurrency-{index}",
                        "title": f"Concurrency lesson {index}",
                        "summary": "Python concurrency with threads and processes.",
                    }
                    for index in range(6)
                ]
            }
            small = {
                "cards": [
                    {
                        "id": "parallelism-card",
                        "title": "Python concurrency and parallelism",
                        "detail": "Use processes for CPU-bound parallel work.\nKeep concurrent tasks substantial.",
                    }
                ]
            }
            (root / "large.json").write_text(json.dumps(large), encoding="utf-8")
            (root / "small.json").write_text(json.dumps(small), encoding="utf-8")

            results = search_content("Python concurrency", root, limit=4)

            self.assertTrue(any(hit.path == "small.json#parallelism-card" for hit in results))
            self.assertLessEqual(sum(hit.path.startswith("large.json#") for hit in results), 2)
            self.assertTrue(all("\n" not in hit.excerpt for hit in results))

    def test_python_parallelism_finds_real_git_json_material(self) -> None:
        repository_content = Path(__file__).resolve().parents[2] / "content"

        results = search_content("Python parallelism", repository_content, limit=8)

        paths = [hit.path for hit in results]
        self.assertTrue(
            any(
                path.startswith("python-learning/advanced-lessons.json#")
                or path.startswith("python-learning/quick-reference")
                or path.startswith("python-interview/concurrency-qa.json#")
                for path in paths
            ),
            paths,
        )
        self.assertTrue(all("#" in path for path in paths))

    def test_out_of_domain_queries_do_not_claim_repository_grounding(self) -> None:
        repository_content = Path(__file__).resolve().parents[2] / "content"

        for query in (
            "Teach me quantum banana",
            "Explain underwater basket weaving",
            "How do I become a carpenter",
        ):
            with self.subTest(query=query):
                self.assertEqual(search_content(query, repository_content, limit=8), [])

    def test_multi_concept_query_supplements_each_relevant_concept(self) -> None:
        repository_content = Path(__file__).resolve().parents[2] / "content"

        results = search_content(
            "Help me learn asyncio for test automation",
            repository_content,
            limit=8,
        )

        self.assertTrue(results)
        self.assertTrue(
            any(
                "asyncio" in f"{hit.title} {hit.excerpt} {hit.path}".casefold()
                for hit in results
            ),
            [hit.path for hit in results],
        )


if __name__ == "__main__":
    unittest.main()
