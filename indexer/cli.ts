import { writeFileSync } from 'node:fs';
import { readChain, transactions } from '../offchain/chain.ts';
import { historyFromChain } from '../offchain/history.ts';
export async function indexMatch(endpoint: string, matchId: string) {
  const history = historyFromChain(transactions(await readChain(endpoint)), matchId);
  const final = history.states.at(-1)!;
  return { matchId, game: 'skeleton-numbers-v0', moves: final.state.moves, result: final.state.result,
    transactionIds: history.states.map(s => s.txId) };
}
if (process.argv[1]?.endsWith('/indexer/cli.ts')) {
  const [endpoint, matchId, file] = process.argv.slice(2);
  if (!endpoint || !matchId || !file) throw new Error('Usage: npm run index -- <ogmios-ws> <match-id> <output.json>');
  writeFileSync(file, JSON.stringify(await indexMatch(endpoint, matchId), null, 2));
}
