import { fund, devnetChain, newKey, waitTx, kupoMatches, j } from "./lib.mjs";
const chain = await devnetChain();
const a = newKey("smoke");
const r = await fund([{ address: a.address, lovelace: 20_000_000n }], chain);
console.log(r);
await waitTx(r.txHash);
console.log(j((await kupoMatches(a.bech32)).map(m => [m.transaction_id, m.output_index, m.value.coins])));
