// Item 8: lucid's own Kupmios provider vs Ogmios v7.0.0 / Kupo v2.12.0, no response patching.
import { Lucid, Kupmios } from "@lucid-evolution/lucid";
import {
  KUPO, OGMIOS, DEVNET_SLOT_CONFIG, makeDevnetLucid, fundFromFaucet, newKey, loadScript, threadName,
  datumCbor, DatumSchema, Data, Constr, toUnit, j,
} from "./lib.mjs";
const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const res = {};
const provider = new Kupmios(KUPO, OGMIOS);

// 8a: plain Lucid(new Kupmios(...)) -- protocol params straight from the provider.
try {
  await Lucid(provider, "Custom", { slotConfig: await DEVNET_SLOT_CONFIG() });
  res.init = "ok";
} catch (e) { res.init = "FAIL"; log("8a Lucid(Kupmios) init error:", String(e?.message ?? e).split("\n").slice(0, 6).join(" | ")); }
try { await provider.getProtocolParameters(); res.getProtocolParameters = "ok"; }
catch (e) { res.getProtocolParameters = "FAIL"; log("8a getProtocolParameters error:", String(e?.message ?? e).split("\n").slice(0, 6).join(" | ")); }

// 8b: every other provider call, with protocol params preset (workaround from lib.mjs).
const TIMEOUT = Number(process.env.KUPMIOS_TIMEOUT_MS ?? 30000);
log("Kupmios requestTimeoutMs for 8b:", TIMEOUT);
const { lucid } = await makeDevnetLucid({ kupmiosOptions: { requestTimeoutMs: TIMEOUT } });
const alice = newKey("alice"), bob = newKey("bob");
const fundTx = await fundFromFaucet(lucid, [alice.addr, bob.addr], 100_000_000n);
const call = async (k, f) => { try { const v = await f(); res[k] = "ok"; log(k, j(v).slice(0, 400)); return v; } catch (e) { res[k] = "FAIL"; log(k, "ERROR", String(e?.message ?? e).slice(0, 600)); } };
await call("getUtxos(addr)", () => provider.getUtxos(alice.addr));
await call("getUtxos(credential)", () => provider.getUtxos({ type: "Key", hash: alice.pkh }));
await call("getUtxosByOutRef", () => provider.getUtxosByOutRef([{ txHash: fundTx, outputIndex: 0 }]));
await call("getTransactionStatus", () => provider.getTransactionStatus(fundTx));
await call("getTreasury", () => provider.getTreasury());

// mint + move with provider-side evaluation (localUPLCEval:false -> Kupmios.evaluateTx -> Ogmios evaluateTransaction).
const { script, policyId, address } = loadScript("correct");
lucid.selectWallet.fromPrivateKey(alice.sk);
const seed = (await lucid.wallet().getUtxos())[0];
const name = threadName(seed.txHash, seed.outputIndex);
const unit = toUnit(policyId, name);
const mintHash = await call("mint via provider evaluateTx + submitTx + awaitTx", async () => {
  const t0 = Date.now();
  const tx = await lucid.newTx().collectFrom([seed])
    .mintAssets({ [unit]: 1n }, Data.to(new Constr(0, [seed.txHash, BigInt(seed.outputIndex)])))
    .attach.MintingPolicy(script)
    .pay.ToContract(address, { kind: "inline", value: datumCbor({ players: [alice.pkh, bob.pkh], moves: [], name, result: -1n }) }, { [unit]: 1n, lovelace: 2_000_000n })
    .complete({ localUPLCEval: false });
  log("complete() with provider evaluation took ms:", Date.now() - t0);
  const h = await (await tx.sign.withWallet().complete()).submit();
  await lucid.awaitTx(h);
  return h;
});
const u = await call("getUtxosWithUnit", async () => (await provider.getUtxosWithUnit(address, unit))[0]);
await call("getUtxoByUnit", () => provider.getUtxoByUnit(unit));
await call("getUtxosWithPolicy", () => provider.getUtxosWithPolicy(address, policyId));
await call("datum decodes (inline via Kupo)", () => Data.from(u.datum, DatumSchema));
await call("bob move rejected by provider evaluateTx", async () => {
  lucid.selectWallet.fromPrivateKey(bob.sk);
  try {
    await lucid.newTx().collectFrom([u], Data.to(7n)).attach.SpendingValidator(script)
      .pay.ToContract(address, { kind: "inline", value: datumCbor({ players: [alice.pkh, bob.pkh], moves: [7n], name, result: -1n }) }, u.assets)
      .addSigner(bob.addr).complete({ localUPLCEval: false });
    throw new Error("unexpectedly built");
  } catch (e) { if (String(e).includes("unexpectedly")) throw e; return String(e?.message ?? e).slice(0, 500); }
});
log("SUMMARY", j(res));
