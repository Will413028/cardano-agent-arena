use aiken/collection/list
use aiken/collection/dict
use cardano/assets
use cardano/transaction.{Transaction, OutputReference}

validator thread(seed: OutputReference) {
  mint(_redeemer: Data, policy: ByteArray, tx: Transaction) {
    expect [Pair(name, quantity)] = dict.to_pairs(assets.tokens(tx.mint, policy))
    name == #"6172656e61" && quantity == 1 &&
    list.any(tx.inputs, fn(i) { i.output_reference == seed })
  }
  else(_) { False }
}
