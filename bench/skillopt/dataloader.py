"""
Loads a bench/data/*.json dataset (the output of bench/make-dataset.mjs) as
SkillOpt items. Each item keeps the index the Node harness selects tasks by
and the dataset path it belongs to, so one episode is one `--tasks i-i` run.
"""
from __future__ import annotations

import json
from pathlib import Path

from skillopt.datasets.base import SplitDataLoader


def _items_from_dataset(path: Path) -> list[dict]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    # Ratio mode writes each split back as a JSON list of items already in
    # this shape and reads them through load_split_items; pass those through.
    if isinstance(doc, list):
        return doc
    items: list[dict] = []
    for i, t in enumerate(doc.get("tasks", [])):
        items.append({
            "id": str(t["id"]),
            "index": i,
            "dataset": str(path),
            "question": f"{t.get('title', '')}\n\n{t.get('text', '')}".strip(),
            "ground_truth": ", ".join(t.get("gold", [])),
            "gold": t.get("gold", []),
            "task_type": "refixed" if t.get("refixed") else "fix",
        })
    return items


class ComplexMdLoader(SplitDataLoader):
    """`split_mode: ratio` reads one dataset file and splits it; `split_dir`
    expects train/val/test directories each holding one such file."""

    def load_raw_items(self, data_path: str) -> list[dict]:
        return _items_from_dataset(Path(data_path))

    def load_split_items(self, split_path: str) -> list[dict]:
        files = sorted(Path(split_path).glob("*.json"))
        if not files:
            raise FileNotFoundError(f"no dataset .json in {split_path}")
        return _items_from_dataset(files[0])
