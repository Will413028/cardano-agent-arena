import { readChain, transactions } from '../offchain/chain.ts';
import { historyFromChain } from '../offchain/history.ts';
import { outcome } from '../offchain/codec.ts';
export async function replay(endpoint: string, matchId: string) {
  const all = transactions(await readChain(endpoint));
  const history = historyFromChain(all, matchId);
  for (let i = 1; i < history.states.length; i++) {
    const before = history.states[i - 1].state;
    const after = history.states[i].state;
    const tx = all.find(tx => tx.id === history.states[i].txId)!;
    if (before.moves.length >= 2 || before.result !== -1 || after.moves.length !== before.moves.length + 1 ||
        after.policy !== before.policy || JSON.stringify(after.players) !== JSON.stringify(before.players) ||
        !before.moves.every((number, index) => after.moves[index] === number) ||
        !tx.extraSignatories?.includes(before.players[before.moves.length])) throw new Error('Illegal state transition');
    if (after.result !== outcome(after.moves)) throw new Error('On-chain result disagrees with replay');
  }
  const final = history.states.at(-1)!;
  const result = outcome(final.state.moves);
  if (final.state.result !== result) throw new Error('Invalid terminal result');
  return { matchId, game: 'skeleton-numbers-v0', moves: final.state.moves, result,
    transactionIds: history.states.map(s => s.txId) };
}
if (process.argv[1]?.endsWith('/verifier/cli.ts')) {
  const [command, matchId, endpoint] = process.argv.slice(2);
  if (command !== 'replay' || !matchId || !endpoint) throw new Error('Usage: npm run verifier -- replay <match-id> <ogmios-ws>');
  console.log(JSON.stringify(await replay(endpoint, matchId), null, 2));
}
