import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Constr, Data } from '@lucid-evolution/plutus';
import { decodeState, outcome } from '../offchain/codec.ts';
test('number game outcomes match independently specified cases', () => {
  for (const [moves, expected] of [[[], -1], [[2], -1], [[9, 2], 0], [[2, 9], 1], [[7, 7], 2]] as [number[], number][]) {
    assert.equal(outcome(moves), expected);
  }
});
test('decoder rejects invalid domain data', () => {
  const players = ['ab'.repeat(28), 'cd'.repeat(28)];
  assert.throws(() => decodeState(Data.to(new Constr(0, [players, [101n], 'ef'.repeat(28), -1n]))));
  assert.throws(() => decodeState(Data.to(new Constr(1, [players, [], 'ef'.repeat(28), -1n]))));
});
