// Items 2+3 (devnet): bob makes the first move (illegal: players[0] = alice must sign).
// 2: default build -> Ogmios evaluation rejects in complete().
// 3: same tx with evaluation bypassed via TxBuilder.useEvaluator(fixed ExUnits), bob signs, node must reject
//    with phase-2 (3136), not MissingVKeyWitnesses. Same shape built/signed by alice must be accepted.
import { devnetProvider, fundFromFaucet, kupoWait, submitRetry, j, errText, log } from "./lib.mjs";
import { players, buildMint, buildMove, summarizeTx, fixedEvaluator } from "./game.mjs";

const out = [];
const p = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : j(x))).join(" "); console.log(s); out.push(s); };
const t0 = Date.now();
const el = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const res = { item2: "FAIL", item3_bob_rejected_phase2: "FAIL", item3_alice_accepted: "FAIL" };
try {
  const provider = await devnetProvider();
  const { alice, bob } = await players(provider);
  const f = await fundFromFaucet(provider, [
    { address: alice.address, lovelace: 50_000_000n }, { address: alice.address, lovelace: 10_000_000n },
    { address: bob.address, lovelace: 50_000_000n }, { address: bob.address, lovelace: 10_000_000n }]);
  await kupoWait(f.txHash);
  const m = await buildMint(provider, alice, { playerPkhs: [alice.pkh, bob.pkh] });
  const mintId = await submitRetry(provider, await m.blaze.signTransaction(m.tx));
  await kupoWait(mintId);
  p(el(), "minted", mintId, "unit", m.unit);
  const game = { players: [alice.pkh, bob.pkh], moves: [], name: m.name, unit: m.unit };
  const [thread] = await provider.getUnspentOutputsWithAsset(m.S.address, m.unit);

  // ---- item 2
  p(el(), "--- item 2: bob builds first move with default (Ogmios) evaluation");
  try {
    const r = await buildMove(provider, bob, thread, game, 7);
    p(el(), "UNEXPECTED: built", summarizeTx(r.tx));
  } catch (e) {
    const s = errText(e);
    p(el(), "build rejected:", s);
    if (/30(10|11|12)|script|valid/i.test(s)) res.item2 = "PASS";
  }

  // ---- item 3: bob, evaluation bypassed
  p(el(), "--- item 3a: bob, useEvaluator(fixedEvaluator) -> sign -> submit");
  const rb = await buildMove(provider, bob, thread, game, 7, { evaluator: fixedEvaluator() });
  p(el(), "built (no evaluation)", summarizeTx(rb.tx));
  const sb = await rb.blaze.signTransaction(rb.tx);
  p("vkey witnesses:", (sb.witnessSet().vkeys()?.toCore() ?? []).length, "isValid flag:", sb.isValid());
  try {
    const id = await submitRetry(provider, sb);
    p(el(), "UNEXPECTED: submitted", id);
  } catch (e) {
    const s = errText(e);
    p(el(), "submit rejected:", s);
    const phase2 = /3136|ValidationTagMismatch|PlutusFailure|ScriptFailure/i.test(s);
    const vkey = /MissingVKeyWitnesses|3117/i.test(s);
    p("phase2-class:", phase2, "missingVKey:", vkey);
    if (phase2 && !vkey) res.item3_bob_rejected_phase2 = "PASS";
  }

  // ---- item 3b: alice, same shape, evaluation bypassed
  p(el(), "--- item 3b: alice, same shape, useEvaluator(fixedEvaluator) -> sign -> submit");
  const ra = await buildMove(provider, alice, thread, game, 7, { evaluator: fixedEvaluator() });
  p(el(), "built (no evaluation)", summarizeTx(ra.tx));
  const id = await submitRetry(provider, await ra.blaze.signTransaction(ra.tx));
  p(el(), "submitted", id);
  const k = await kupoWait(id);
  p(el(), "confirmed in Kupo", k.map((x) => `${x.transaction_id}#${x.output_index} ${x.address}`));
  res.item3_alice_accepted = "PASS";
} catch (e) {
  p(el(), "ERROR", errText(e), e?.stack ?? "");
}
p("RESULT", res);
log("item2-3-illegal.txt", "$ node item2-3-illegal.mjs\n" + out.join("\n") + "\n");
process.exit(0);
