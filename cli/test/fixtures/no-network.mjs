/* Preloaded with `node --import` to take the network away from a process.
 * fetch, http, https, net, tls and dns lookups all throw, and each attempt
 * is appended to the file named by NO_NETWORK_LOG, so a test can fail on an
 * attempt that the code under test caught and swallowed. */
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns';

const record = (what) => {
  if (process.env.NO_NETWORK_LOG) appendFileSync(process.env.NO_NETWORK_LOG, `${what}\n`);
  throw new Error(`network access attempted: ${what}`);
};

globalThis.fetch = async (url) => record(`fetch ${url}`);
for (const [name, mod] of [['http', http], ['https', https]]) {
  mod.request = (...a) => record(`${name}.request ${String(a[0]?.href || a[0]?.host || a[0])}`);
  mod.get = (...a) => record(`${name}.get ${String(a[0]?.href || a[0]?.host || a[0])}`);
}
net.connect = net.createConnection = (...a) => record(`net.connect ${JSON.stringify(a[0])}`);
net.Socket.prototype.connect = function (...a) { return record(`socket.connect ${JSON.stringify(a[0])}`); };
tls.connect = (...a) => record(`tls.connect ${JSON.stringify(a[0])}`);
dns.lookup = (host) => record(`dns.lookup ${host}`);
dns.promises.lookup = async (host) => record(`dns.lookup ${host}`);
syncBuiltinESMExports();
