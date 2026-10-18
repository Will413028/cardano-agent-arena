import { createConnectionObject, createInteractionContext, createChainSynchronizationClient, createLedgerStateQueryClient, getServerHealth, safeJSON } from '@cardano-ogmios/client';
const port = Number(process.argv[2]);
const connection = createConnectionObject({ host: '127.0.0.1', port });
const started = Date.now();
const health = await getServerHealth({ connection });
console.log('health', health.connectionStatus, health.lastKnownTip, health.version);
const context = await createInteractionContext(e => console.error('ctx error', e), () => {}, { connection });
const query = await createLedgerStateQueryClient(context);
const tip = await query.networkTip();
console.log('networkTip', tip);
let forwards = 0, backwards = 0, txs = 0, firstRollback = null;
await new Promise(async (resolve, reject) => {
  const sync = await createChainSynchronizationClient(context, {
    rollForward: async ({ block }, next) => {
      forwards++; txs += block.transactions?.length ?? 0;
      if (forwards >= 200) { await sync.shutdown(); return resolve(); }
      next();
    },
    rollBackward: async ({ point }, next) => { backwards++; firstRollback ??= point; next(); },
  });
  try { const i = await sync.resume(['origin'], 16); console.log('intersection', i); } catch (e) { reject(e); }
});
console.log(JSON.stringify({ forwards, backwards, firstRollback, txs, ms: Date.now() - started }));
const big = safeJSON.parse('{"ada":{"lovelace":9007199254740993}}');
console.log('bigint', typeof big.ada.lovelace, String(big.ada.lovelace), String(big.ada.lovelace) === '9007199254740993');
console.log('native JSON.parse', JSON.parse('{"x":9007199254740993}').x);
await context.shutdown?.();
process.exit(0);
