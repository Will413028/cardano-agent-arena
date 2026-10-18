// Item 2: illegal first move by bob rejected at build time (provider evaluation via Ogmios).
// Item 3: same tx with evaluation bypassed (fixed ex-units evaluator) force-submitted to Ogmios -> phase-2 rejection.
//         Mutation: same tx shape by alice (correct player) with the same bypass is accepted.
import { devnetChain, newKey, fund, waitTx, kupoMatches, ogmios, provider, j, Evo } from "./lib.mjs";
import { script, signingClient, buildMint, buildMove, fixedEvaluator, showErr } from "./game.mjs";
const chain = await devnetChain(); const sc = script();
const alice = newKey("alice"), bob = newKey("bob");
console.log("alice", alice.khHex, "bob", bob.khHex);
const f = await fund([alice, alice, bob, bob].map((k) => ({ address: k.address, lovelace: 100_000_000n })), chain); await waitTx(f.txHash);
const ca = signingClient(chain, alice), cb = signingClient(chain, bob);
const [seedUtxo] = await ca.getWalletUtxos();
const m = await buildMint({ client: ca, sc, seedUtxo, players: [alice.khHex, bob.khHex] });
const rm = await m.build(); if (rm._tag === "Left") { console.log(showErr(rm.left)); process.exit(1); }
const mintHash = Evo.TransactionHash.toHex(await rm.right.signAndSubmit()); await waitTx(mintHash);
console.log("thread minted", mintHash, m.name);
const [scriptUtxo] = (await ca.getUtxos(sc.address)).filter((u) => Evo.TransactionHash.toHex(u.transactionId) === mintHash);
const state = { players: [alice.khHex, bob.khHex], moves: [], name: m.name, result: -1 };

console.log("\n=== Item 2: bob first move, provider (Ogmios) evaluation at build time ===");
const b2 = await buildMove({ client: cb, sc, scriptUtxo, state, number: 7, signerKh: bob.kh });
const r2 = await b2.build();
console.log(r2._tag === "Left" ? "build rejected (expected):\n" + showErr(r2.left) : "UNEXPECTED: build succeeded");
const item2 = r2._tag === "Left" && /script|evaluat/i.test(showErr(r2.left));

console.log("\n=== Item 3: bob first move, evaluation bypassed with fixed ex-units, force submit ===");
const b3 = await buildMove({ client: cb, sc, scriptUtxo, state, number: 7, signerKh: bob.kh, extraOpts: { evaluator: fixedEvaluator() } });
const r3 = await b3.build(); if (r3._tag === "Left") { console.log("bypass build failed:\n" + showErr(r3.left)); process.exit(1); }
const sub3 = await r3.right.sign();
const tx3 = await r3.right.toTransaction();
// assemble signed tx: unsigned body + script witnesses + bob vkey witness
const signedCbor = await (async () => {
  // SubmitBuilder has no CBOR getter; rebuild signed tx via Transaction + witness set merge
  const tx = await r3.right.toTransaction();
  const ws = sub3.witnessSet;
  const merged = new Evo.TransactionWitnessSet.TransactionWitnessSet({ ...tx.witnessSet, vkeyWitnesses: ws.vkeyWitnesses });
  return Evo.Transaction.toCBORHex(new Evo.Transaction.Transaction({ ...tx, witnessSet: merged }));
})();
const t3 = Evo.Transaction.fromCBORHex(signedCbor);
console.log("tx3 required signers:", t3.body.requiredSigners?.map((k) => Evo.KeyHash.toHex(k)), "vkey witnesses:", t3.witnessSet.vkeyWitnesses?.length, "isValid:", t3.isValid, "redeemers:", j(t3.witnessSet.redeemers?.value ? [...t3.witnessSet.redeemers.value.entries()] : t3.witnessSet.redeemers));
let item3 = false;
try { const res = await ogmios("submitTransaction", { transaction: { cbor: signedCbor } }); console.log("UNEXPECTED: accepted", j(res)); }
catch (e) { console.log("raw Ogmios submitTransaction error:\n" + JSON.stringify(e.ogmios, null, 1).slice(0, 3500));
  const s = JSON.stringify(e.ogmios);
  // 3136 = ValidationTagMismatch: tx declared isValid=true but phase-2 (script execution) failed -> ledger rejects at submit.
  // Phase-1 witness errors would be MissingVKeyWitnesses / 3100-range; 3117 = missing required signatories.
  item3 = !/MissingVKeyWitnesses|missingSignatories|"code":3117|"code":3100/.test(s) && /"code":3136|"code":3010|"code":3012/.test(s); }
// Also via the SDK's own submit path (SubmitBuilder.submit -> Kupmios submitTx)
try { await sub3.submit(); console.log("UNEXPECTED: SDK submit accepted"); } catch (e) { console.log("SDK SubmitBuilder.submit error:\n" + showErr(e)); }

console.log("\n=== Item 3 mutation: alice (correct player), same bypass, force submit ===");
const b4 = await buildMove({ client: ca, sc, scriptUtxo, state, number: 7, signerKh: alice.kh, extraOpts: { evaluator: fixedEvaluator() } });
const r4 = await b4.build(); if (r4._tag === "Left") { console.log("bypass build failed:\n" + showErr(r4.left)); process.exit(1); }
const h4 = Evo.TransactionHash.toHex(await r4.right.signAndSubmit());
await waitTx(h4);
const km = await kupoMatches(`${sc.policyHex}.${m.name}`);
console.log("alice move accepted", h4, "kupo token now at:", km.map((x) => `${x.transaction_id}#${x.output_index}`));
const mut = km.length === 1 && km[0].transaction_id === h4;
console.log(`\nITEM2 ${item2 ? "PASS" : "FAIL"} | ITEM3 ${item3 ? "PASS" : "FAIL"} | ITEM3-MUTATION ${mut ? "PASS" : "FAIL"}`);
