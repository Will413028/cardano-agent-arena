use aiken/collection/list
use aiken/cbor
use aiken/crypto
pub type Config { Config { players: List<ByteArray>, match_id: ByteArray } }
pub type Move { Move { cell: Int, signature: ByteArray } }
pub type Message { Message { match_id: ByteArray, step: Int, cell: Int } }
pub fn verify(config: Config, moves: List<Move>, step: Int, occupied: List<Int>) -> Bool {
 when moves is {
  [] -> True
  [move, ..rest] -> {
   expect Some(player) = list.at(config.players, step % 2)
   let message: Data = Message { match_id: config.match_id, step, cell: move.cell }
   move.cell >= 0 && !list.has(occupied, move.cell) &&
   crypto.verify_ed25519_signature(player, cbor.serialise(message), move.signature) &&
   verify(config, rest, step + 1, [move.cell, ..occupied])
  }
 }
}
