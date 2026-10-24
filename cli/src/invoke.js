// How a wired hook or MCP entry runs the CLI when it came from the registry.
import { createRequire } from 'node:module';

const { version } = createRequire(import.meta.url)('../package.json');

/* An unpinned `npx -y complex-md` ran on every edit. It cost about 0.8 s
   warm, ran whatever version was published last, and with the registry
   unreachable it waited out the 30 s hook timeout. The pinned spec with
   --prefer-offline runs from the npx cache with no registry request. A
   hook first tries a project install (node_modules/.bin) and then a
   complex-md on PATH, which skip npx entirely. The MCP entry is an argv
   with no shell, so it gets the pinned npx form only. */
export function registryInvocation() {
  const args = ['-y', '--prefer-offline', `complex-md@${version}`];
  const npx = `npx ${args.join(' ')}`;
  const hook = (sub) =>
    `if [ -x node_modules/.bin/complex-md ]; then node_modules/.bin/complex-md ${sub}; ` +
    `elif command -v complex-md >/dev/null 2>&1; then complex-md ${sub}; ` +
    `else ${npx} ${sub}; fi`;
  return { shell: npx, command: 'npx', args, absShell: npx, absCommand: 'npx', absArgs: args, hook };
}

/** The shell command a hook entry runs for `sub` (for example "hook pre"). */
export function hookCommand(inv, sub) {
  return inv.hook ? inv.hook(sub) : `${inv.shell} ${sub}`;
}
