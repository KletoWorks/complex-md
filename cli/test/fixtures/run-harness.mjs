/* runHarness in a child process, for tests that serve something from their
   own event loop while the harness runs. Prints the result as JSON. */
import { runHarness } from './bench-repo.mjs';

if (process.argv[2]) {
  const { fx, extra, env, sandbox } = JSON.parse(process.argv[2]);
  process.stdout.write(JSON.stringify(runHarness(fx, extra, { env, sandbox })));
}
