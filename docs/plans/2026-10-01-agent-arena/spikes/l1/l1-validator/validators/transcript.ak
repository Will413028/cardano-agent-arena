use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference}
use transcript_rules.{Config, Move, verify}
validator transcript {
 spend(datum: Option<Config>, moves: List<Move>, _ref: OutputReference, _tx: Transaction) {
  expect Some(config) = datum
  list.length(config.players) == 2 && verify(config, moves, 0, [])
 }
 else(_) { False }
}
