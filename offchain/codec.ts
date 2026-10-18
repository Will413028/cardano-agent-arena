import { PlutusData, HexBlob } from '@blaze-cardano/core';
import { parse, serialize } from '@blaze-cardano/data';
import { MatchDatum, MatchRedeemer } from './generated/contract.ts';
export interface State { players: string[]; moves: number[]; policy: string; result: number }
export function encodeState(state: State): PlutusData {
  return serialize(MatchDatum, { players: state.players, moves: state.moves.map(BigInt), policy: state.policy, result: BigInt(state.result) });
}
export function encodeMove(number: number): PlutusData { return serialize(MatchRedeemer, BigInt(number)); }
export function decodeState(cbor: string): State {
  let datum: MatchDatum;
  try { datum = parse(MatchDatum, PlutusData.fromCbor(HexBlob(cbor))); } catch { throw new Error('Invalid MatchDatum constructor'); }
  const { players, moves, policy, result } = datum;
  if (players.length !== 2 || !players.every(x => /^[0-9a-f]{56}$/.test(x)) ||
      moves.length > 2 || !moves.every(x => x >= 0n && x <= 100n) ||
      !/^[0-9a-f]{56}$/.test(policy) || result < -1n || result > 2n) {
    throw new Error('Invalid MatchDatum fields');
  }
  return { players, moves: moves.map(Number), policy, result: Number(result) };
}
export function outcome(moves: number[]): number {
  if (moves.length !== 2) return -1;
  return moves[0] === moves[1] ? 2 : moves[0] > moves[1] ? 0 : 1;
}
