// Item 8b: why does Kupmios.evaluateTx fail? Same tx: raw Ogmios vs Kupmios.evaluateTx.
import { Kupmios } from "@lucid-evolution/lucid";
import { KUPO, OGMIOS, makeDevnetLucid, fundFromFaucet, newKey, loadScript, threadName, datumCbor, Data, Constr, toUnit, ogmios } from "./lib.mjs";
const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const { lucid } = await makeDevnetLucid();
const alice = newKey("alice"), bob = newKey("bob");
await fundFromFaucet(lucid, [alice.addr], 50_000_000n);
const { script, policyId, address } = loadScript("correct");
lucid.selectWallet.fromPrivateKey(alice.sk);
const seed = (await lucid.wallet().getUtxos())[0];
const name = threadName(seed.txHash, seed.outputIndex);
const unit = toUnit(policyId, name);
const tx = await lucid.newTx().collectFrom([seed])
  .mintAssets({ [unit]: 1n }, Data.to(new Constr(0, [seed.txHash, BigInt(seed.outputIndex)])))
  .attach.MintingPolicy(script)
  .pay.ToContract(address, { kind: "inline", value: datumCbor({ players: [alice.pkh, bob.pkh], moves: [], name, result: -1n }) }, { [unit]: 1n, lovelace: 2_000_000n })
  .complete(); // local eval
const cbor = tx.toCBOR();
try { log("raw ogmios evaluateTransaction:", JSON.stringify(await ogmios("evaluateTransaction", { transaction: { cbor } }))); }
catch (e) { log("raw ogmios error:", JSON.stringify(e.rpc)); }
const raw = await (await fetch(OGMIOS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "evaluateTransaction", params: { transaction: { cbor }, additionalUtxo: [] }, id: null }) })).text();
log("raw ogmios with additionalUtxo:[] and id:null (Kupmios request shape):", raw.slice(0, 800));
try { log("Kupmios.evaluateTx:", JSON.stringify(await new Kupmios(KUPO, OGMIOS).evaluateTx(cbor))); }
catch (e) {
  let c = e, d = 0;
  while (c && d < 6) { log(`cause[${d}]`, c?.name, String(c?.message).slice(0, 600)); if (c?.body || c?.cause?.body) log("  body:", JSON.stringify(c.body ?? c.cause.body).slice(0, 800)); c = c.cause; d++; }
}
