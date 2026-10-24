// Inside the run's network namespace: listens on 127.0.0.1:<port> and pipes
// each connection to the harness proxy's Unix socket, the only way out.
// Started by the sandbox before the agent; ignores the stop signals the
// harness sends the agent, so a stopping agent can still report its result.
//
//   node sandbox-forward.mjs <port> <socket> <ready-file>
import { createServer, connect } from 'node:net';
import { writeFileSync } from 'node:fs';

const [port, socket, ready] = process.argv.slice(2);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => {});
createServer((c) => {
  const up = connect(socket);
  c.pipe(up); up.pipe(c);
  up.on('error', () => c.destroy());
  c.on('error', () => up.destroy());
}).listen(Number(port), '127.0.0.1', () => writeFileSync(ready, ''));
