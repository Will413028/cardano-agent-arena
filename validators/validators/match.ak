use aiken/collection/list
use cardano/assets
use cardano/transaction.{Transaction, OutputReference, InlineDatum}
use skeleton.{MatchDatum, advance}

validator match {
  spend(datum: Option<MatchDatum>, number: Int, ref: OutputReference, tx: Transaction) {
    expect Some(state) = datum
    expect Some(player) = list.at(state.players, list.length(state.moves))
    expect Some(input) = list.find(tx.inputs, fn(i) { i.output_reference == ref })
    expect [output] = list.filter(tx.outputs, fn(o) { o.address == input.output.address })
    expect InlineDatum(raw) = output.datum
    expect next: MatchDatum = raw
    list.length(state.players) == 2 && list.length(state.moves) < 2 &&
    state.result == -1 && number >= 0 && number <= 100 &&
    list.has(tx.extra_signatories, player) &&
    assets.quantity_of(input.output.value, state.policy, #"6172656e61") == 1 &&
    assets.quantity_of(output.value, state.policy, #"6172656e61") == 1 &&
    next == advance(state, number)
  }
  else(_) { False }
}
