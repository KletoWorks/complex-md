# The collateral damage study

Does the map cut the tests an agent breaks outside its task? The design,
the rules and the analysis are fixed in [`bench/PREREG.md`](../../PREREG.md).
This directory holds the screen; `bench/results/damage-arms/` holds the
arms phase.

## Configuration

| setting | value |
|---|---|
| datasets | `bench/data/damage-{fastify,mocha,uptime-kuma}.json` (candidates), `damage-screen-*.json` (the 60 screen tasks), `damage-arms-*.json` (the 30 selected, written by `select`) |
| clones | fastify `2a64ae1627`, mocha `cb21a4eba5`, uptime-kuma `c2522806ba`, each with `npm install` at that commit |
| model | `claude-sonnet-5-5`, for the agent and for the map prose |
| screen | `none`, seed 1, 60 runs, after a `gold` pass on every candidate |
| arms | `none`, `file`, `stop`, `hooks`, seeds 1 and 2, 240 runs |
| caps | `--budget 5` (API equivalent, on the subscription), `--timeout 900`, `--map-cap 8192` |
| isolation | `bench/sandbox.mjs`, as in the Opus 5.5 replication |
| schedule | nights only, 22:00 to 08:00 Montevideo, 2 workers, 40 agent runs a night together with the other benchmark study of the night |

## Each night

A systemd timer runs `night.sh` at 22:00. The script:

1. refuses to start outside 22:00 to 08:00;
2. waits until the other benchmark study of the night has finished;
3. counts the agent runs already made since 22:00, by both studies, and
   takes the rest of the 40;
4. runs the phase that is due: the screen, then the selection once the
   screen is complete, then the maps and the arms;
5. splits the runs between 2 workers, each on its half of every dataset,
   and stops both with SIGINT at 08:00;
6. removes rows that hit the usage limit, and rows with any other error
   once, so they run again;
7. after the last arm row, runs `bench/damage.mjs analyze` and stops its
   own timer. A kill at the selection stops it too.

Finished rows are skipped, so each night resumes where the last one
stopped. The script commits nothing. Read the new transcripts before
committing them, because the sandbox leaves the OAuth credentials
readable and a transcript could quote them.

## Commands

```sh
# a phase by hand, inside the night window
bash bench/results/damage-screen/night.sh

# the selection and the analysis, no model
node bench/damage.mjs select
node bench/damage.mjs analyze
```

## Gold pass

Before the screen, the `gold` arm ran on every candidate with no model.
It cached the suite at each base in `baseline/` and recorded the tests
each real fix breaks. `node bench/damage.mjs screen-set` then took the
usable tasks.
