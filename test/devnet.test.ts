import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readiness } from '../scripts/devnet.ts';

// Health bodies use the Ogmios v7 / Kupo field names observed on Yaci DevKit 0.12.0 (step 4.5a); both answer HTTP 200.
async function serve(body: unknown): Promise<{ url: string; server: Server }> {
  const server = createServer((_, response) => { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}
async function probe(ogmios: unknown, kupo: unknown) {
  const [o, k] = await Promise.all([serve(ogmios), serve(kupo)]);
  try { return await readiness({ ogmios: `ws://${o.url}`, kupo: `http://${k.url}` }); }
  finally { o.server.close(); k.server.close(); }
}
const tip = (slot: number, height: number) => ({ connectionStatus: 'connected', lastKnownTip: { slot, id: 'ab'.repeat(32), height } });

test('a just-started devnet without blocks is not ready although both services answer 200', async () => {
  assert.equal((await probe({ connectionStatus: 'connected', lastKnownTip: null }, { most_recent_checkpoint: null })).ready, false);
  assert.equal((await probe(tip(0, 0), { most_recent_checkpoint: 0 })).ready, false);
  assert.equal((await probe({ connectionStatus: 'disconnected', lastKnownTip: null }, { most_recent_checkpoint: null })).ready, false);
});
test('Kupo behind the node tip is not ready', async () => {
  assert.equal((await probe(tip(29, 27), { most_recent_checkpoint: 20 })).ready, false);
});
test('connected node with blocks and Kupo at the tip is ready', async () => {
  assert.equal((await probe(tip(29, 27), { most_recent_checkpoint: 29 })).ready, true);
});
