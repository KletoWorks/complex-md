"""
SkillOpt environment for complex-md.

The trainable text is the integration block: the few paragraphs an agent
reads that tell it how to use COMPLEX.md. Each episode is one task from a
danger-selected dataset (a real fix that touched a file the map calls
risky), run to completion by Claude Code with the candidate block wired in,
then judged by bench/run.mjs: did the fix's own tests pass, and did any test
that passed at the base commit fail after the patch.

    hard = 1  when the gold tests pass and nothing else regressed
    soft      credits a passing fix and penalises each regressed test

Rollouts shell out to the Node harness so the judgement is the one the
published benchmark uses; nothing is re-implemented here.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from skillopt.datasets.base import BatchSpec
from skillopt.envs.base import EnvAdapter

from .dataloader import ComplexMdLoader

HERE = Path(__file__).resolve().parent          # bench/skillopt, through any symlink
ROOT = HERE.parent.parent                       # the complex-md checkout
RUN = ROOT / "bench" / "run.mjs"


class ComplexMdEnv(EnvAdapter):
    def __init__(
        self,
        split_dir: str = "",
        data_path: str = "",
        split_mode: str = "ratio",
        split_ratio: str = "10:4:1",
        split_seed: int = 42,
        split_output_dir: str = "",
        workers: int = 2,
        analyst_workers: int = 4,
        failure_only: bool = False,
        minibatch_size: int = 8,
        edit_budget: int = 4,
        seed: int = 42,
        limit: int = 0,
        max_completion_tokens: int = 4096,
        budget_usd: float = 5.0,
        timeout_s: int = 900,
        cache_dir: str = "",
        work_dir: str = "/tmp/cxskill",
        agent: str = "claude",          # "mock" exercises the plumbing without a model
    ) -> None:
        self.workers = workers
        self.analyst_workers = analyst_workers
        self.failure_only = failure_only
        self.minibatch_size = minibatch_size
        self.edit_budget = edit_budget
        self.max_completion_tokens = int(max_completion_tokens)
        self.budget_usd = float(budget_usd)
        self.timeout_s = int(timeout_s)
        self.cache_dir = cache_dir or str(ROOT / "bench" / "results" / "skillopt-cache")
        self.work_dir = work_dir
        self.agent = agent
        self.data_path = str((ROOT / data_path) if data_path and not os.path.isabs(data_path) else data_path)
        self.dataloader = ComplexMdLoader(
            split_dir=split_dir,
            data_path=self.data_path,
            split_mode=split_mode,
            split_ratio=split_ratio,
            split_seed=split_seed,
            split_output_dir=split_output_dir,
            seed=seed,
            limit=limit,
        )

    # ── lifecycle ─────────────────────────────────────────────────────

    def setup(self, cfg: dict) -> None:
        super().setup(cfg)
        self.dataloader.setup(cfg)

    def get_dataloader(self):
        return self.dataloader

    # ── batches ───────────────────────────────────────────────────────

    def build_env_from_batch(self, batch: BatchSpec, **kwargs):
        return list(batch.payload or [])

    def build_train_env(self, batch_size: int, seed: int, **kwargs):
        return self.build_env_from_batch(self.dataloader.build_train_batch(batch_size=batch_size, seed=seed, **kwargs))

    def build_eval_env(self, env_num: int, split: str, seed: int, **kwargs):
        return self.build_env_from_batch(self.dataloader.build_eval_batch(env_num=env_num, split=split, seed=seed, **kwargs))

    # ── rollout ───────────────────────────────────────────────────────

    def rollout(self, env_manager, skill_content: str, out_dir: str, **kwargs) -> list[dict]:
        items: list[dict] = env_manager
        out = Path(out_dir)
        out.mkdir(parents=True, exist_ok=True)
        skill_path = out / "skill.md"
        skill_path.write_text(skill_content, encoding="utf-8")
        skill_id = hashlib.sha1(skill_content.encode("utf-8")).hexdigest()[:10]
        with ThreadPoolExecutor(max_workers=max(1, self.workers)) as pool:
            return list(pool.map(lambda item: self._episode(item, skill_path, skill_id, out), items))

    def _episode(self, item: dict, skill_path: Path, skill_id: str, out: Path) -> dict:
        tid = str(item["id"])
        run_dir = out / "runs" / tid
        cmd = [
            "node", str(RUN),
            "--dataset", item["dataset"],
            "--arms", "file",
            "--agent", self.agent,
            "--tasks", f"{item['index']}-{item['index']}",
            "--stop-at", "none",
            "--budget", str(self.budget_usd),
            "--timeout", str(self.timeout_s),
            "--skill", str(skill_path),
            "--out", str(run_dir),
            "--cache", self.cache_dir,
            "--work", os.path.join(self.work_dir, f"{skill_id}-{tid}"),
        ]
        proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True)
        row = self._last_row(run_dir / "runs.jsonl")
        if row is None:
            return self._result(item, None, f"harness failed: {(proc.stderr or proc.stdout)[-400:]}")
        self._persist_conversation(run_dir / "transcripts" / f"{tid}-file.jsonl", out / "predictions" / tid)
        return self._result(item, row, None)

    @staticmethod
    def _last_row(path: Path) -> dict | None:
        if not path.exists():
            return None
        lines = [l for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
        return json.loads(lines[-1]) if lines else None

    def _result(self, item: dict, row: dict | None, fail: str | None) -> dict:
        if row is None:
            return {"id": item["id"], "hard": 0, "soft": 0.0, "question": item["question"], "predicted_answer": "", "fail_reason": fail}
        success = row.get("success") is True
        regressed = row.get("regressed_tests")
        regressed_n = int(regressed) if isinstance(regressed, int) else 0
        error = row.get("error")
        hard = 1 if success and regressed_n == 0 and not error else 0
        soft = 0.0 if error else (0.5 if success else 0.0) + 0.5 * max(0.0, 1.0 - regressed_n / 5.0)
        if error:
            reason = f"run ended with {error}"
        elif not success and regressed_n:
            reason = f"the fix's tests fail and {regressed_n} unrelated tests regressed: " + ", ".join(row.get("regressions") or [])
        elif not success:
            reason = "the fix's own tests fail"
        elif regressed_n:
            reason = f"the fix passes but {regressed_n} unrelated tests regressed: " + ", ".join(row.get("regressions") or [])
        else:
            reason = ""
        return {
            "id": item["id"],
            "hard": hard,
            "soft": round(min(1.0, soft), 4),
            "question": item["question"],
            "predicted_answer": "edited " + ", ".join(row.get("edited") or []) or "no edit",
            "fail_reason": reason,
            "gold": item.get("gold", []),
            "edited": row.get("edited", []),
            "edited_risky": row.get("edited_risky", []),
            "risky_edit_untested": row.get("risky_edit_untested"),
            "partners_missed": row.get("partners_missed", []),
            "agent_test_runs": row.get("agent_test_runs", 0),
            "regressed_tests": regressed_n,
            "success": success,
            "cost_usd": row.get("cost_usd"),
            "steps": row.get("steps"),
        }

    @staticmethod
    def _persist_conversation(transcript: Path, pred_dir: Path) -> None:
        """Claude Code's stream-json, reduced to the role/content list the
        reflect step reads. Tool calls and results are kept as text so the
        optimizer can see what the agent did, not only what it said."""
        if not transcript.exists():
            return
        messages: list[dict] = []
        for line in transcript.read_text(encoding="utf-8").splitlines():
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                continue
            role = ev.get("type")
            if role not in ("assistant", "user"):
                continue
            parts: list[str] = []
            for c in (ev.get("message") or {}).get("content") or []:
                if c.get("type") == "text":
                    parts.append(c["text"])
                elif c.get("type") == "tool_use":
                    parts.append(f"[tool {c.get('name')}] {json.dumps(c.get('input'))[:600]}")
                elif c.get("type") == "tool_result":
                    body = c.get("content")
                    text = body if isinstance(body, str) else json.dumps(body)
                    parts.append(f"[result{' error' if c.get('is_error') else ''}] {text[:600]}")
            if parts:
                messages.append({"role": role, "content": "\n".join(parts)})
        if messages:
            pred_dir.mkdir(parents=True, exist_ok=True)
            (pred_dir / "conversation.json").write_text(json.dumps(messages, indent=1), encoding="utf-8")

    # ── stratification ────────────────────────────────────────────────

    def get_task_types(self) -> list[str]:
        seen: list[str] = []
        for item in self.dataloader.train_items + self.dataloader.val_items + self.dataloader.test_items:
            tt = str(item.get("task_type") or "fix")
            if tt not in seen:
                seen.append(tt)
        return seen or ["fix"]
