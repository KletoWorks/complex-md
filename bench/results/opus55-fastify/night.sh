#!/bin/bash
# One night of the Opus 5.5 replication on the fastify danger set.
#
#   bash bench/results/opus55-fastify/night.sh
#
# 2 workers, 20 runs each at most (40 a night), stopped with SIGINT at
# 08:00 Montevideo time. It runs only between 22:00 and 08:00. Finished rows
# are skipped, so the next night resumes. A row that hit the subscription
# usage limit is removed before and after the night, so it runs again.
set -u
cd "$(dirname "$0")/../../.."
OUT=bench/results/opus55-fastify
LOGDIR=${CX_LOG_DIR:-/root/var/platform/logs/complexmd}
NIGHT=$(TZ=America/Montevideo date +%F -d '-8 hours')
LOG=$LOGDIR/e10-$NIGHT.log
PER_WORKER=${CX_PER_WORKER:-20}
mkdir -p "$LOGDIR"
exec >>"$LOG" 2>&1
say() { echo "$(TZ=America/Montevideo date '+%F %T') $*"; }

hour=$((10#$(TZ=America/Montevideo date +%H)))
if [ "$hour" -ge 8 ] && [ "$hour" -lt 22 ]; then say "refused: outside 22:00 to 08:00 Montevideo"; exit 3; fi
if [ "$hour" -ge 22 ]; then end=$(TZ=America/Montevideo date -d 'tomorrow 08:00' +%s); else end=$(TZ=America/Montevideo date -d 'today 08:00' +%s); fi
secs=$((end - $(date +%s)))
say "night $NIGHT: $secs seconds until 08:00, $PER_WORKER runs a worker at most, cli $(git rev-parse --short HEAD)"

# Rows that hit the usage limit: recorded as errors with no steps, removed so they run again.
drop_limit_rows() {
  node -e '
    const fs = require("fs"), p = process.argv[1];
    if (!fs.existsSync(p)) process.exit(0);
    const lim = /(usage|session|weekly|5-hour|rate)[ -]limit|limit (reached|resets|will reset)|hit your limit|out of (extra )?usage/i;
    const rows = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
    const keep = rows.filter((l) => { const r = JSON.parse(l); return !(r.error && lim.test(r.error) && !r.steps); });
    if (keep.length < rows.length) { fs.writeFileSync(p, keep.map((l) => l + "\n").join("")); console.log(`removed ${rows.length - keep.length} usage limit rows`); }
  ' "$OUT/runs.jsonl"
}

COMMON=(--dataset bench/data/fastify-danger.json --arms none,file --model claude-opus-5-5
  --stop-at none --budget 5 --timeout 900 --out "$OUT")

drop_limit_rows
say "maps"
timeout -s INT -k 60 "$secs" node bench/run.mjs "${COMMON[@]}" --maps-only --work /tmp/cxe10-maps
rc=$?
# Exit 4: a month has no map; its tasks' file rows record the error. 124: 08:00 came first.
[ "$rc" = 0 ] || say "maps: exit $rc"
[ "$rc" = 124 ] && exit 0
rm -rf /tmp/cxe10-maps

left=$((end - $(date +%s)))
for w in 1 2; do
  range=$([ "$w" = 1 ] && echo 0-14 || echo 15-29)
  rm -rf "/tmp/cxe10-w$w"
  say "worker $w: tasks $range"
  timeout -s INT -k 120 "$left" node bench/run.mjs "${COMMON[@]}" --tasks "$range" --max-runs "$PER_WORKER" --work "/tmp/cxe10-w$w" >>"$LOGDIR/e10-$NIGHT-w$w.log" 2>&1 &
done
wait
drop_limit_rows
say "done: $(grep -c . "$OUT/runs.jsonl" 2>/dev/null || echo 0) of 60 rows"
