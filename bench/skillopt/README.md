# Training the integration block with SkillOpt

The text an agent reads about COMPLEX.md (`prompts/integration.md`) was
written by hand. This directory makes it a trainable parameter: SkillOpt
(microsoft/SkillOpt, MIT) runs the danger-selected tasks with a candidate
block, reads the trajectories, proposes a few edits, and keeps an edit only
when the validation split improves. The score is the benchmark's own:

- `hard`: the fix's tests pass and no unrelated test regressed
- `soft`: half for a passing fix, half scaled down by regressed tests

Episodes shell out to `bench/run.mjs --arms file --skill <candidate>`, so the
judgement is the published one; nothing is re-implemented here.

## Files

| file | role |
|---|---|
| `env.py` | `ComplexMdEnv(EnvAdapter)`: batches, rollout, scoring, conversation persistence |
| `dataloader.py` | `ComplexMdLoader(SplitDataLoader)`: reads `bench/data/*.json`, ratio splits |
| `config.yaml` | training config; 20 train / 8 validation / 2 test on the fastify set |
| `skills/initial.md` | the seed: a copy of `prompts/integration.md` at the time of training |

## Setup

```sh
git clone https://github.com/microsoft/SkillOpt && cd SkillOpt
pip install -e ".[claude]"
ln -s /path/to/complex-md/bench/skillopt skillopt/envs/complexmd
cp skillopt/envs/complexmd/config.yaml configs/complexmd/default.yaml
```

Register the adapter in `_register_builtins()` of both `scripts/train.py`
and `scripts/eval_only.py`, the way the built-in ones are:

```python
try:
    from skillopt.envs.complexmd.env import ComplexMdEnv
    _ENV_REGISTRY["complexmd"] = ComplexMdEnv
except ImportError:
    pass
```

Both the target and the optimizer run through the local `claude` login
(`claude_code_exec`, `claude_chat`); no API key is needed.

## Dry run and training

```sh
# plumbing only, no model: every episode uses the harness's mock agent
python scripts/train.py --config configs/complexmd/default.yaml --cfg-options env.agent=mock env.workers=4

# the real thing
python scripts/train.py --config configs/complexmd/default.yaml
```

Output is `best_skill.md`; to adopt it, replace `prompts/integration.md`,
run `npm run build`, and re-run the benchmark against `none` on the tasks
the optimizer never saw.

## What to expect

One episode is a full Claude Code run on a real fix, several minutes and a
few API-equivalent dollars of subscription usage. A step over the 20 training
tasks plus a validation pass is 28 to 40 episodes; two epochs at
`learning_rate: 2` is a night on a shared account. Thirty tasks is a small
set for a train/validation split, so a block trained here is a hypothesis to
confirm on a second repository, not a result.
