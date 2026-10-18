use aiken/cbor
use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{blake2b_256}
use cardano/address.{Script}
use cardano/assets
use cardano/transaction.{InlineDatum, OutputReference, Transaction}

pub type Datum {
  players: List<ByteArray>,
  moves: List<Int>,
  name: ByteArray,
  result: Int,
}

pub fn thread_name(seed: OutputReference) -> ByteArray {
  blake2b_256(cbor.serialise(seed))
}

validator spike {
  mint(seed: OutputReference, policy: ByteArray, tx: Transaction) {
    let name = thread_name(seed)
    expect [Pair(minted, quantity)] = dict.to_pairs(assets.tokens(tx.mint, policy))
    expect minted == name && quantity == 1
    expect list.any(tx.inputs, fn(i) { i.output_reference == seed })
    expect [out] =
      list.filter(tx.outputs, fn(o) { assets.quantity_of(o.value, policy, name) == 1 })
    expect out.address.payment_credential == Script(policy)
    expect InlineDatum(raw) = out.datum
    expect d: Datum = raw
    d.name == name && d.moves == [] && d.result == -1 && list.length(d.players) == 2
  }

  spend(datum: Option<Datum>, number: Int, ref: OutputReference, tx: Transaction) {
    expect Some(state) = datum
    expect Some(input) = list.find(tx.inputs, fn(i) { i.output_reference == ref })
    expect Script(own) = input.output.address.payment_credential
    expect Some(player) = list.at(state.players, list.length(state.moves))
    expect [output] = list.filter(tx.outputs, fn(o) { o.address == input.output.address })
    expect InlineDatum(raw) = output.datum
    expect next: Datum = raw
    and {
      assets.quantity_of(input.output.value, own, state.name) == 1,
      assets.quantity_of(output.value, own, state.name) == 1,
      list.has(tx.extra_signatories, player),
      next == Datum { ..state, moves: list.concat(state.moves, [number]) },
    }
  }

  else(_) {
    False
  }
}

test thread_name_vector() {
  let seed =
    OutputReference {
      transaction_id: #"0000000000000000000000000000000000000000000000000000000000000001",
      output_index: 2,
    }
  trace cbor.serialise(seed)
  trace thread_name(seed)
  True
}
