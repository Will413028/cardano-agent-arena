import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { randomBytes, randomUUID } from 'node:crypto';
import { Core, HotSingleWallet, TxBuilder, type Kupmios, type Provider } from '@blaze-cardano/sdk';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Yaci DevKit bundles node, Ogmios and Kupo; its Kupo defaults are --since origin --match * without pruning.
export const YACI_IMAGE = 'bloxbean/yaci-cli:0.12.0';
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const run = promisify(execFile);
export async function docker(args: string[], signal?: AbortSignal): Promise<string> {
  const { stdout } = await run('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, signal: signal ?? AbortSignal.timeout(60_000) });
  return stdout.trim();
}
export interface Devnet { container: string; ogmios: string; kupo: string }
export interface OgmiosHealth { connectionStatus?: string; lastKnownTip?: { slot: number; height: number } | null }
export interface KupoHealth { most_recent_checkpoint?: number | null }
export interface Readiness { ready: boolean; ogmios?: OgmiosHealth; kupo?: KupoHealth; reason: string }
const ogmiosHttp = (net: Pick<Devnet, 'ogmios'>) => net.ogmios.replace(/^ws/, 'http');

// HTTP 200 alone is not readiness: Ogmios answers before the node has produced a block, and Kupo may lag the node tip.
export async function readiness(net: Pick<Devnet, 'ogmios' | 'kupo'>, signal?: AbortSignal): Promise<Readiness> {
  const get = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: signal ?? AbortSignal.timeout(3000) });
    return await response.json() as T;
  };
  const ogmios = await get<OgmiosHealth>(`${ogmiosHttp(net)}/health`);
  const height = ogmios.lastKnownTip?.height ?? 0;
  if (ogmios.connectionStatus !== 'connected' || height <= 0) return { ready: false, ogmios, reason: 'Ogmios has no block yet' };
  const kupo = await get<KupoHealth>(`${net.kupo}/health`);
  if ((kupo.most_recent_checkpoint ?? -1) < ogmios.lastKnownTip!.slot) return { ready: false, ogmios, kupo, reason: 'Kupo behind node tip' };
  return { ready: true, ogmios, kupo, reason: 'ready' };
}
export async function waitReady(net: Devnet, timeoutMs = 120_000): Promise<Readiness> {
  const deadline = AbortSignal.timeout(timeoutMs);
  let last: Readiness | Error = new Error('No readiness probe completed');
  while (!deadline.aborted) {
    try {
      last = await readiness(net, AbortSignal.any([deadline, AbortSignal.timeout(3000)]));
      if (last.ready) return last;
    } catch (error) { last = error instanceof Error ? error : new Error(String(error)); }
    if (await docker(['inspect', '-f', '{{.State.Status}}', net.container]) === 'exited') break;
    await sleep(500);
  }
  const logs = await docker(['logs', '--tail', '40', net.container]).catch(error => String(error));
  const probe = last instanceof Error ? last.message : `${last.reason}: ${JSON.stringify({ ogmios: last.ogmios, kupo: last.kupo })}`;
  throw new Error(`Devnet ${net.container} not ready after ${timeoutMs}ms (${probe})\n${logs}`);
}
export async function stopDevnet(net: Pick<Devnet, 'container'>): Promise<void> {
  // Only this run's uniquely named container (and its anonymous volumes) is removed.
  await docker(['rm', '-f', '-v', net.container]).catch(() => undefined);
}
export async function startDevnet(): Promise<Devnet> {
  const net: Devnet = { container: `arena-devnet-${randomUUID().slice(0, 8)}`, ogmios: '', kupo: '' };
  try {
    await docker(['run', '-d', '--name', net.container, '--label', 'arena.scope=devnet',
      '-p', '127.0.0.1::1337', '-p', '127.0.0.1::1442', '--entrypoint', '/app/yaci-cli', YACI_IMAGE, 'up', '--enable-kupomios']);
    const port = async (inner: number) => (await docker(['port', net.container, `${inner}/tcp`])).split('\n')[0].split(':').at(-1);
    net.ogmios = `ws://127.0.0.1:${await port(1337)}`;
    net.kupo = `http://127.0.0.1:${await port(1442)}`;
    await waitReady(net);
    return net;
  } catch (error) { await stopDevnet(net); throw error; }
}

// Ephemeral player keys exist only in this process; they are never written to disk.
export function ephemeralWallet(provider: Provider): HotSingleWallet {
  return new HotSingleWallet(Core.Ed25519PrivateNormalKeyHex(randomBytes(32).toString('hex')), Core.NetworkId.Testnet, provider);
}
// Yaci DevKit's public default test mnemonic (account 2), funded in its genesis. Public, not a secret.
const FAUCET_MNEMONIC = 'test test test test test test test test test test test test test test test test test test test test test test test sauce';
async function faucet() {
  await Core.initCrypto();
  const hard = (n: number) => n + 0x80000000;
  const account = Core.Bip32PrivateKey.fromBip39Entropy(Buffer.from(Core.mnemonicToEntropy(FAUCET_MNEMONIC, Core.wordlist)), '')
    .derive([hard(1852), hard(1815), hard(2)]);
  const payment = account.derive([0, 0]);
  const address = new Core.Address({ type: Core.AddressType.BasePaymentKeyStakeKey, networkId: Core.NetworkId.Testnet,
    paymentPart: { type: Core.CredentialType.KeyHash, hash: payment.toPublic().toRawKey().hash().hex() },
    delegationPart: { type: Core.CredentialType.KeyHash, hash: account.derive([2, 0]).toPublic().toRawKey().hash().hex() } });
  return { address, key: payment.toRawKey() };
}
// Yaci's topup REST fails in Docker mode and Kupo does not index genesis UTxOs, so the faucet reads its UTxOs from Ogmios.
export async function fund(provider: Kupmios, payouts: Array<{ address: Core.Address; lovelace: bigint }>): Promise<string> {
  const { address, key } = await faucet();
  const utxos = (await provider.ogmios.queryLedgerStateUtxo({ addresses: [address.toBech32()] }))
    .filter(utxo => Object.keys(utxo.value).length === 1 && !utxo.datum && !utxo.script)
    .sort((a, b) => Number(BigInt(b.value.ada.lovelace) - BigInt(a.value.ada.lovelace)));
  if (!utxos.length) throw new Error(`Faucet ${address.toBech32()} has no ADA-only UTxO`);
  const input = new Core.TransactionUnspentOutput(
    new Core.TransactionInput(Core.TransactionId(utxos[0].transaction.id), BigInt(utxos[0].index)),
    new Core.TransactionOutput(address, new Core.Value(BigInt(utxos[0].value.ada.lovelace))));
  let builder = new TxBuilder(await provider.getParameters()).setNetworkId(Core.NetworkId.Testnet).setChangeAddress(address).addInput(input);
  for (const payout of payouts) builder = builder.payLovelace(payout.address, payout.lovelace);
  const tx = await builder.complete({ useCoinSelection: false });
  const witnesses = tx.witnessSet();
  witnesses.setVkeys(Core.CborSet.fromCore([[key.toPublic().hex(), key.sign(Core.HexBlob(tx.getId())).hex()]], Core.VkeyWitness.fromCore));
  tx.setWitnessSet(witnesses);
  return await provider.postTransactionToChain(tx);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // One manual session per checkout; parallel instances belong to tests, which keep their handles in memory.
  const stateFile = join(ROOT, '.local/devnet-session.json');
  if (process.argv[2] === 'up') {
    if (existsSync(stateFile)) throw new Error(`A manual devnet session exists (${stateFile}); run make devnet-down first`);
    mkdirSync(dirname(stateFile), { recursive: true });
    const net = await startDevnet();
    writeFileSync(stateFile, JSON.stringify(net, null, 2));
    console.log(JSON.stringify(net, null, 2));
  } else if (process.argv[2] === 'down') {
    await stopDevnet(JSON.parse(readFileSync(stateFile, 'utf8')));
    rmSync(stateFile);
  } else throw new Error('Usage: npm run devnet -- up|down');
}
