// Item 1 mint mutation (devnet): arbitrary token name (datum name = that name).
// Correct blueprint must reject (Ogmios evaluation at build, and node phase-2 with evaluation bypassed);
// mutant (no name check) must accept and land on chain.
import { devnetProvider, fundFromFaucet, kupoWait, submitRetry, j, errText, log } from "./lib.mjs";
import { players, buildMint, summarizeTx, fixedEvaluator } from "./game.mjs";

const out = [];
const p = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : j(x))).join(" "); console.log(s); out.push(s); };
const ARBITRARY = "deadbeef".repeat(8);
const res = { correct_rejects_build: "FAIL", correct_rejects_node: "FAIL", mutant_accepts: "FAIL" };
try {
  const provider = await devnetProvider();
  const { alice, bob } = await players(provider);
  const f = await fundFromFaucet(provider, [
    { address: alice.address, lovelace: 50_000_000n }, { address: alice.address, lovelace: 10_000_000n }]);
  await kupoWait(f.txHash);
  const opts = { playerPkhs: [alice.pkh, bob.pkh], nameOverride: ARBITRARY };

  p("--- correct blueprint, arbitrary name, default evaluation");
  try { const r = await buildMint(provider, alice, opts); p("UNEXPECTED built", summarizeTx(r.tx)); }
  catch (e) { const s = errText(e); p("build rejected:", s); if (/3010|3012/.test(s)) res.correct_rejects_build = "PASS"; }

  p("--- correct blueprint, arbitrary name, evaluation bypassed, submit");
  const rc = await buildMint(provider, alice, { ...opts, evaluator: fixedEvaluator() });
  try { const id = await submitRetry(provider, await rc.blaze.signTransaction(rc.tx)); p("UNEXPECTED submitted", id); }
  catch (e) { const s = errText(e); p("submit rejected:", s); if (/3136/.test(s)) res.correct_rejects_node = "PASS"; }

  p("--- mutant blueprint, arbitrary name, default evaluation");
  const rm = await buildMint(provider, alice, { ...opts, which: "mutant" });
  p("built", summarizeTx(rm.tx), "policy", rm.S.policyId, "unit", rm.unit);
  const id = await submitRetry(provider, await rm.blaze.signTransaction(rm.tx));
  const k = await kupoWait(id);
  p("mutant mint confirmed in Kupo", k.map((x) => ({ out: `${x.transaction_id}#${x.output_index}`, address: x.address, value: x.value })));
  res.mutant_accepts = "PASS";
} catch (e) { p("ERROR", errText(e), e?.stack ?? ""); }
p("RESULT", res);
log("item1-mint-mutation.txt", "$ node item1-mint-mutation.mjs\n" + out.join("\n") + "\n");
process.exit(0);
