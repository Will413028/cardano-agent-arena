// Item 1 (Blaze Emulator 0.5.1): same flow as devnet, plus whether the Emulator runs phase-2 on submit.
import { Emulator, EmulatorProvider } from "@blaze-cardano/emulator";
import { Core, j, errText, log } from "./lib.mjs";
import { players, buildMint, buildMove, summarizeTx, fixedEvaluator } from "./game.mjs";

const { TransactionUnspentOutput, TransactionInput, TransactionOutput, TransactionId, Value } = Core;
const out = [];
const p = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : j(x))).join(" "); console.log(s); out.push(s); };
const res = {};
const emu = new Emulator([]);
const provider = new EmulatorProvider(emu);
let n = 0;
const fund = (addr, lovelace) => emu.addUtxo(new TransactionUnspentOutput(
  new TransactionInput(TransactionId("ff".repeat(32)), BigInt(n++)), new TransactionOutput(addr, new Value(lovelace))));
const submit = async (tx) => { const id = await provider.postTransactionToChain(tx); emu.awaitTransactionConfirmation(id); return id; };
async function expectFail(label, fn) {
  try { const r = await fn(); p(`${label}: UNEXPECTED success`, r); return false; }
  catch (e) { p(`${label}: rejected:`, errText(e).slice(0, 1500)); return true; }
}
try {
  const { alice, bob } = await players(provider);
  for (const w of [alice, bob]) { fund(w.address, 50_000_000n); fund(w.address, 10_000_000n); }
  const game0 = { players: [alice.pkh, bob.pkh], moves: [] };

  // happy path
  const m = await buildMint(provider, alice, { playerPkhs: game0.players });
  p("mint built", summarizeTx(m.tx));
  p("mint submitted", await submit(await m.blaze.signTransaction(m.tx)));
  const game = { ...game0, name: m.name, unit: m.unit };
  let [thread] = await provider.getUnspentOutputsWithAsset(m.S.address, m.unit);
  p("thread", `${thread.input().transactionId()}#${thread.input().index()}`);

  // item 2 analogue in emulator: bob first move, default evaluator (emulator's UPLC VM)
  res.emu_bob_build_rejected = await expectFail("bob build (emulator evaluator)", async () => summarizeTx((await buildMove(provider, bob, thread, game, 7)).tx));
  // phase-2 on submit: bob forced with fixed ex units
  const rb = await buildMove(provider, bob, thread, game, 7, { evaluator: fixedEvaluator() });
  res.emu_bob_forced_submit_rejected = await expectFail("bob forced submit (emulator.submitTransaction)", async () => submit(await rb.blaze.signTransaction(rb.tx)));
  // alice legit move
  const ra = await buildMove(provider, alice, thread, game, 7);
  p("alice move built", summarizeTx(ra.tx));
  p("alice move submitted", await submit(await ra.blaze.signTransaction(ra.tx)));
  [thread] = await provider.getUnspentOutputsWithAsset(m.S.address, m.unit);
  p("thread after move", `${thread.input().transactionId()}#${thread.input().index()}`, "datum", thread.output().datum()?.asInlineData()?.toCbor());
  res.emu_alice_move = "PASS";

  // mint mutation in emulator
  const ARB = "deadbeef".repeat(8);
  res.emu_correct_rejects_arbitrary_name_build = await expectFail("correct mint arbitrary name (build)", async () =>
    summarizeTx((await buildMint(provider, alice, { playerPkhs: game0.players, nameOverride: ARB })).tx));
  const rc = await buildMint(provider, alice, { playerPkhs: game0.players, nameOverride: ARB, evaluator: fixedEvaluator() });
  res.emu_correct_rejects_arbitrary_name_submit = await expectFail("correct mint arbitrary name (forced submit)", async () => submit(await rc.blaze.signTransaction(rc.tx)));
  const rm = await buildMint(provider, alice, { playerPkhs: game0.players, nameOverride: ARB, which: "mutant" });
  p("mutant mint submitted", await submit(await rm.blaze.signTransaction(rm.tx)));
  res.emu_mutant_accepts = "PASS";
} catch (e) { p("ERROR", errText(e), e?.stack ?? ""); }
p("RESULT", res);
log("item1-emulator.txt", "$ node item1-emulator.mjs\n" + out.join("\n") + "\n");
process.exit(0);
