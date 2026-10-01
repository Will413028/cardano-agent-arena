use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference, InlineDatum}

pub type Board {
  Board { occupied: List<Int>, turn: Int }
}

pub fn legal(board: Board, cell: Int) -> Bool {
  cell >= 0 && cell < 25 && !list.has(board.occupied, cell)
}

validator arena {
  spend(datum: Option<Board>, cell: Int, ref: OutputReference, tx: Transaction) {
    expect Some(state) = datum
    expect Some(input) = list.find(tx.inputs, fn(i) { i.output_reference == ref })
    expect [output] = list.filter(tx.outputs, fn(o) { o.address == input.output.address })
    expect InlineDatum(raw) = output.datum
    expect next: Board = raw
    legal(state, cell) && next == Board { occupied: [cell, ..state.occupied], turn: 1 - state.turn }
  }
  else(_) { False }
}

test empty_cell() { legal(Board { occupied: [0], turn: 1 }, 1) }
test occupied_cell_rejected() { !legal(Board { occupied: [0], turn: 1 }, 0) }
test outside_board_rejected() { !legal(Board { occupied: [], turn: 0 }, 25) }
