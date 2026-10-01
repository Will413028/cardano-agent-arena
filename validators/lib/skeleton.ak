use aiken/collection/list

pub type MatchDatum {
  MatchDatum {
    players: List<ByteArray>,
    moves: List<Int>,
    policy: ByteArray,
    result: Int,
  }
}

pub fn outcome(moves: List<Int>) -> Int {
  when moves is {
    [alice, bob] -> if alice > bob { 0 } else if bob > alice { 1 } else { 2 }
    _ -> -1
  }
}

pub fn advance(state: MatchDatum, number: Int) -> MatchDatum {
  let moves = list.concat(state.moves, [number])
  MatchDatum { ..state, moves, result: outcome(moves) }
}

test alice_wins() { outcome([9, 2]) == 0 }
test bob_wins() { outcome([2, 9]) == 1 }
test draw() { outcome([4, 4]) == 2 }
test in_progress() { outcome([4]) == -1 }
