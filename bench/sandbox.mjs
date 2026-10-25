// The agent's view of the machine: no network but an allowlist proxy, and
// no file outside the paths it needs.
//
// Agents reached the future outside git too. One fetched the upstream
// repository's main branch with `node -e "fetch(...)"`, which Bash(node:*)
// allows. Any agent can read the dataset clone, past runs' patches and
// transcripts, or the dataset file with every task's fix commit, because
// they sit on the same disk. So each agent runs in its own Linux network,
// mount and PID namespaces:
//
// - Network: the namespace has only a loopback interface. A forwarder on
//   127.0.0.1 pipes connections to a Unix socket where the harness runs an
//   HTTP CONNECT proxy that admits only the model API hosts. HTTPS_PROXY
//   points the agent at it; anything that ignores it has no route out.
// - Files: every directory under the mask roots (/tmp, /root, /home, /run
//   and others, plus the dataset clone, the bench directory and the results)
//   is hidden behind an empty tmpfs, except the paths the agent needs: its
//   checkout, the dependency copy, the Node install, the agent's own
//   install and credentials. Files are hidden behind /dev/null.
// - Privilege: the agent runs with every capability dropped and no new
//   privileges, so it cannot unmount a mask, mount, or leave the namespaces.
//   The PID namespace keeps /proc/<pid>/root of host processes out of reach.
//
// It needs root (or user namespaces), util-linux unshare and setpriv, and
// iproute2. sandboxSupport() says whether this host has them.
import { spawnSync } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { readdirSync, lstatSync, realpathSync, mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, delimiter, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_ROOTS = ['/tmp', '/var/tmp', '/root', '/home', '/run', '/srv', '/mnt', '/media', '/opt', '/dev/shm', '/var/lib/docker', '/var/www'];
export const DEFAULT_ALLOW = ['api.anthropic.com', 'platform.claude.com'];
export const PROXY_PORT = 3128;
/* Directories with more entries than this are replaced whole, then the kept
   paths are bound back, instead of masking each entry. */
const SIBLING_LIMIT = 512;

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const real = (p) => { try { return realpathSync(p); } catch { return null; } };
// sep, not '/': the plan is a pure function of the tree, and on Windows join() writes \.
const under = (p, root) => p === root || p.startsWith(root.endsWith(sep) ? root : root + sep);

export function which(bin, path = process.env.PATH) {
  for (const d of (path || '').split(delimiter)) {
    const p = join(d, bin);
    if (existsSync(p)) return p;
  }
  return null;
}

let support;
/** { ok, reason }: whether this host can build the sandbox. */
export function sandboxSupport() {
  if (support) return support;
  for (const bin of ['unshare', 'setpriv', 'ip']) if (!which(bin)) return (support = { ok: false, reason: `${bin} is not installed` });
  const dir = mkdtempSync(join(tmpdir(), 'cx-sbx-probe-'));
  try {
    const r = spawnSync('unshare', ['--net', '--mount', '--pid', '--fork', '--mount-proc', '--kill-child', '--propagation', 'private', 'sh', '-c',
      `ip link set lo up && mount -t tmpfs cx ${q(dir)} && setpriv --no-new-privs --inh-caps=-all --ambient-caps=-all --bounding-set=-all true`], { encoding: 'utf8', timeout: 15000 });
    support = r.status === 0 ? { ok: true } : { ok: false, reason: (r.stderr || `exit ${r.status}`).trim().slice(0, 200) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return support;
}

/* The mounts that hide everything under `roots` except `keeps`. Ops:
   tmpfs (hide a directory), null (hide a file), stage (replace a large
   directory whole and bind the kept paths back). Symlinks are left alone:
   they lead into a masked or an unmasked place either way. */
export function planMasks({ roots, keeps }) {
  const ks = [...new Set(keeps.map(real).filter(Boolean))];
  let rs = [...new Set(roots.map(real).filter(Boolean))];
  rs = rs.filter((r) => !rs.some((o) => o !== r && under(r, o)));
  const ops = [];
  const hide = (p) => {
    let st; try { st = lstatSync(p); } catch { return; }
    if (st.isSymbolicLink()) return;
    ops.push({ op: st.isDirectory() ? 'tmpfs' : 'null', path: p });
  };
  const walk = (dir, inside) => {
    let names; try { names = readdirSync(dir); } catch { return; }
    if (names.length > SIBLING_LIMIT) { ops.push({ op: 'stage', path: dir, keeps: inside }); return; }
    for (const n of names) {
      const p = join(dir, n);
      if (inside.includes(p)) continue;
      const sub = inside.filter((k) => under(k, p));
      if (sub.length) walk(p, sub); else hide(p);
    }
  };
  for (const r of rs) {
    const inside = ks.filter((k) => under(k, r));
    if (inside.includes(r)) continue;
    if (inside.length) walk(r, inside); else hide(r);
  }
  return ops;
}

/* Shell lines that apply the plan. A stage op mounts a tmpfs on a fresh
   directory, binds each kept path into it at the same relative place, and
   moves it over the directory it replaces. */
function maskScript(ops, stageBase) {
  const lines = [];
  let i = 0;
  for (const o of ops) {
    // A path that vanished since the plan has nothing left to hide; any other mount failure stops the run.
    if (o.op === 'tmpfs') lines.push(`[ ! -d ${q(o.path)} ] || mount -t tmpfs -o mode=755,size=64m cxmask ${q(o.path)}`);
    else if (o.op === 'null') lines.push(`[ ! -e ${q(o.path)} ] || mount --bind /dev/null ${q(o.path)}`);
    else {
      const s = join(stageBase, `stage${i++}`);
      mkdirSync(s, { recursive: true });
      lines.push(`mount -t tmpfs -o mode=755 cxstage ${q(s)}`);
      for (const k of o.keeps) {
        const rel = relative(o.path, k);
        const isDir = lstatSync(k).isDirectory();
        lines.push(`mkdir -p ${q(join(s, isDir ? rel : dirname(rel)))}`);
        if (!isDir) lines.push(`: > ${q(join(s, rel))}`);
        lines.push(`mount --rbind ${q(k)} ${q(join(s, rel))}`);
      }
      lines.push(`mount --move ${q(s)} ${q(o.path)}`);
    }
  }
  return lines;
}

/**
 * The command that runs `cmd args` inside the sandbox, as [file, args, env].
 * `dir` is a fresh directory for the sandbox's own files (socket, stage
 * mounts); it is kept visible. Start the proxy on `socketOf(dir)` first.
 * A bare `cmd` is looked up on `path` before the masks go up: a PATH entry
 * is often a symlink in a masked directory (~/.local/bin/claude) to a kept
 * install, and inside the sandbox the lookup would find nothing.
 */
export function sandboxCommand({ cmd, args, cwd, dir, roots, keeps, port = PROXY_PORT, path = process.env.PATH }) {
  if (!cmd.includes('/')) { const found = which(cmd, path); if (found) cmd = real(found) || found; }
  const net = join(dir, 'net');
  mkdirSync(net, { recursive: true });
  const socket = join(net, 'proxy.sock');
  const ready = join(net, 'ready');
  const ops = planMasks({ roots, keeps: [...keeps, net] });
  const script = [
    'set -e',
    'ip link set lo up',
    `${q(process.execPath)} ${q(join(here, 'sandbox-forward.mjs'))} ${port} ${q(socket)} ${q(ready)} </dev/null >/dev/null 2>&1 &`,
    `i=0; while [ ! -e ${q(ready)} ]; do i=$((i+1)); if [ $i -gt 400 ]; then echo 'sandbox: the proxy forwarder did not start' >&2; exit 97; fi; sleep 0.05; done`,
    ...maskScript(ops, join(dir, 'stage')),
    `cd ${q(cwd)}`,
    'set +e',
    "trap 'kill -INT $C 2>/dev/null' INT",
    "trap 'kill -TERM $C 2>/dev/null' TERM",
    'setpriv --no-new-privs --inh-caps=-all --ambient-caps=-all --bounding-set=-all -- "$@" <&0 &',
    'C=$!',
    'while :; do wait $C; s=$?; kill -0 $C 2>/dev/null || break; done',
    'exit $s',
  ].join('\n');
  const proxy = `http://127.0.0.1:${port}`;
  const env = { HTTPS_PROXY: proxy, HTTP_PROXY: proxy, https_proxy: proxy, http_proxy: proxy, NO_PROXY: '127.0.0.1,localhost,::1', no_proxy: '127.0.0.1,localhost,::1' };
  return ['unshare', ['--net', '--mount', '--pid', '--fork', '--mount-proc', '--kill-child', '--propagation', 'private', 'sh', '-c', script, 'cx-sandbox', cmd, ...args], env, { socket, masks: ops.length }];
}

/* The process inside the namespace that stands for the agent: the child of
   unshare. unshare itself ignores SIGINT and SIGTERM, so a stop goes there. */
export function innerPid(pid) {
  try {
    const kids = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean);
    return kids.length ? Number(kids[0]) : null;
  } catch { return null; }
}

/**
 * The allowlist proxy on a Unix socket. CONNECT to an allowed host (port
 * 443, or host:port as listed) is tunnelled; everything else gets 403 and is
 * logged. Resolves to { allowed, denied, close }.
 */
export function startProxy({ socket, allow = DEFAULT_ALLOW }) {
  const ok = (host, port) => allow.some((a) => (a.includes(':') ? a === `${host}:${port}` : a === host && port === '443'));
  const allowed = new Set(), denied = new Set();
  const conns = new Set();
  const server = createServer((c) => {
    conns.add(c); c.on('close', () => conns.delete(c));
    c.on('error', () => {});
    let head = Buffer.alloc(0);
    const onData = (d) => {
      head = Buffer.concat([head, d]);
      const end = head.indexOf('\r\n\r\n');
      if (end < 0) { if (head.length > 16384) c.destroy(); return; }
      c.off('data', onData);
      const line = head.subarray(0, head.indexOf('\r\n')).toString();
      const m = /^CONNECT \[?([^\]\s]+?)\]?:(\d+) HTTP\/1\.[01]$/i.exec(line);
      if (!m || !ok(m[1].toLowerCase(), m[2])) {
        denied.add(m ? `${m[1]}:${m[2]}` : line.slice(0, 120));
        c.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
        return;
      }
      allowed.add(`${m[1]}:${m[2]}`);
      c.pause();
      const up = connect(Number(m[2]), m[1], () => {
        c.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        const rest = head.subarray(end + 4);
        if (rest.length) up.write(rest);
        c.pipe(up); up.pipe(c); c.resume();
      });
      conns.add(up); up.on('close', () => conns.delete(up));
      up.on('error', () => c.destroy());
      c.on('close', () => up.destroy());
    };
    c.on('data', onData);
  });
  return new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(socket, () => res({
      allowed, denied,
      close: () => new Promise((r) => { for (const c of conns) c.destroy(); server.close(() => r()); }),
    }));
  });
}
