from __future__ import annotations

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


if __name__ == "__main__":
    unittest.main()
