use aiken/collection/list
use aiken/collection/dict
use cardano/assets.{PolicyId}
use cardano/assets
use cardano/transaction.{Transaction, OutputReference, InlineDatum}

pub type Board {
 Board { occupied: List<Int>, turn: Int, players: List<ByteArray>, policy: PolicyId }
}

validator authenticated {
 spend(datum: Option<Board>, cell: Int, ref: OutputReference, tx: Transaction) {
  expect Some(state) = datum
  expect Some(player) = list.at(state.players, state.turn)
  expect Some(input) = list.find(tx.inputs, fn(i) { i.output_reference == ref })
  expect [output] = list.filter(tx.outputs, fn(o) { o.address == input.output.address })
  expect InlineDatum(raw) = output.datum
  expect next: Board = raw
  cell >= 0 && cell < 25 && !list.has(state.occupied, cell) &&
  list.has(tx.extra_signatories, player) &&
  assets.quantity_of(input.output.value, state.policy, #"6172656e61") == 1 &&
  assets.quantity_of(output.value, state.policy, #"6172656e61") == 1 &&
  next == Board { ..state, occupied: [cell, ..state.occupied], turn: 1 - state.turn }
 }
 else(_) { False }
}

validator thread(seed: OutputReference) {
 mint(_redeemer: Data, policy: PolicyId, tx: Transaction) {
  expect [Pair(name, quantity)] = dict.to_pairs(assets.tokens(tx.mint, policy))
  name == #"6172656e61" && quantity == 1 &&
  list.any(tx.inputs, fn(i) { i.output_reference == seed })
 }
 else(_) { False }
}
