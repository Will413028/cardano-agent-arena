// Shared helpers for the @blaze-cardano/sdk 0.3.1 spike. Throwaway code.
// Keys are generated in-process and never written to disk.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Blaze, Core, Kupmios, HotSingleWallet, cborToScript, makeValue, TxBuilder } from "@blaze-cardano/sdk";
import { Unwrapped } from "@blaze-cardano/ogmios";

const {
  Address, AssetId, AssetName, PolicyId, PlutusData, ConstrPlutusData, PlutusList, TransactionId,
  TransactionInput, TransactionOutput, TransactionUnspentOutput, Value, HexBlob, blake2b_256,
  Ed25519PrivateNormalKeyHex, NetworkId, Bip32PrivateKey, mnemonicToEntropy, wordlist, initCrypto,
  VkeyWitness, CborSet, ExUnits, Redeemers, Ed25519PublicKeyHex, Ed25519SignatureHex, AddressType,
  CredentialType,
} = Core;

const here = dirname(fileURLToPath(import.meta.url));
export const VALIDATOR_DIR = join(here, "..", "validator");
export const LOG_DIR = join(here, "logs");
export const KUPO = "http://127.0.0.1:57771";
export const OGMIOS_HTTP = "http://127.0.0.1:57772";
export const OGMIOS_WS = "ws://127.0.0.1:57772";
export { Core, Blaze, makeValue, TxBuilder };

export const j = (x) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
export function log(name, text) {
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(join(LOG_DIR, name), text);
}

// ---------- script ----------
export function loadScript(which = "correct") {
  const file = which === "mutant" ? "plutus.mutant-no-name-check.json" : "plutus.json";
  const bp = JSON.parse(readFileSync(join(VALIDATOR_DIR, file), "utf8"));
  const v = bp.validators.find((x) => x.title === "spike.spike.mint");
  const script = cborToScript(v.compiledCode, "PlutusV3");
  const policyId = script.hash();
  if (policyId !== v.hash) throw new Error(`policy id mismatch ${policyId} vs ${v.hash}`);
  const address = Core.addressFromValidator(NetworkId.Testnet, script);
  return { script, policyId, address, file };
}

// ---------- data (hand-built, raw PlutusData) ----------
const bytes = (hex) => PlutusData.newBytes(Buffer.from(hex, "hex"));
const int = (n) => PlutusData.newInteger(BigInt(n));
const list = (items) => { const l = new PlutusList(); for (const i of items) l.add(i); return PlutusData.newList(l); };
const constr = (alt, fields) => { const l = new PlutusList(); for (const f of fields) l.add(f); return PlutusData.newConstrPlutusData(new ConstrPlutusData(BigInt(alt), l)); };

export const seedData = (txHash, index) => constr(0, [bytes(txHash), int(index)]);
export const tokenNameFor = (txHash, index) => blake2b_256(HexBlob(seedData(txHash, index).toCbor()));
export function datumData({ players, moves, name, result }) {
  return constr(0, [list(players.map(bytes)), list(moves.map(int)), bytes(name), int(result)]);
}
export const intData = int;

// ---------- keys / wallets ----------
export function newWallet(provider) {
  const sk = Ed25519PrivateNormalKeyHex(randomBytes(32).toString("hex"));
  const w = new HotSingleWallet(sk, NetworkId.Testnet, provider);
  const pkh = w.address.getProps().paymentPart.hash;
  const rawKey = Core.Ed25519PrivateKey.fromNormalHex(sk);
  return { wallet: w, address: w.address, pkh, rawKey };
}

// ---------- devnet ----------
export async function ogmiosRpc(method, params = {}) {
  const res = await fetch(OGMIOS_HTTP, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const t = await res.json();
  if (t.error) { const e = new Error(JSON.stringify(t.error)); e.rpc = t.error; throw e; }
  return t.result;
}

export async function devnetProvider() {
  const ogmios = await Unwrapped.Ogmios.new(OGMIOS_WS);
  return new Kupmios(KUPO, ogmios);
}

// Faucet = Yaci's public default test mnemonic, account index 2 (m/1852'/1815'/2'/0/0). Public, not a secret.
const FAUCET_MNEMONIC = "test test test test test test test test test test test test test test test test test test test test test test test sauce";
const H = (n) => n + 0x80000000;
export async function faucet() {
  await initCrypto();
  const entropy = mnemonicToEntropy(FAUCET_MNEMONIC, wordlist);
  const root = Bip32PrivateKey.fromBip39Entropy(Buffer.from(entropy), "");
  const acct = root.derive([H(1852), H(1815), H(2)]);
  const pay = acct.derive([0, 0]);
  const stake = acct.derive([2, 0]);
  const payHash = pay.toPublic().toRawKey().hash().hex();
  const stakeHash = stake.toPublic().toRawKey().hash().hex();
  const base = new Address({ type: AddressType.BasePaymentKeyStakeKey, networkId: NetworkId.Testnet,
    paymentPart: { type: CredentialType.KeyHash, hash: payHash }, delegationPart: { type: CredentialType.KeyHash, hash: stakeHash } });
  return { address: base, rawKey: pay.toRawKey() };
}

export async function ogmiosUtxos(bech32) {
  const res = await ogmiosRpc("queryLedgerState/utxo", { addresses: [bech32] });
  return res.map((u) => {
    if (Object.keys(u.value).length > 1 || u.datum || u.script) return null;
    return new TransactionUnspentOutput(
      new TransactionInput(TransactionId(u.transaction.id), BigInt(u.index)),
      new TransactionOutput(Address.fromBech32(u.address), new Value(BigInt(u.value.ada.lovelace))));
  }).filter(Boolean);
}

// Sign a tx with a raw Ed25519 key outside any wallet; returns a witness set CBOR hex (CIP-30 style).
export function witnessSetFor(tx, rawKey) {
  const sig = rawKey.sign(HexBlob(tx.getId()));
  const ws = new Core.TransactionWitnessSet();
  ws.setVkeys(CborSet.fromCore([[rawKey.toPublic().hex(), sig.hex()]], VkeyWitness.fromCore));
  return ws.toCbor();
}
// Merge vkey witnesses from a CIP-30 witness-set CBOR into tx.
export function addWitnesses(tx, wsCborHex) {
  const add = Core.TransactionWitnessSet.fromCbor(HexBlob(wsCborHex)).vkeys()?.toCore() ?? [];
  const ws = tx.witnessSet();
  const have = ws.vkeys()?.toCore() ?? [];
  ws.setVkeys(CborSet.fromCore([...have, ...add], VkeyWitness.fromCore));
  tx.setWitnessSet(ws);
  return tx;
}

export async function fundFromFaucet(provider, payouts /* [{address, lovelace}] */) {
  const f = await faucet();
  const utxos = await ogmiosUtxos(f.address.toBech32());
  if (!utxos.length) throw new Error("faucet has no pure-ADA utxos at " + f.address.toBech32());
  utxos.sort((a, b) => Number(b.output().amount().coin() - a.output().amount().coin()));
  const params = await provider.getParameters();
  let b = new TxBuilder(params).setNetworkId(NetworkId.Testnet).setChangeAddress(f.address).addInput(utxos[0]);
  for (const p of payouts) b = b.payLovelace(p.address, p.lovelace);
  const tx = await b.complete({ useCoinSelection: false });
  addWitnesses(tx, witnessSetFor(tx, f.rawKey));
  const id = await submitRetry(provider, tx);
  return { faucet: f.address.toBech32(), txHash: id };
}

export async function submitRetry(provider, tx, tries = 6) {
  for (let i = 0; ; i++) {
    try { return await provider.postTransactionToChain(tx); }
    catch (e) {
      const s = String(e?.message ?? e) + j(e);
      if (i < tries && /3997|MempoolTxTooSlow/.test(s)) { await sleep(5000); continue; }
      throw e;
    }
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function kupoWait(txHash, tries = 120) {
  for (let i = 0; i < tries; i++) {
    const m = await fetch(`${KUPO}/matches/*@${txHash}`).then((r) => r.json());
    if (m.length) return m;
    await sleep(1000);
  }
  throw new Error("timeout waiting for " + txHash);
}

// Evaluation bypass: a fixed-ExUnits evaluator for TxBuilder.useEvaluator().
export const fixedEvaluator = (mem = 3_000_000n, steps = 2_000_000_000n) => async (tx) => {
  const rs = tx.witnessSet().redeemers();
  const out = rs.values().map((r) => { r.setExUnits(ExUnits.fromCore({ memory: Number(mem), steps: Number(steps) })); return r.toCore(); });
  return Redeemers.fromCore(out);
};

export function errText(e) {
  const parts = [String(e?.message ?? e)];
  try { const s = j(e); if (s && s !== "{}") parts.push(s); } catch {}
  if (e?.cause) parts.push("cause: " + String(e.cause?.message ?? e.cause));
  return parts.join("\n");
}

export { Address, AssetId, AssetName, PolicyId, PlutusData, TransactionId, Value, HexBlob, NetworkId, ExUnits };
