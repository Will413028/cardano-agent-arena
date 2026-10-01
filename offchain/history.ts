import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Constr, Data } from '@lucid-evolution/plutus';
import { bech32 } from '@scure/base';
import { decodeState, type State } from './codec.ts';
import type { ChainTransaction, ChainOutput } from './chain.ts';
export const TOKEN_NAME = '6172656e61';
export interface MatchHistory { matchId: string; address: string; states: Array<{ txId: string; outputIndex: number; state: State }> }
export function scriptAddress(): string {
  const blueprint = JSON.parse(readFileSync(fileURLToPath(new URL('../validators/plutus.json', import.meta.url)), 'utf8'));
  const script = blueprint.validators.find((v: { title: string }) => v.title === 'match.match.spend');
  if (!script) throw new Error('Match validator missing from blueprint');
  return bech32.encode('addr_test', bech32.toWords(Buffer.from(`70${script.hash}`, 'hex')), 200);
}
function hasToken(output: ChainOutput, policy: string) { return output.value[policy]?.[TOKEN_NAME] === 1; }
function authenticPolicy(creation: ChainTransaction, policy: string): boolean {
  const root = fileURLToPath(new URL('../', import.meta.url));
  mkdirSync(join(root, '.local'), { recursive: true });
  const scratch = mkdtempSync(join(root, '.local/verifier-policy-'));
  try {
    return creation.inputs.some(input => {
      const output = join(scratch, 'applied.json');
      execFileSync(join(root, 'node_modules/.bin/aiken'), ['blueprint', 'apply', '-i', join(root, 'validators/plutus.json'),
        '-m', 'thread', '-v', 'thread', '-o', output, Data.to(new Constr(0, [input.transaction.id, BigInt(input.index)]))], { stdio: 'pipe' });
      const applied = JSON.parse(readFileSync(output, 'utf8'));
      return applied.validators.find((v: { title: string }) => v.title === 'thread.thread.mint')?.hash === policy;
    });
  } finally { rmSync(scratch, { recursive: true }); }
}
export function historyFromChain(all: ChainTransaction[], matchId: string): MatchHistory {
  if (!/^[0-9a-f]{64}$/.test(matchId)) throw new Error('match-id must be a transaction hash');
  const address = scriptAddress();
  const creation = all.find(tx => tx.id === matchId);
  if (!creation) throw new Error('Match creation transaction not found on chain');
  const initialOutputs = creation.outputs.flatMap((output, index) => {
    if (output.address !== address || !output.datum) return [];
    const state = decodeState(output.datum);
    return hasToken(output, state.policy) ? [{ txId: creation.id, outputIndex: index, state }] : [];
  });
  if (initialOutputs.length !== 1) throw new Error('Expected one initial match state');
  const initial = initialOutputs[0];
  if (initial.state.moves.length !== 0 || initial.state.result !== -1 || creation.mint?.[initial.state.policy]?.[TOKEN_NAME] !== 1 ||
      !authenticPolicy(creation, initial.state.policy)) {
    throw new Error('Invalid match creation state or mint');
  }
  const states = [initial];
  for (const tx of all.slice(all.indexOf(creation) + 1)) {
    const previous = states.at(-1)!;
    if (!tx.inputs.some(input => input.transaction.id === previous.txId && input.index === previous.outputIndex)) continue;
    const next = tx.outputs.flatMap((output, index) => output.address === address && output.datum && hasToken(output, initial.state.policy)
      ? [{ txId: tx.id, outputIndex: index, state: decodeState(output.datum) }] : []);
    if (next.length !== 1) throw new Error('Invalid state successor');
    states.push(next[0]);
  }
  return { matchId, address, states };
}
