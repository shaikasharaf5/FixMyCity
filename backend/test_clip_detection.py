"""CLIP decision/region regression tests; no downloads or live data changes."""
import unittest
import torch
from app.ai.detector import ISSUE_PROMPTS, HEALTHY_PROMPTS, region_proposals, select_issue


class ClipDetectionTests(unittest.TestCase):
    def scores(self):
        return torch.full((3, len(ISSUE_PROMPTS) + len(HEALTHY_PROMPTS)), .15)

    def test_garbage_and_pole_have_distinct_categories(self):
        for name in ("Garbage", "Electric Pole Damage"):
            with self.subTest(category=name):
                scores = self.scores()
                index = list(ISSUE_PROMPTS).index(name)
                scores[0, index] = .34
                scores[1, index] = .38
                selected, _, crop = select_issue(scores)
                self.assertEqual(selected, index)
                self.assertEqual(crop, 1)

    def test_healthy_scene_rejects_damage(self):
        scores = self.scores()
        scores[0, 5] = .30
        scores[0, len(ISSUE_PROMPTS) + 1] = .36
        self.assertIsNone(select_issue(scores)[0])

    def test_ambiguous_and_weak_matches_are_rejected(self):
        scores = self.scores()
        self.assertIsNone(select_issue(scores)[0])
        scores[0, 0:2] = torch.tensor([.34, .335])
        self.assertIsNone(select_issue(scores)[0])

    def test_no_box_if_crops_do_not_support_classification(self):
        scores = self.scores()
        scores[0, 0] = .36
        index, _, crop = select_issue(scores)
        self.assertEqual(index, 0)
        self.assertIsNone(crop)

    def test_regions_fit_portrait_landscape_and_tiny_images(self):
        for width, height in [(624, 633), (1200, 300), (200, 1200), (1, 1)]:
            boxes = region_proposals(width, height)
            self.assertEqual(len(boxes), len(set(boxes)))
            for x1, y1, x2, y2 in boxes:
                self.assertTrue(0 <= x1 < x2 <= width)
                self.assertTrue(0 <= y1 < y2 <= height)


if __name__ == '__main__':
    unittest.main()
