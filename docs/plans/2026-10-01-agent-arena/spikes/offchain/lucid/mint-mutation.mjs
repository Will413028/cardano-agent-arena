// Mutation check for item 1's mint: arbitrary token name.
// correct blueprint -> rejected (local eval AND node when forced); mutant blueprint -> accepted on devnet.
import {
  loadScript, newKey, makeDevnetLucid, fundFromFaucet, threadName, datumCbor, Data, Constr, CML, toUnit, ogmios, j,
} from "./lib.mjs";

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const ARBITRARY = "ab".repeat(32);
const FIXED = { mem: 2_000_000, steps: 800_000_000 };
const fixedEvaluator = { name: "fixed", async evaluate({ tx }) {
  const rs = CML.Transaction.from_cbor_hex(tx).witness_set().redeemers().as_arr_legacy_redeemer();
  const out = []; for (let i = 0; i < rs.len(); i++) out.push({ redeemer_tag: ["spend", "mint"][rs.get(i).tag()], redeemer_index: Number(rs.get(i).index()), ex_units: FIXED });
  return out;
} };

const { lucid } = await makeDevnetLucid();
const alice = newKey("alice"), bob = newKey("bob");
log("funded", await fundFromFaucet(lucid, [alice.addr, bob.addr], 200_000_000n));
lucid.selectWallet.fromPrivateKey(alice.sk);

async function attempt(which, datumName, opts = {}) {
  const { script, policyId, address } = loadScript(which);
  const seed = (await lucid.wallet().getUtxos()).sort((a, b) => (a.assets.lovelace > b.assets.lovelace ? -1 : 1))[0];
  const real = threadName(seed.txHash, seed.outputIndex);
  const unit = toUnit(policyId, ARBITRARY);
  const datum = datumCbor({ players: [alice.pkh, bob.pkh], moves: [], name: datumName === "arbitrary" ? ARBITRARY : real, result: -1n });
  const label = `${which} blueprint, minted name=ARBITRARY, datum.name=${datumName}${opts.evaluator ? ", forced (fixed ex units)" : ""}`;
  try {
    const tx = await lucid.newTx().collectFrom([seed])
      .mintAssets({ [unit]: 1n }, Data.to(new Constr(0, [seed.txHash, BigInt(seed.outputIndex)])))
      .attach.MintingPolicy(script)
      .pay.ToContract(address, { kind: "inline", value: datum }, { [unit]: 1n, lovelace: 2_000_000n })
      .complete(opts);
    const signed = await tx.sign.withWallet().complete();
    try {
      const r = await ogmios("submitTransaction", { transaction: { cbor: signed.toCBOR() } });
      await lucid.awaitTx(r.transaction.id);
      log(`ACCEPTED  ${label} tx=${r.transaction.id}`);
      return "accepted";
    } catch (e) {
      log(`NODE-REJECTED ${label}: ${JSON.stringify(e.rpc ?? String(e)).slice(0, 600)}`);
      return "node-rejected";
    }
  } catch (e) {
    log(`BUILD-REJECTED ${label}: ${String(e?.message ?? e).split("\n")[0].slice(0, 300)}`);
    return "build-rejected";
  }
}

const r = {};
r.correctBuild = await attempt("correct", "arbitrary");
r.correctForced = await attempt("correct", "arbitrary", { evaluator: fixedEvaluator });
r.mutantArbitrary = await attempt("mutant", "arbitrary");
if (r.mutantArbitrary !== "accepted") r.mutantRealName = await attempt("mutant", "real");
log("SUMMARY", j(r));
const pass = r.correctBuild === "build-rejected" && r.correctForced === "node-rejected" &&
  (r.mutantArbitrary === "accepted" || r.mutantRealName === "accepted");
log(pass ? "MUTATION PASS" : "MUTATION FAIL");
process.exit(pass ? 0 : 1);
