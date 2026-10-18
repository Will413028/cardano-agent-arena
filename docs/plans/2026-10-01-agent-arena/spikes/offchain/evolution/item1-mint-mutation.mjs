// Item 1 mutation: arbitrary token name. Correct blueprint must REJECT; mutant (no name check) must ACCEPT.
import { devnetChain, newKey, fund, waitTx, kupoMatches, ogmios, j, Evo } from "./lib.mjs";
import { script, signingClient, buildMint, threadName, fixedEvaluator, showErr } from "./game.mjs";
const buildRetry = async (m) => { for (let i = 0; i < 3; i++) { const r = await m.build(); if (r._tag === "Right" || !/timed out/.test(showErr(r.left))) return r; console.log("  (Kupmios 10s evaluateTx timeout, retrying)"); } return m.build(); };
const chain = await devnetChain();
const good = script(), mutant = script("plutus.mutant-no-name-check.json");
console.log("correct policy", good.policyHex, "mutant policy", mutant.policyHex);
const alice = newKey("alice"), bob = newKey("bob");
const f = await fund([alice, alice, alice, alice].map((k) => ({ address: k.address, lovelace: 100_000_000n })), chain); await waitTx(f.txHash);
const ca = signingClient(chain, alice);
const ARB = "deadbeef";
const utxos = await ca.getWalletUtxos();
const res = {};
// A) correct blueprint, arbitrary token name, datum name = real thread name
{
  const seed = utxos[0];
  const m = await buildMint({ client: ca, sc: good, seedUtxo: seed, players: [alice.khHex, bob.khHex], tokenName: ARB, datumName: threadName(seed) });
  const r = await buildRetry(m);
  console.log("[A correct, provider eval]", r._tag === "Left" ? "REJECTED at build:\n" + showErr(r.left) : "ACCEPTED (unexpected)");
  const mf = await buildMint({ client: ca, sc: good, seedUtxo: seed, players: [alice.khHex, bob.khHex], tokenName: ARB, datumName: threadName(seed), extraOpts: { evaluator: fixedEvaluator() } });
  const rf = await mf.build();
  const sb = await rf.right.sign();
  let forced;
  try { await sb.submit(); forced = "ACCEPTED (unexpected)"; } catch (e) { forced = "REJECTED at submit: " + showErr(e).slice(0, 700); }
  console.log("[A correct, eval bypassed, force submit]", forced);
  res.A = r._tag === "Left" && forced.startsWith("REJECTED") && /3136/.test(forced);
}
// B) mutant blueprint, same shape
for (const [label, datumName, tok] of [["token = arbitrary, datum name = thread name", (s) => threadName(s), () => ARB], ["token = arbitrary, datum name = arbitrary", () => ARB, () => ARB], ["CONTROL: fully valid shape (token = datum name = thread name)", (s) => threadName(s), (s) => threadName(s)]]) {
  const fresh = (await ca.getWalletUtxos()).find((u) => !u.assets.multiAsset);
  const m = await buildMint({ client: ca, sc: mutant, seedUtxo: fresh, players: [alice.khHex, bob.khHex], tokenName: tok(fresh), datumName: datumName(fresh) });
  const r = await buildRetry(m);
  if (r._tag === "Left") { console.log(`[B mutant, ${label}] REJECTED at build:\n` + showErr(r.left)); continue; }
  const h = Evo.TransactionHash.toHex(await r.right.signAndSubmit()); await waitTx(h);
  const km = await kupoMatches(`${mutant.policyHex}.${tok(fresh)}`);
  console.log(`[B mutant, ${label}] ACCEPTED tx ${h}; kupo:`, km.map((x) => `${x.transaction_id}#${x.output_index} ${x.address} ${JSON.stringify(x.value.assets)}`));
  if (tok(fresh) === ARB) { res.B = km.some((x) => x.transaction_id === h); break; } else res.control = km.some((x) => x.transaction_id === h);
}
console.log(`\nMINT-MUTATION correct-rejects=${res.A} mutant-accepts-arbitrary=${res.B} mutant-accepts-valid-control=${res.control} => ${res.A && res.B ? "PASS" : "FAIL"}`);
