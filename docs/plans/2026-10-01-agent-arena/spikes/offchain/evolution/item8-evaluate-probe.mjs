// Item 8c: why Kupmios evaluateTx times out — call Ogmios evaluateTransaction directly with the same tx
import { devnetChain, newKey, fund, waitTx, ogmios, j, Evo } from "./lib.mjs";
import { script, signingClient, buildMint, fixedEvaluator, showErr } from "./game.mjs";
const chain = await devnetChain(); const sc = script();
const alice = newKey("alice"), bob = newKey("bob");
const f = await fund([{ address: alice.address, lovelace: 100_000_000n }, { address: alice.address, lovelace: 100_000_000n }], chain); await waitTx(f.txHash);
const ca = signingClient(chain, alice);
const [seedUtxo] = await ca.getWalletUtxos();
const m = await buildMint({ client: ca, sc, seedUtxo, players: [alice.khHex, bob.khHex], extraOpts: { evaluator: fixedEvaluator() } });
const r = await m.build(); if (r._tag === "Left") { console.log(showErr(r.left)); process.exit(1); }
const cbor = Evo.Transaction.toCBORHex(await r.right.toTransaction());
for (const variant of ["no additionalUtxo", "additionalUtxo: [] (as SDK sends)"]) {
  const params = variant.startsWith("no") ? { transaction: { cbor } } : { transaction: { cbor }, additionalUtxo: [] };
  const t0 = Date.now();
  try { const res = await ogmios("evaluateTransaction", params); console.log(`[${variant}] ${Date.now() - t0}ms OK`, j(res)); }
  catch (e) { console.log(`[${variant}] ${Date.now() - t0}ms ERR`, e.message.slice(0, 1500)); }
}
// And via the SDK provider directly
const { provider } = await import("./lib.mjs");
const t0 = Date.now();
try { console.log("[KupmiosProvider.evaluateTx]", j(await provider().evaluateTx(await r.right.toTransaction())), `${Date.now() - t0}ms`); }
catch (e) { console.log("[KupmiosProvider.evaluateTx]", `${Date.now() - t0}ms`, showErr(e)); }
