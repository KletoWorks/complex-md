#!/usr/bin/env node
// Build a localization benchmark from a repository's own fix history.
// Each task is a real fix commit: the issue text is the prompt, the parent
// commit is the starting point, the files the fix touched are the answer.
//
//   node bench/make-dataset.mjs /tmp/fastify --repo fastify/fastify --max 30 --out bench/data/fastify.json
//
// Issue text comes from GitHub (PR body, then the issue it closes) through the
// unauthenticated API (60 requests/hour), falling back to the commit message.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { FIX_RE, EXCLUDE_RE, TEST_FILE_RE as TEST_RE, BINARY_RE } from '../cli/src/signals.js';

const args = process.argv.slice(2);
const repoPath = args.find((a) => !a.startsWith('--')) || process.cwd();
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const slug = opt('--repo', null);
const max = Number(opt('--max', 30));
const months = Number(opt('--months', 12));
const maxGold = Number(opt('--max-gold', 3));
const out = opt('--out', `bench/data/${(slug || 'repo').replace('/', '-')}.json`);

function git(a) {
  const r = spawnSync('git', a, { cwd: repoPath, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

// Conventional-commit types that are not bug fixes, plus typo-only changes.
const NOT_A_FIX = /^(docs?|chore|ci|build|test|refactor|style|perf)(\(.*\))?!?:|typo/i;
const isSource = (f) => !EXCLUDE_RE.test(f) && !TEST_RE.test(f) && !BINARY_RE.test(f);

// Fix commits, newest first, with the files each touched.
const log = git(['log', '--no-merges', `--since=${months} months ago`, '-E', '-i', `--grep=${FIX_RE.source}`, '--format=%x1e%H%x1f%P%x1f%cs%x1f%s%x1f%b%x1d', '--name-only']);
const candidates = [];
for (const rec of log.split('\x1e').slice(1)) {
  const [meta, rest = ''] = rec.split('\x1d');
  const files = rest.split('\n').map((s) => s.trim()).filter(Boolean);
  const [sha, parents, date, subject, body = ''] = meta.split('\x1f');
  if (parents.split(' ').length !== 1) continue;
  if (NOT_A_FIX.test(subject)) continue;
  const gold = files.filter(isSource);
  const tests = files.filter((f) => TEST_RE.test(f));
  if (gold.length === 0 || gold.length > maxGold) continue;
  // A fix that only touched dependency manifests is not a localization task.
  if (gold.every((f) => /package(-lock)?\.json$|\.lock$|\.ya?ml$/.test(f))) continue;
  candidates.push({ sha, base: parents, date, subject, body, gold, tests });
}
console.error(`${candidates.length} candidate fix commits in ${months} months; keeping up to ${max}`);

// Responses are cached on disk: the unauthenticated limit is 60 an hour, and
// a dataset rebuild should not spend it again. GITHUB_TOKEN lifts the limit.
const cacheDir = `${dirname(out)}/.gh-cache`;
mkdirSync(cacheDir, { recursive: true });
async function gh(path) {
  if (!slug) return null;
  const key = `${cacheDir}/${slug.replace('/', '-')}${path.replace(/\//g, '-')}.json`;
  if (existsSync(key)) return JSON.parse(readFileSync(key, 'utf8'));
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'complex-md-bench' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${slug}${path}`, { headers });
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    console.error(`GitHub rate limit hit (resets ${new Date(reset).toISOString()}); remaining tasks use commit messages`);
    return 'LIMIT';
  }
  if (!res.ok) { writeFileSync(key, 'null'); return null; }
  const j = await res.json();
  writeFileSync(key, JSON.stringify(j));
  return j;
}

const tasks = [];
let limited = false;
for (const c of candidates) {
  if (tasks.length >= max) break;
  let title = c.subject.replace(/\s*\(#\d+\)\s*$/, '');
  let text = c.body.trim();
  let source = 'commit';
  const prNum = /\(#(\d+)\)\s*$/.exec(c.subject)?.[1];
  if (prNum && !limited) {
    const pr = await gh(`/pulls/${prNum}`);
    if (pr === 'LIMIT') limited = true;
    else if (pr) {
      title = pr.title; text = pr.body || ''; source = 'pr';
      const issueNum = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*#(\d+)/i.exec(pr.body || '')?.[1];
      if (issueNum) {
        const issue = await gh(`/issues/${issueNum}`);
        if (issue === 'LIMIT') limited = true;
        else if (issue && !issue.pull_request) { title = issue.title; text = issue.body || ''; source = 'issue'; }
      }
    }
  }
  // Strip PR-template boilerplate and checklists that tell the agent nothing.
  text = text.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*-\s*\[[ x]\].*$/gim, '').replace(/^#+\s*Checklist[\s\S]*$/im, '').trim();
  if (NOT_A_FIX.test(title)) continue;
  if (text.length < 40) continue; // a bare title is too thin to stand in for an issue
  const namesGold = c.gold.some((g) => text.includes(g) || title.includes(g) || text.includes(g.split('/').pop()));
  tasks.push({ id: c.sha.slice(0, 10), repo: slug, base: c.base, fix: c.sha, date: c.date, title, text, source, gold: c.gold, tests: c.tests, names_gold: namesGold });
  console.error(`${tasks.length}. ${c.sha.slice(0, 10)} [${source}${namesGold ? ', names gold' : ''}] ${title.slice(0, 70)} -> ${c.gold.join(', ')}`);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ repo: slug, path: repoPath, created: new Date().toISOString().slice(0, 10), months, tasks }, null, 2) + '\n');
console.error(`wrote ${out}: ${tasks.length} tasks, ${tasks.filter((t) => t.names_gold).length} name a gold file in the text`);
