use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference, InlineDatum}
pub type Board { Board { occupied: List<Int>, turn: Int } }
validator latency {
 spend(datum: Option<Board>, cell: Int, ref: OutputReference, tx: Transaction) {
  expect Some(state) = datum
  if cell == -1 { list.length(state.occupied) == 20 } else {
   expect Some(input) = list.find(tx.inputs, fn(i) { i.output_reference == ref })
   expect [output] = list.filter(tx.outputs, fn(o) { o.address == input.output.address })
   expect InlineDatum(raw) = output.datum
   expect next: Board = raw
   cell >= 0 && cell < 25 && !list.has(state.occupied, cell) &&
   next == Board { occupied: [cell, ..state.occupied], turn: 1 - state.turn }
  }
 }
 else(_) { False }
}
