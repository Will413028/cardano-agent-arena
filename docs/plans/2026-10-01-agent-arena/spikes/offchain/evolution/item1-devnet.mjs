// Item 1 (devnet): fresh keys, fund, mint thread token to script with inline datum, alice moves 7. Confirm via Kupo.
import { devnetChain, newKey, fund, waitTx, kupoMatches, j, Evo } from "./lib.mjs";
import { script, signingClient, buildMint, buildMove, showErr } from "./game.mjs";
const evaluatorArg = process.argv[2] ?? "provider"; // provider | aiken | scalus (local in-process UPLC evaluators)
let extraOpts = {};
if (evaluatorArg === "aiken") { const { createAikenEvaluator } = await import("@evolution-sdk/aiken-uplc"); extraOpts = { evaluator: createAikenEvaluator }; }
if (evaluatorArg === "scalus") { const { createScalusEvaluator } = await import("@evolution-sdk/scalus-uplc"); extraOpts = { evaluator: createScalusEvaluator }; }
console.log("evaluator:", evaluatorArg);
const chain = await devnetChain();
const sc = script();
console.log("script", sc.policyHex, sc.bech32);
const alice = newKey("alice"), bob = newKey("bob");
console.log("alice", alice.bech32, alice.khHex, "\nbob  ", bob.bech32, bob.khHex);
const f = await fund([alice, alice, alice, bob, bob].map((k) => ({ address: k.address, lovelace: 100_000_000n })), chain);
console.log("fund tx", f.txHash, "from faucet", f.faucet); await waitTx(f.txHash);
const ca = signingClient(chain, alice);
const aliceUtxos = await ca.getWalletUtxos();
const seedUtxo = aliceUtxos[0];
console.log("seed", Evo.TransactionHash.toHex(seedUtxo.transactionId) + "#" + seedUtxo.index);
const m = await buildMint({ client: ca, sc, seedUtxo, players: [alice.khHex, bob.khHex], extraOpts });
const r = await m.build();
if (r._tag === "Left") { console.log("MINT BUILD FAIL\n" + showErr(r.left)); process.exit(1); }
const mintTx = await r.right.toTransaction();
console.log("mint redeemers:", j(mintTx.witnessSet.redeemers));
const mintHash = Evo.TransactionHash.toHex(await r.right.signAndSubmit());
console.log("mint tx", mintHash, "token name", m.name);
await waitTx(mintHash);
const km = await kupoMatches(`${sc.policyHex}.${m.name}`);
console.log("kupo token match:", j(km.map((x) => ({ out: `${x.transaction_id}#${x.output_index}`, address: x.address, assets: x.value.assets, datum_type: x.datum_type, datum_hash: x.datum_hash }))));
// spend: alice move 7
const [scriptUtxo] = (await ca.getUtxos(sc.address)).filter((u) => Evo.TransactionHash.toHex(u.transactionId) === mintHash);
console.log("script utxo datum (via Kupmios):", Evo.Data.toCBORHex(scriptUtxo.datumOption.data));
const state = { players: [alice.khHex, bob.khHex], moves: [], name: m.name, result: -1 };
const mv = await buildMove({ client: ca, sc, scriptUtxo, state, number: 7, signerKh: alice.kh, extraOpts });
const r2 = await mv.build();
if (r2._tag === "Left") { console.log("MOVE BUILD FAIL\n" + showErr(r2.left)); process.exit(1); }
const moveTx = await r2.right.toTransaction();
console.log("move redeemers:", j(moveTx.witnessSet.redeemers), "collateral inputs:", moveTx.body.collateralInputs?.length, "required signers:", moveTx.body.requiredSigners?.map((k) => Evo.KeyHash.toHex(k)));
const moveHash = Evo.TransactionHash.toHex(await r2.right.signAndSubmit());
console.log("move tx", moveHash); await waitTx(moveHash);
const km2 = await kupoMatches(`${sc.policyHex}.${m.name}`);
const dh = km2[0].datum_hash;
const kd = await fetch(`http://127.0.0.1:57780/datums/${dh}`).then((x) => x.json());
console.log("kupo after move:", j(km2.map((x) => `${x.transaction_id}#${x.output_index} ${x.address}`)), "datum:", kd.datum);
console.log("expected next datum:", Evo.Data.toCBORHex(mv.next));
const ok = km2.length === 1 && km2[0].transaction_id === moveHash && kd.datum === Evo.Data.toCBORHex(mv.next);
console.log(ok ? "PASS" : "FAIL");
