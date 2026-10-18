// Why does the local aiken-uplc evaluator reject a mint tx that Ogmios evaluates fine? Vary the cost models.
import { Effect } from "effect";
import { createAikenEvaluator } from "@evolution-sdk/aiken-uplc";
import { devnetChain, newKey, fund, waitTx, protocolParameters, ogmios, j, Evo } from "./lib.mjs";
import { script, signingClient, buildMint, fixedEvaluator } from "./game.mjs";
const chain = await devnetChain(); const sc = script();
const alice = newKey("alice"), bob = newKey("bob");
const f = await fund([{ address: alice.address, lovelace: 100_000_000n }, { address: alice.address, lovelace: 100_000_000n }], chain); await waitTx(f.txHash);
const ca = signingClient(chain, alice);
const utxos = await ca.getWalletUtxos();
const [seedUtxo] = utxos;
const m = await buildMint({ client: ca, sc, seedUtxo, players: [alice.khHex, bob.khHex], extraOpts: { evaluator: fixedEvaluator() } });
const r = await m.build();
const tx = await r.right.toTransaction();
console.log("ogmios evaluate:", j(await ogmios("evaluateTransaction", { transaction: { cbor: Evo.Transaction.toCBORHex(tx) } })));
const pp = await protocolParameters();
const v3 = Object.values(pp.costModels.PlutusV3).map(BigInt);
console.log("devnet V3 cost model length:", v3.length);
const CostModel = await import("@evolution-sdk/evolution/CostModel");
const cms = (v3costs) => new CostModel.CostModels({ PlutusV1: new CostModel.CostModel({ costs: Object.values(pp.costModels.PlutusV1).map(BigInt) }), PlutusV2: new CostModel.CostModel({ costs: [] }), PlutusV3: new CostModel.CostModel({ costs: v3costs }) });
const ctx = (c) => ({ costModels: c, maxTxExSteps: pp.maxTxExSteps, maxTxExMem: pp.maxTxExMem, slotConfig: chain.slotConfig });
for (const [label, c] of [["devnet V3 (251)", v3], ["V3 padded to 297 with 0", [...v3, ...Array(297 - v3.length).fill(0n)]], ["V3 padded to 297 with 1e9", [...v3, ...Array(297 - v3.length).fill(1_000_000_000n)]]]) {
  const exit = await Effect.runPromiseExit(createAikenEvaluator.evaluate(tx, utxos, ctx(cms(c))));
  console.log(`[aiken, ${label}]`, exit._tag === "Success" ? j(exit.value) : JSON.stringify(exit.cause.error ?? exit.cause, (_k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 600));
}
