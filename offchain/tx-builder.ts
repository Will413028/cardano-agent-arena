import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Constr, Data } from '@lucid-evolution/plutus';
import { ROOT, cli, put, sleep, type Devnet } from '../scripts/devnet.ts';
import { encodeState, encodeMove, outcome, type State } from './codec.ts';
interface UTxO { value: { lovelace: number } }
function utxos(net: Devnet, address: string): Record<string, UTxO> {
  return JSON.parse(cli(net, 'query', 'utxo', '--testnet-magic', '42', '--address', address, '--out-file', '/dev/stdout'));
}
function largest(funds: Record<string, UTxO>): string {
  const rows = Object.entries(funds).sort((a, b) => b[1].value.lovelace - a[1].value.lovelace);
  if (!rows.length) throw new Error('No funding UTxO');
  return rows[0][0];
}
async function signSubmit(net: Devnet, name: string, actor: string): Promise<string> {
  cli(net, 'transaction', 'sign', '--testnet-magic', '42', '--tx-body-file', `/devnet/${name}.body`,
    '--signing-key-file', `/devnet/credentials/${actor}.sk`, '--out-file', `/devnet/${name}.signed`);
  const raw = cli(net, 'transaction', 'txid', '--tx-file', `/devnet/${name}.signed`);
  const txid = raw.startsWith('{') ? JSON.parse(raw).txhash : raw;
  cli(net, 'transaction', 'submit', '--testnet-magic', '42', '--tx-file', `/devnet/${name}.signed`);
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const found = JSON.parse(cli(net, 'query', 'utxo', '--testnet-magic', '42', '--tx-in', `${txid}#0`, '--out-file', '/dev/stdout'));
    if (Object.keys(found).length) return txid;
  }
  throw new Error('Transaction confirmation timeout');
}
export interface SkeletonMatch {
  matchId: string; stateRef: string; address: string; unit: string; state: State;
  players: Array<{ name: string; address: string; keyHash: string; collateral: string }>;
}
export async function createMatch(net: Devnet): Promise<SkeletonMatch> {
  const faucet = cli(net, 'address', 'build', '--testnet-magic', '42', '--payment-verification-key-file', '/devnet/credentials/faucet.vk');
  const seed = largest(utxos(net, faucet));
  // Create explicit collateral and player funding before the script-mint transaction.
  const players = ['alice', 'bob'].map(name => ({ name,
    address: cli(net, 'address', 'build', '--testnet-magic', '42', '--payment-verification-key-file', `/devnet/credentials/${name}.vk`),
    keyHash: cli(net, 'address', 'key-hash', '--payment-verification-key-file', `/devnet/credentials/${name}.vk`), collateral: '' }));
  cli(net, 'transaction', 'build', '--testnet-magic', '42', '--tx-in', seed,
    '--tx-out', `${faucet}+10000000`, '--tx-out', `${players[0].address}+100000000`,
    '--tx-out', `${players[1].address}+100000000`, '--tx-out', `${players[0].address}+10000000`,
    '--tx-out', `${players[1].address}+10000000`, '--change-address', faucet, '--out-file', '/devnet/fund.body');
  const fundingId = await signSubmit(net, 'fund', 'faucet');
  players.forEach((player, i) => { player.collateral = `${fundingId}#${i + 3}`; });
  const mintSeed = largest(utxos(net, faucet));
  const [hash, index] = mintSeed.split('#');
  const blueprintPath = join(ROOT, 'validators/plutus.json');
  const appliedPath = join(net.directory, 'thread-applied.json');
  execFileSync(join(ROOT, 'node_modules/.bin/aiken'), ['blueprint', 'apply', '-i', blueprintPath,
    '-m', 'thread', '-v', 'thread', '-o', appliedPath, Data.to(new Constr(0, [hash, BigInt(index)]))]);
  const blueprint = JSON.parse(readFileSync(blueprintPath, 'utf8'));
  const applied = JSON.parse(readFileSync(appliedPath, 'utf8'));
  const exportScript = (title: string, name: string, source: typeof blueprint) => {
    const script = source.validators.find((v: { title: string }) => v.title === title);
    if (!script) throw new Error(`Blueprint validator missing: ${title}`);
    return put(net, name, { type: 'PlutusScriptV3', description: 'devnet walking skeleton', cborHex: script.compiledCode });
  };
  const thread = exportScript('thread.thread.mint', 'thread.plutus', applied);
  const validator = exportScript('match.match.spend', 'match.plutus', blueprint);
  const policy = cli(net, 'transaction', 'policyid', '--script-file', thread);
  const unit = `${policy}.6172656e61`;
  const address = cli(net, 'address', 'build', '--testnet-magic', '42', '--payment-script-file', validator);
  const state: State = { players: players.map(p => p.keyHash), moves: [], policy, result: -1 };
  cli(net, 'transaction', 'build', '--testnet-magic', '42', '--tx-in', mintSeed,
    '--tx-in-collateral', `${fundingId}#0`, '--mint', `1 ${unit}`, '--mint-script-file', thread,
    '--mint-redeemer-file', put(net, 'unit.json', { constructor: 0, fields: [] }),
    '--tx-out', `${address}+3000000+1 ${unit}`, '--tx-out-inline-datum-file', put(net, 'initial.json', encodeState(state)),
    '--change-address', faucet, '--out-file', '/devnet/create.body');
  const matchId = await signSubmit(net, 'create', 'faucet');
  return { matchId, stateRef: `${matchId}#0`, address, unit, state, players };
}

export async function move(net: Devnet, match: SkeletonMatch, number: number, overrides: { signer?: number; claimedResult?: number; expectReject?: boolean } = {}) {
  const turn = match.state.moves.length;
  const player = match.players[turn];
  if (!player) throw new Error('Match is terminal');
  const funding = largest(Object.fromEntries(Object.entries(utxos(net, player.address)).filter(([ref]) => ref !== player.collateral)));
  const moves = [...match.state.moves, number];
  const next: State = { ...match.state, moves, result: overrides.claimedResult ?? outcome(moves) };
  const args = ['transaction', 'build', '--testnet-magic', '42', '--tx-in', funding, '--tx-in', match.stateRef,
    '--tx-in-script-file', '/devnet/match.plutus', '--tx-in-inline-datum-present',
    '--tx-in-redeemer-file', put(net, `move-${turn}.json`, encodeMove(number)), '--tx-in-collateral', player.collateral,
    '--required-signer-hash', match.players[overrides.signer ?? turn].keyHash,
    '--tx-out', `${match.address}+3000000+1 ${match.unit}`,
    '--tx-out-inline-datum-file', put(net, `state-${turn}.json`, encodeState(next)),
    '--change-address', player.address, '--out-file', `/devnet/move-${turn}.body`];
  if (overrides.expectReject) {
    try { cli(net, ...args); } catch (error) {
      const stderr = (error as { stderr?: Buffer | string }).stderr;
      const message = stderr === undefined ? '' : String(stderr);
      if (!/following scripts have execution failures|ScriptEvaluationFailed|ScriptWitnessNotValidating|ValidationTagMismatch/i.test(message)) throw error;
      return { rejected: true, message };
    }
    throw new Error('Illegal transaction unexpectedly accepted');
  }
  cli(net, ...args);
  const txId = await signSubmit(net, `move-${turn}`, player.name);
  match.stateRef = `${txId}#0`; match.state = next;
  return { rejected: false, txId };
}
