import { Constr, Data } from '@lucid-evolution/plutus';
import type { MatchDatum, MatchRedeemer } from './generated/contract.ts';
export interface State { players: string[]; moves: number[]; policy: string; result: number }
export function encodeState(state: State): MatchDatum {
  return { constructor: 0, fields: [
    { list: state.players.map(bytes => ({ bytes })) },
    { list: state.moves.map(int => ({ int })) },
    { bytes: state.policy }, { int: state.result },
  ] };
}
export function encodeMove(number: number): MatchRedeemer { return { int: number }; }
export function decodeState(cbor: string): State {
  const datum = Data.from(cbor);
  if (!(datum instanceof Constr) || datum.index !== 0 || datum.fields.length !== 4) throw new Error('Invalid MatchDatum constructor');
  const [players, moves, policy, result] = datum.fields;
  if (!Array.isArray(players) || players.length !== 2 || !players.every(x => typeof x === 'string' && /^[0-9a-f]{56}$/.test(x)) ||
      !Array.isArray(moves) || moves.length > 2 || !moves.every(x => typeof x === 'bigint' && x >= 0n && x <= 100n) ||
      typeof policy !== 'string' || !/^[0-9a-f]{56}$/.test(policy) || typeof result !== 'bigint' || result < -1n || result > 2n) {
    throw new Error('Invalid MatchDatum fields');
  }
  return { players: players as string[], moves: (moves as bigint[]).map(Number), policy, result: Number(result) };
}
export function outcome(moves: number[]): number {
  if (moves.length !== 2) return -1;
  return moves[0] === moves[1] ? 2 : moves[0] > moves[1] ? 0 : 1;
}
