#!/bin/bash
# One night of the collateral damage study (bench/PREREG.md).
#
#   bash bench/results/damage-screen/night.sh
#
# It runs only between 22:00 and 08:00 Montevideo time. It first waits until
# the other benchmark study of the night has finished: no systemd unit whose
# name starts with $CX_OTHER_UNITS is running, and none of its timers fires
# before 08:00. Then it runs whichever phase is due, with 2 workers:
#
#   screen  `none`, seed 1, on the 60 screen tasks
#   select  bench/damage.mjs select, once the screen is complete; a kill
#           stops the study and its timer
#   arms    `none`, `file`, `stop`, `hooks`, seeds 1 and 2, on the 30
#           selected tasks; the maps are built first
#
# Agent runs tonight, this study's and the other study's together, stay at
# $CX_NIGHT_CAP (40). A SIGINT at 08:00 stops both workers. Finished rows are
# skipped, so the next night resumes. A row that hit the usage limit is
# removed so it runs again; a row with any other error is removed once.
# When the arms phase is complete, bench/damage.mjs analyze runs and the
# timer is stopped. Nothing is committed or pushed: read the transcripts
# before you commit them.
set -u
cd "$(dirname "$0")/../../.."
LOGDIR=${CX_LOG_DIR:-/root/var/platform/logs/complexmd}
NIGHT=$(TZ=America/Montevideo date +%F -d '-8 hours')
LOG=$LOGDIR/e2-$NIGHT.log
CAP=${CX_NIGHT_CAP:-40}
OTHER_RUNS=${CX_OTHER_RUNS:-/root/workspace/.worktrees/cmd-e10/bench/results/opus55-fastify/runs.jsonl}
OTHER_UNITS=${CX_OTHER_UNITS:-cmd-e10-}
TIMER=${CX_TIMER:-cmd-e2-night.timer}
SETS=${CX_SETS:-fastify mocha uptime-kuma}
DATA=${CX_DATA_DIR:-bench/data}
SCREEN=${CX_SCREEN_DIR:-bench/results/damage-screen}
ARMS=${CX_ARMS_DIR:-bench/results/damage-arms}
MODEL=${CX_MODEL:-claude-sonnet-5-5}
AGENT=${CX_AGENT:-claude}
EXTRA=${CX_EXTRA:-}
WORK=${CX_WORK:-/tmp/cxe2}
mkdir -p "$LOGDIR" "$ARMS"
exec >>"$LOG" 2>&1
say() { echo "$(TZ=America/Montevideo date '+%F %T') $*"; }
now() { date +%s; }

hour=$((10#$(TZ=America/Montevideo date +%H)))
if [ -z "${CX_ANY_HOUR:-}" ] && [ "$hour" -ge 8 ] && [ "$hour" -lt 22 ]; then say "refused: outside 22:00 to 08:00 Montevideo"; exit 3; fi
if [ "$hour" -ge 22 ]; then end=$(TZ=America/Montevideo date -d 'tomorrow 08:00' +%s); else end=$(TZ=America/Montevideo date -d 'today 08:00' +%s); fi
[ -n "${CX_END:-}" ] && end=$CX_END
start=$(TZ=America/Montevideo date -d "$NIGHT 22:00" +%s)
say "night $NIGHT: $((end - $(now))) seconds until 08:00, cap $CAP agent runs, model $MODEL, cli $(git rev-parse --short HEAD)"

# The other study: a running service, or a timer that fires before 08:00.
other_busy() {
  local u state next
  for u in $(systemctl list-units --all --plain --no-legend "${OTHER_UNITS}*" 2>/dev/null | awk '{print $1}'); do
    state=$(systemctl show -p ActiveState --value "$u")
    case "$u" in
      *.service) case "$state" in active|activating|deactivating|reloading) return 0;; esac ;;
      *.timer)
        next=$(systemctl show -p NextElapseUSecRealtime --value "$u")
        if [ "$state" = active ] && [ -n "$next" ] && [ "$next" != "n/a" ] && [ "$(date -d "$next" +%s 2>/dev/null || echo 0)" -lt "$end" ]; then return 0; fi ;;
    esac
  done
  return 1
}
sleep "${CX_START_DELAY:-120}"
waited=0
while other_busy; do
  [ "$waited" = 0 ] && say "waiting for ${OTHER_UNITS}* to finish"
  waited=1
  if [ "$(now)" -ge $((end - 900)) ]; then say "the other study ran until 08:00; nothing run tonight"; exit 0; fi
  sleep 60
done
[ "$waited" = 1 ] && say "${OTHER_UNITS}* finished"

# Rows to run again: the usage limit (always), any other error (once, as
# retried.txt records). Then the agent runs counted since 22:00.
tidy() {
  node -e '
    const fs = require("fs"), path = require("path");
    const lim = /(usage|session|weekly|5-hour|rate)[ -]limit|limit (reached|resets|will reset)|hit your limit|out of (extra )?usage/i;
    for (const p of process.argv.slice(1)) {
      if (!fs.existsSync(p)) continue;
      const ledgerPath = path.join(path.dirname(p), "retried.txt");
      const ledger = new Set(fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean) : []);
      const rows = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
      let limit = 0, retry = 0;
      const keep = rows.filter((l) => {
        const r = JSON.parse(l);
        if (!r.error) return true;
        if (lim.test(r.error) && !r.steps) { limit++; return false; }
        const key = `${r.task}/${r.arm}/${r.seed ?? 1}`;
        if (ledger.has(key)) return true;
        ledger.add(key); retry++; return false;
      });
      if (keep.length < rows.length) {
        fs.writeFileSync(p, keep.map((l) => l + "\n").join(""));
        fs.writeFileSync(ledgerPath, [...ledger].join("\n") + "\n");
        console.log(`${p}: removed ${limit} usage limit rows and ${retry} error rows to run once more`);
      }
    }' "$@"
}
tonight() {
  node -e '
    const fs = require("fs"); const since = Number(process.argv[1]) * 1000; let n = 0;
    for (const p of process.argv.slice(2)) {
      if (!fs.existsSync(p)) continue;
      for (const l of fs.readFileSync(p, "utf8").split("\n").filter(Boolean)) { const r = JSON.parse(l); if (r.arm !== "gold" && Date.parse(r.at) >= since) n++; }
    }
    console.log(n);' "$start" "$OTHER_RUNS" $(for s in $SETS; do echo "$SCREEN/$s/runs.jsonl $ARMS/$s/runs.jsonl"; done)
}
# Rows of `arms` x `seeds` still missing for the tasks of a dataset.
missing() {
  node -e '
    const fs = require("fs"); const [ds, runs, arms, seeds] = process.argv.slice(1);
    if (!fs.existsSync(ds)) { console.log(-1); process.exit(0); }
    const have = new Set(fs.existsSync(runs) ? fs.readFileSync(runs, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.task}/${r.arm}/${r.seed ?? 1}`; }) : []);
    let n = 0;
    for (const t of JSON.parse(fs.readFileSync(ds, "utf8")).tasks) for (const a of arms.split(",")) for (const s of seeds.split(",")) if (!have.has(`${t.id}/${a}/${s}`)) n++;
    console.log(n);' "$@"
}
# Agent rows a worker added: rows of its task range in one results file.
rows_in() {
  node -e '
    const fs = require("fs"); const [ds, runs, range] = process.argv.slice(1);
    const [a, b] = range.split("-").map(Number);
    const ids = new Set(JSON.parse(fs.readFileSync(ds, "utf8")).tasks.slice(a, b + 1).map((t) => t.id));
    const rows = fs.existsSync(runs) ? fs.readFileSync(runs, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    console.log(rows.filter((r) => r.arm !== "gold" && ids.has(r.task)).length);' "$@"
}
half() { node -e 'const n = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).tasks.length, m = Math.ceil(n / 2); console.log(process.argv[2] === "1" ? `0-${m - 1}` : (m <= n - 1 ? `${m}-${n - 1}` : ""))' "$1" "$2"; }

phase_missing() { # kind arms seeds
  local total=0 s m
  for s in $SETS; do
    m=$(missing "$DATA/damage-$1-$s.json" "$([ "$1" = screen ] && echo "$SCREEN" || echo "$ARMS")/$s/runs.jsonl" "$2" "$3")
    [ "$m" = -1 ] && { echo -1; return; }
    total=$((total + m))
  done
  echo "$total"
}

# One worker: its half of each dataset, in turn, until its share is spent.
worker() { # w share kind arms seeds
  local w=$1 share=$2 kind=$3 arms=$4 seeds=$5 s range ds out before after rc cache
  for s in $SETS; do
    [ "$share" -le 0 ] && break
    [ $((end - $(now))) -lt 60 ] && break
    ds="$DATA/damage-$kind-$s.json"
    range=$(half "$ds" "$w"); [ -n "$range" ] || continue
    if [ "$kind" = screen ]; then out="$SCREEN/$s"; cache=(); else out="$ARMS/$s"; cache=(--cache "$SCREEN/$s"); fi
    before=$(rows_in "$ds" "$out/runs.jsonl" "$range")
    rm -rf "$WORK-w$w"
    timeout -s INT -k 120 $((end - $(now))) node bench/run.mjs --dataset "$ds" --arms "$arms" --seeds "$seeds" --agent "$AGENT" --model "$MODEL" \
      --stop-at none --budget 5 --timeout 900 --out "$out" "${cache[@]}" --tasks "$range" --max-runs "$share" --work "$WORK-w$w" $EXTRA \
      >>"$LOGDIR/e2-$NIGHT-w$w.log" 2>&1
    rc=$?
    after=$(rows_in "$ds" "$out/runs.jsonl" "$range")
    share=$((share - (after - before)))
    say "worker $w: $s $kind tasks $range, $((after - before)) rows, exit $rc"
    [ "$rc" = 124 ] && return
  done
}
run_phase() { # kind arms seeds
  local budget left
  tidy $(for s in $SETS; do echo "$SCREEN/$s/runs.jsonl $ARMS/$s/runs.jsonl"; done)
  budget=$((CAP - $(tonight)))
  if [ "$budget" -le 0 ]; then say "$1: no runs left tonight ($CAP counted since 22:00)"; return 1; fi
  say "$1: $(phase_missing "$1" "$2" "$3") rows missing, $budget runs left tonight"
  worker 1 $(((budget + 1) / 2)) "$1" "$2" "$3" &
  worker 2 $((budget / 2)) "$1" "$2" "$3" &
  wait
  tidy $(for s in $SETS; do echo "$SCREEN/$s/runs.jsonl $ARMS/$s/runs.jsonl"; done)
}
stop_timer() { if systemctl stop "$TIMER" 2>/dev/null; then say "stopped $TIMER"; else say "$TIMER was not running"; fi; }

# 1. The screen.
if [ "$(phase_missing screen none 1)" != 0 ]; then
  run_phase screen none 1 || exit 0
  m=$(phase_missing screen none 1)
  if [ "$m" != 0 ]; then say "screen: $m rows still missing"; exit 0; fi
fi

# 2. The selection, once.
if [ ! -f "$SCREEN/selection.json" ]; then
  node bench/damage.mjs select --set "$(echo $SETS | tr ' ' ',')" --data-dir "$DATA" --screen-dir "$SCREEN"
  rc=$?
  if [ "$rc" = 3 ]; then say "select: kill, no arms phase"; stop_timer; exit 0; fi
  [ "$rc" = 0 ] || { say "select: exit $rc"; exit 1; }
fi
[ "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).kill)' "$SCREEN/selection.json")" = true ] && { say "the selection killed the study"; stop_timer; exit 0; }

# 3. The arms: maps first, one month at a time, then the workers.
if [ "$(phase_missing arms none,file,stop,hooks 1,2)" != 0 ]; then
  for s in $SETS; do
    say "maps: $s"
    timeout -s INT -k 60 $((end - $(now))) node bench/run.mjs --dataset "$DATA/damage-arms-$s.json" --arms file --seeds 1,2 --agent "$AGENT" --model "$MODEL" \
      --stop-at none --out "$ARMS/$s" --cache "$SCREEN/$s" --maps-only --work "$WORK-maps" $EXTRA >>"$LOGDIR/e2-$NIGHT-maps.log" 2>&1
    rc=$?
    [ "$rc" = 0 ] || say "maps: $s exit $rc"
    [ "$rc" = 124 ] && exit 0
  done
  rm -rf "$WORK-maps"
  run_phase arms none,file,stop,hooks 1,2 || exit 0
fi
m=$(phase_missing arms none,file,stop,hooks 1,2)
if [ "$m" = 0 ]; then
  node bench/damage.mjs analyze --set "$(echo $SETS | tr ' ' ',')" --data-dir "$DATA" --screen-dir "$SCREEN" --arms-dir "$ARMS"
  say "arms phase complete; analysis in $ARMS/analysis.json"
  stop_timer
else
  say "arms: $m rows still missing"
fi
