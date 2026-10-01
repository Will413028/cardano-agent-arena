import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const NODE_IMAGE = 'ghcr.io/intersectmbo/cardano-node:11.1.2';
export const OGMIOS_IMAGE = 'cardanosolutions/ogmios:v7.0.0';
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function docker(...args: string[]): string {
  const started = Date.now();
  try {
    return execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }).trim();
  } finally {
    if (process.env.ARENA_TRACE === '1') console.error(`docker ${args.slice(0, 3).join(' ')}: ${Date.now() - started}ms`);
  }
}
export interface Devnet { directory: string; node: string; ogmios: string; endpoint: string }
export function cli(net: Devnet, ...args: string[]): string {
  return docker('exec', '-e', 'GHCRTS=-N1', net.node, 'cardano-cli', ...(args[0] === 'debug' ? args : ['conway', ...args]));
}
export function put(net: Devnet, name: string, data: unknown): string {
  writeFileSync(join(net.directory, name), JSON.stringify(data, null, 2));
  return `/devnet/${name}`;
}
export async function stopDevnet(net: Devnet): Promise<void> {
  for (const name of [net.ogmios, net.node]) {
    try { docker('rm', '-f', name); } catch { /* Only these uniquely owned test containers. */ }
  }
}
export async function startDevnet(): Promise<Devnet> {
  const id = randomUUID().slice(0, 8);
  const directory = join(ROOT, '.local/devnet', id);
  mkdirSync(directory, { recursive: true });
  cpSync(join(ROOT, 'infra/cardano-fixtures/config'), directory, { recursive: true });
  cpSync(join(ROOT, 'infra/cardano-fixtures/credentials'), join(directory, 'credentials'), { recursive: true });
  for (const file of ['kes.skey', 'vrf.skey']) chmodSync(join(directory, file), 0o400);
  const start = Math.floor(Date.now() / 1000) + 2;
  const byron = JSON.parse(readFileSync(join(directory, 'genesis-byron.json'), 'utf8'));
  byron.startTime = start;
  const shelley = JSON.parse(readFileSync(join(directory, 'genesis-shelley.json'), 'utf8'));
  shelley.systemStart = new Date(start * 1000).toISOString().replace('.000Z', 'Z');
  // Keep local epoch transitions out of the transaction test's critical path.
  shelley.slotLength = 1;
  shelley.epochLength = 1000;
  writeFileSync(join(directory, 'genesis-byron.json'), JSON.stringify(byron));
  writeFileSync(join(directory, 'genesis-shelley.json'), JSON.stringify(shelley));
  writeFileSync(join(directory, 'topology.json'), JSON.stringify({ localRoots: [], publicRoots: [] }));
  const net: Devnet = { directory, node: `arena-skeleton-node-${id}`, ogmios: `arena-skeleton-ogmios-${id}`, endpoint: '' };
  try {
    docker('run', '-d', '--name', net.node, '--label', 'arena.scope=walking-skeleton',
      '-v', `${directory}:/devnet`, '-e', 'CARDANO_BLOCK_PRODUCER=true',
      '-e', 'CARDANO_NODE_SOCKET_PATH=/devnet/node.socket', '-e', 'CARDANO_SOCKET_PATH=/devnet/node.socket',
      NODE_IMAGE, 'run', '--config', '/devnet/cardano-node.json', '--topology', '/devnet/topology.json',
      '--database-path', '/devnet/db', '--shelley-kes-key', '/devnet/kes.skey',
      '--shelley-vrf-key', '/devnet/vrf.skey', '--shelley-operational-certificate', '/devnet/opcert.cert',
      '--byron-delegation-certificate', '/devnet/byron-delegation.cert', '--byron-signing-key', '/devnet/byron-delegate.key');
    let ready = false;
    for (let i = 0; i < 90; i++) {
      await sleep(500);
      if (i % 5 === 0 && docker('inspect', '-f', '{{.State.Status}}', net.node) === 'exited') {
        throw new Error(`Cardano node exited: ${docker('logs', '--tail', '8', net.node)}`);
      }
      try {
        const tip = JSON.parse(cli(net, 'query', 'tip', '--testnet-magic', '42'));
        if (tip.block > 0) { ready = true; break; }
      } catch (error) {
        // A killed Docker client can leave its CLI running inside the container.
        // Stop and clean up rather than accumulating more timed-out query processes.
        if ((error as NodeJS.ErrnoException).code === 'ETIMEDOUT') throw error;
      }
    }
    if (!ready) throw new Error(`Cardano node not ready: ${docker('logs', '--tail', '20', net.node)}`);
    docker('run', '-d', '--name', net.ogmios, '--label', 'arena.scope=walking-skeleton',
      '-v', `${directory}:/devnet`, '-p', '127.0.0.1::1337', OGMIOS_IMAGE,
      '--node-socket', '/devnet/node.socket', '--node-config', '/devnet/cardano-node.json', '--host', '0.0.0.0');
    const port = docker('port', net.ogmios, '1337/tcp').split(':').at(-1);
    net.endpoint = `ws://127.0.0.1:${port}`;
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      try { const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(3000) }); if (response.ok) return net; } catch { /* Ogmios booting. */ }
    }
    throw new Error(`Ogmios not ready: ${docker('logs', '--tail', '20', net.ogmios)}`);
  } catch (error) { await stopDevnet(net); throw error; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stateFile = join(ROOT, '.local/devnet-session.json');
  if (process.argv[2] === 'up') {
    const net = await startDevnet();
    writeFileSync(stateFile, JSON.stringify(net, null, 2));
    console.log(JSON.stringify(net, null, 2));
  } else if (process.argv[2] === 'down') {
    await stopDevnet(JSON.parse(readFileSync(stateFile, 'utf8')));
  } else throw new Error('Usage: npm run devnet -- up|down');
}
