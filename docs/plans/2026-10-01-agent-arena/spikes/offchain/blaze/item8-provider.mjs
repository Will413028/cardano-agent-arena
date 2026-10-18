// Item 8: Blaze's own Kupmios provider against the Yaci devnet, no response patching.
import { devnetProvider, faucet, j, errText, log, loadScript } from "./lib.mjs";

const out = [];
const p = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : j(x))).join(" "); console.log(s); out.push(s); };
const provider = await devnetProvider();
p("network", provider.network, provider.networkName);
async function probe(name, fn) {
  const t = Date.now();
  try { const r = await fn(); p(`PASS ${name} (${Date.now() - t} ms):`, r); }
  catch (e) { p(`FAIL ${name} (${Date.now() - t} ms):`, errText(e)); }
}
await probe("getParameters", async () => {
  const pp = await provider.getParameters();
  return { protocolVersion: pp.protocolVersion, costModelLens: [...pp.costModels.entries()].map(([k, v]) => [k, v.length]),
    minFeeReferenceScripts: pp.minFeeReferenceScripts, maxTxSize: pp.maxTxSize, coinsPerUtxoByte: pp.coinsPerUtxoByte, prices: pp.prices };
});
const f = await faucet();
await probe("getUnspentOutputs(faucet) [Kupo; genesis utxo expected missing]", async () =>
  (await provider.getUnspentOutputs(f.address)).map((u) => [u.input().transactionId(), String(u.input().index()), String(u.output().amount().coin())]));
await probe("getUnspentOutputs(script address)", async () => (await provider.getUnspentOutputs(loadScript().address)).length + " utxos");
await probe("getSlotConfig", async () => provider.getSlotConfig());
p("Note: evaluateTransaction / postTransactionToChain / awaitTransactionConfirmation are exercised in item1-devnet.mjs");
log("item8-provider.txt", "$ node item8-provider.mjs\n" + out.join("\n") + "\n");
process.exit(0);
