// Items 1-4 (+ item 8 on devnet). Usage: node flow.mjs devnet|emulator
import {
  loadScript, newKey, topup, makeDevnetLucid, makeEmulatorLucid, threadName, datumCbor,
  DatumSchema, Data, Constr, CML, toUnit, kupoMatches, waitFor, fundFromFaucet, ogmios, KUPO, j,
} from "./lib.mjs";

const MODE = process.argv[2] ?? "devnet";
const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const results = {};
const record = (k, ok, detail) => { results[k] = { ok, detail }; log(`RESULT ${k}: ${ok ? "PASS" : "FAIL"}`, detail ?? ""); };

const { script, policyId, address: scriptAddr } = loadScript("correct");
log("mode", MODE, "policyId", policyId, "scriptAddr", scriptAddr);

const alice = newKey("alice");
const bob = newKey("bob");
log("alice", alice.addr, alice.pkh);
log("bob  ", bob.addr, bob.pkh);

let lucid, emulator;
if (MODE === "devnet") {
  ({ lucid } = await makeDevnetLucid());
  log("funded from Yaci test account 0, tx", await fundFromFaucet(lucid, [alice.addr, bob.addr]));
  await waitFor(async () => (await lucid.utxosAt(alice.addr)).length && (await lucid.utxosAt(bob.addr)).length, "funding");
} else {
  ({ lucid, emulator } = await makeEmulatorLucid([alice, bob]));
}
const use = (k) => lucid.selectWallet.fromPrivateKey(k.sk);

async function confirm(hash, label) {
  if (MODE === "emulator") { emulator.awaitBlock(1); }
  const ok = await lucid.awaitTx(hash);
  log(`${label} confirmed=${ok} tx=${hash}`);
  return ok;
}

async function mintGame(tag) {
  use(alice);
  const utxos = await lucid.wallet().getUtxos();
  const seed = utxos[0];
  const name = threadName(seed.txHash, seed.outputIndex);
  const unit = toUnit(policyId, name);
  const datum = datumCbor({ players: [alice.pkh, bob.pkh], moves: [], name, result: -1n });
  const redeemer = Data.to(new Constr(0, [seed.txHash, BigInt(seed.outputIndex)]));
  const tx = await lucid.newTx()
    .collectFrom([seed])
    .mintAssets({ [unit]: 1n }, redeemer)
    .attach.MintingPolicy(script)
    .pay.ToContract(scriptAddr, { kind: "inline", value: datum }, { [unit]: 1n, lovelace: 2_000_000n })
    .complete();
  const signed = await tx.sign.withWallet().complete();
  const hash = await signed.submit();
  await confirm(hash, `mint ${tag}`);
  return { name, unit, seed, hash };
}

async function gameUtxo(unit) {
  const us = await lucid.utxosAtWithUnit(scriptAddr, unit);
  if (us.length !== 1) throw new Error(`expected 1 game utxo, got ${us.length}`);
  return us[0];
}

function moveTx(utxo, number, signerAddr, nextDatum) {
  return lucid.newTx()
    .collectFrom([utxo], Data.to(BigInt(number)))
    .attach.SpendingValidator(script)
    .pay.ToContract(scriptAddr, { kind: "inline", value: nextDatum }, utxo.assets)
    .addSigner(signerAddr);
}

// Evaluator that never runs UPLC: returns fixed ex units for every redeemer in the tx.
const FIXED = { mem: 2_000_000, steps: 800_000_000 };
const fixedEvaluator = {
  name: "fixed-units-no-eval",
  async evaluate({ tx }) {
    const t = CML.Transaction.from_cbor_hex(tx);
    const rs = t.witness_set().redeemers();
    const out = [];
    const tagName = (n) => ["spend", "mint", "publish", "withdraw", "vote", "propose"][n];
    if (rs) {
      const legacy = rs.as_arr_legacy_redeemer();
      if (legacy) {
        for (let i = 0; i < legacy.len(); i++) {
          const r = legacy.get(i);
          out.push({ redeemer_tag: tagName(r.tag()), redeemer_index: Number(r.index()), ex_units: FIXED });
        }
      } else {
        const m = rs.as_map_redeemer_key_to_redeemer_val();
        const keys = m.keys();
        for (let i = 0; i < keys.len(); i++) {
          const k = keys.get(i);
          out.push({ redeemer_tag: tagName(k.tag()), redeemer_index: Number(k.index()), ex_units: FIXED });
        }
      }
    }
    log("fixedEvaluator returning", JSON.stringify(out));
    return out;
  },
};

// ---------- Item 1: mint + alice move 7 (normal path, local evaluation) ----------
const g1 = await mintGame("game1");
{
  const u = await gameUtxo(g1.unit);
  const d = Data.from(u.datum, DatumSchema);
  log("game1 datum after mint", j(d));
  if (MODE === "devnet") {
    const km = await kupoMatches(`${policyId}.${g1.name}`);
    log("kupo after mint", j(km.map((m) => ({ address: m.address, tx: m.transaction_id, value: m.value, datum_type: m.datum_type, datum_hash: m.datum_hash }))));
  }
  use(alice);
  const next = datumCbor({ players: d.players, moves: [7n], name: d.name, result: d.result });
  const tx = await moveTx(u, 7, alice.addr, next).complete();
  const hash = await (await tx.sign.withWallet().complete()).submit();
  await confirm(hash, "alice move 7");
  const u2 = await gameUtxo(g1.unit);
  const d2 = Data.from(u2.datum, DatumSchema);
  log("game1 datum after alice move", j(d2));
  let kupoOk = true;
  if (MODE === "devnet") {
    const km = await waitFor(async () => { const m = await kupoMatches(`${policyId}.${g1.name}`); return m.length && m[0].transaction_id === hash ? m : null; }, "kupo move");
    const dat = await (await fetch(`${KUPO}/datums/${km[0].datum_hash}`)).json();
    log("kupo after move", j({ address: km[0].address, tx: km[0].transaction_id, datum_type: km[0].datum_type, datum: dat.datum }));
    kupoOk = km[0].address === scriptAddr && dat.datum === next;
  }
  record("1-mint+move", d2.moves.length === 1 && d2.moves[0] === 7n && kupoOk, `mint=${g1.hash} move=${hash}`);
}

// ---------- Game 2 for items 2 and 3 ----------
const g2 = await mintGame("game2");
const u2 = await gameUtxo(g2.unit);
const d2 = Data.from(u2.datum, DatumSchema);
const nextG2 = datumCbor({ players: d2.players, moves: [7n], name: d2.name, result: d2.result });

// Item 2: bob tries first move -> local evaluation must reject at build time.
{
  use(bob);
  try {
    await moveTx(u2, 7, bob.addr, nextG2).complete();
    record("2-bob-build-rejected", false, "complete() unexpectedly succeeded");
  } catch (e) {
    log("bob build error:", String(e?.message ?? e).slice(0, 3000));
    record("2-bob-build-rejected", true, String(e?.message ?? e).split("\n")[0].slice(0, 300));
  }
}

// Item 3: bob force-built with fixed ex units (no evaluation), submit raw.
{
  use(bob);
  const tx = await moveTx(u2, 7, bob.addr, nextG2).complete({ evaluator: fixedEvaluator });
  const signed = await tx.sign.withWallet().complete();
  const cbor = signed.toCBOR();
  log("bob forced tx", signed.toHash(), "isValid", CML.Transaction.from_cbor_hex(cbor).is_valid());
  if (MODE === "devnet") {
    try {
      const r = await ogmios("submitTransaction", { transaction: { cbor } });
      record("3-bob-forced-node-rejects", false, `accepted?! ${j(r)}`);
    } catch (e) {
      log("ogmios submit error (raw):", JSON.stringify(e.rpc, null, 1).slice(0, 6000));
      const s = JSON.stringify(e.rpc);
      const phase2 = /"code":3136|"code":3010|"code":3011|"code":3012|"code":3117/.test(s) && !/MissingVKeyWitness|missingSignatories|3100/.test(s);
      record("3-bob-forced-node-rejects", phase2, `code=${e.rpc?.code} msg=${e.rpc?.message}`);
    }
    try { await ogmios("evaluateTransaction", { transaction: { cbor } }); }
    catch (e) { log("ogmios evaluateTransaction on same tx (script failure detail):", JSON.stringify(e.rpc).slice(0, 2000)); }
    // Also show what the SDK's own Kupmios submit surfaces for the same tx (item 8).
    try { await signed.submit(); } catch (e) { log("Kupmios submit error surface:", String(e?.message ?? e).slice(0, 1500)); }
  } else {
    try {
      const h = await signed.submit();
      emulator.awaitBlock(1);
      const still = await lucid.utxosAtWithUnit(scriptAddr, g2.unit);
      const moved = still.length === 1 && still[0].txHash === h;
      record("3-bob-forced-emulator", !moved, `emulator accepted submit hash=${h}; token moved=${moved} (emulator phase-2 check?)`);
    } catch (e) {
      log("emulator submit error:", String(e?.message ?? e).slice(0, 3000));
      record("3-bob-forced-emulator", true, String(e?.message ?? e).split("\n")[0].slice(0, 300));
    }
  }
}

// Item 3 mutation: same shape, fixed ex units, signed by alice -> accepted.
{
  // Fresh game: the emulator lets bob's illegal move through, which would poison game2.
  const g3 = await mintGame("game3");
  use(alice);
  const u = await gameUtxo(g3.unit);
  const d3 = Data.from(u.datum, DatumSchema);
  const nextG3 = datumCbor({ players: d3.players, moves: [7n], name: d3.name, result: d3.result });
  const tx = await moveTx(u, 7, alice.addr, nextG3).complete({ evaluator: fixedEvaluator });
  const signed = await tx.sign.withWallet().complete();
  let hash;
  if (MODE === "devnet") {
    const r = await ogmios("submitTransaction", { transaction: { cbor: signed.toCBOR() } });
    hash = r.transaction.id;
  } else {
    hash = await signed.submit();
  }
  await confirm(hash, "alice forced move");
  const d = Data.from((await gameUtxo(g3.unit)).datum, DatumSchema);
  record("3m-alice-forced-accepted", d.moves.length === 1 && d.moves[0] === 7n, `tx=${hash}`);
}

// ---------- Item 4: unsigned tx + external CIP-30 signTx mock, and plain private key ----------
function cip30Mock(sk) {
  const key = CML.PrivateKey.from_bech32(sk);
  return {
    async signTx(txCborHex, partialSign) {
      const tx = CML.Transaction.from_cbor_hex(txCborHex);
      const hash = CML.hash_transaction(tx.body());
      const b = CML.TransactionWitnessSetBuilder.new();
      b.add_vkey(CML.make_vkey_witness(hash, key));
      return b.build().to_cbor_hex();
    },
  };
}
{
  // 4a: bob's move 3 on game1, built unsigned for bob's address only (no key in lucid).
  const u = await gameUtxo(g1.unit);
  const d = Data.from(u.datum, DatumSchema);
  const next = datumCbor({ players: d.players, moves: [...d.moves, 3n], name: d.name, result: d.result });
  lucid.selectWallet.fromAddress(bob.addr, await lucid.utxosAt(bob.addr));
  const unsigned = await moveTx(u, 3, bob.addr, next).complete();
  const unsignedCbor = unsigned.toCBOR();
  const vkeys = CML.Transaction.from_cbor_hex(unsignedCbor).witness_set().vkeywitnesses();
  log("4a unsigned tx", unsigned.toHash(), "vkey witnesses in unsigned:", vkeys ? vkeys.len() : 0, "cbor bytes:", unsignedCbor.length / 2);
  const wallet = cip30Mock(bob.sk);
  const wsHex = await wallet.signTx(unsignedCbor, true);
  log("4a witness set from mock signTx:", wsHex.slice(0, 80) + "...");
  const assembled = await lucid.fromTx(unsignedCbor).assemble([wsHex]).complete();
  const h = await assembled.submit();
  await confirm(h, "4a bob move via CIP-30 mock");
  const d3 = Data.from((await gameUtxo(g1.unit)).datum, DatumSchema);
  const okA = h === unsigned.toHash() && d3.moves.join(",") === "7,3";
  log("4a datum moves", d3.moves.join(","));

  // 4b: plain private key on an unsigned payment tx built for alice's address.
  lucid.selectWallet.fromAddress(alice.addr, await lucid.utxosAt(alice.addr));
  const pay = await lucid.newTx().pay.ToAddress(bob.addr, { lovelace: 5_000_000n }).complete();
  const payCbor = pay.toCBOR();
  const signedB = await lucid.fromTx(payCbor).sign.withPrivateKey(alice.sk).complete();
  const hb = await signedB.submit();
  await confirm(hb, "4b alice payment via withPrivateKey");

  // 4c: the same mock via partialSign-style assembly through selectWallet.fromAPI (needs a fuller CIP-30 shape).
  let okC = "skipped";
  try {
    const full = {
      ...cip30Mock(bob.sk),
      getNetworkId: async () => 0,
      getUtxos: async () => (await lucid.utxosAt(bob.addr)).map((x) => (CML.TransactionUnspentOutput.new(
        CML.TransactionInput.new(CML.TransactionHash.from_hex(x.txHash), BigInt(x.outputIndex)),
        CML.TransactionOutput.new(CML.Address.from_bech32(x.address), CML.Value.from_coin(x.assets.lovelace)),
      ).to_cbor_hex())),
      getBalance: async () => "00",
      getUsedAddresses: async () => [CML.Address.from_bech32(bob.addr).to_hex()],
      getUnusedAddresses: async () => [],
      getChangeAddress: async () => CML.Address.from_bech32(bob.addr).to_hex(),
      getRewardAddresses: async () => [],
      signData: async () => { throw new Error("n/a"); },
      submitTx: async (cbor) => lucid.config().provider.submitTx(cbor),
    };
    lucid.selectWallet.fromAPI(full);
    const t = await lucid.newTx().pay.ToAddress(alice.addr, { lovelace: 3_000_000n }).complete();
    const s = await t.sign.withWallet().complete();
    const hc = await s.submit();
    await confirm(hc, "4c bob payment via fromAPI(mock).sign.withWallet");
    okC = true;
  } catch (e) {
    log("4c error:", String(e?.stack ?? e).slice(0, 1500));
    okC = false;
  }
  record("4-unsigned+external-signer", okA && !!hb, `4a=${h} 4b=${hb} 4c(fromAPI)=${okC}`);
}

log("SUMMARY", j(results));
process.exit(Object.values(results).every((r) => r.ok) ? 0 : 1);
