// Shared helpers for the lucid-evolution 0.6.5 spike. Throwaway code.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Lucid, Kupmios, Emulator, Data, Constr, CML,
  applyDoubleCborEncoding, validatorToAddress, mintingPolicyToId,
  generatePrivateKey, toUnit, paymentCredentialOf,
  generateEmulatorAccountFromPrivateKey, walletFromSeed,
} from "@lucid-evolution/lucid";

const here = dirname(fileURLToPath(import.meta.url));
export const VALIDATOR_DIR = join(here, "..", "validator");

export const KUPO = "http://127.0.0.1:57771";
export const OGMIOS = "http://127.0.0.1:57772";
export const YACI_ADMIN = "http://127.0.0.1:57770";

export function loadScript(which = "correct") {
  const file = which === "mutant" ? "plutus.mutant-no-name-check.json" : "plutus.json";
  const bp = JSON.parse(readFileSync(join(VALIDATOR_DIR, file), "utf8"));
  const v = bp.validators.find((x) => x.title === "spike.spike.mint");
  const script = { type: "PlutusV3", script: applyDoubleCborEncoding(v.compiledCode) };
  const policyId = mintingPolicyToId(script);
  if (policyId !== v.hash) throw new Error(`policy id mismatch ${policyId} vs ${v.hash}`);
  return { script, policyId, address: validatorToAddress("Custom", script), file };
}

// Hand-written schemas (lucid has no CIP-57 codegen, see item 6).
export const OutputReferenceSchema = Data.Object({
  transaction_id: Data.Bytes(),
  output_index: Data.Integer(),
});
export const DatumSchema = Data.Object({
  players: Data.Array(Data.Bytes()),
  moves: Data.Array(Data.Integer()),
  name: Data.Bytes(),
  result: Data.Integer(),
});

export function seedCbor(txHash, index) {
  return Data.to({ transaction_id: txHash, output_index: BigInt(index) }, OutputReferenceSchema);
}

// blake2b_256 over the exact CBOR bytes. CML.hash_plutus_data hashes the
// original encoding preserved by from_cbor_hex (checked against Aiken vector).
export function blake2b256Hex(cborHex) {
  return CML.hash_plutus_data(CML.PlutusData.from_cbor_hex(cborHex)).to_hex();
}

export function threadName(txHash, index) {
  return blake2b256Hex(seedCbor(txHash, index));
}

export function datumCbor({ players, moves, name, result }) {
  return Data.to({ players, moves, name, result }, DatumSchema);
}

export const DEVNET_SLOT_CONFIG = async () => {
  const r = await ogmios("queryNetwork/genesisConfiguration", { era: "shelley" });
  return { zeroTime: Date.parse(r.startTime), zeroSlot: 0, slotLength: r.slotLength.milliseconds };
};

export async function ogmios(method, params) {
  const res = await fetch(OGMIOS, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const j = await res.json();
  if (j.error) { const e = new Error(JSON.stringify(j.error)); e.rpc = j.error; throw e; }
  return j.result;
}

// WORKAROUND for item 8: Kupmios.getProtocolParameters() throws a ParseError because the
// devnet ledger has no plutus:v2 cost model (Yaci "cost models governance proposal failed").
// This replicates Kupmios' own toProtocolParameters mapping, with PlutusV2 defaulting to [].
export async function devnetProtocolParameters() {
  const r = await ogmios("queryLedgerState/protocolParameters", {});
  const cm = r.plutusCostModels;
  return {
    minFeeA: r.minFeeCoefficient,
    minFeeB: r.minFeeConstant.ada.lovelace,
    maxTxSize: r.maxTransactionSize.bytes,
    maxValSize: r.maxValueSize.bytes,
    keyDeposit: BigInt(r.stakeCredentialDeposit.ada.lovelace),
    poolDeposit: BigInt(r.stakePoolDeposit.ada.lovelace),
    drepDeposit: BigInt(r.delegateRepresentativeDeposit.ada.lovelace),
    govActionDeposit: BigInt(r.governanceActionDeposit.ada.lovelace),
    priceMem: evalRatio(r.scriptExecutionPrices.memory),
    priceStep: evalRatio(r.scriptExecutionPrices.cpu),
    maxTxExMem: BigInt(r.maxExecutionUnitsPerTransaction.memory),
    maxTxExSteps: BigInt(r.maxExecutionUnitsPerTransaction.cpu),
    coinsPerUtxoByte: BigInt(r.minUtxoDepositCoefficient),
    collateralPercentage: r.collateralPercentage,
    maxCollateralInputs: r.maxCollateralInputs,
    minFeeRefScriptCostPerByte: r.minFeeReferenceScripts.base,
    costModels: { PlutusV1: [...(cm["plutus:v1"] ?? [])], PlutusV2: [...(cm["plutus:v2"] ?? [])], PlutusV3: [...(cm["plutus:v3"] ?? [])] },
  };
}
function evalRatio(x) { const [a, b] = String(x).split("/").map(Number); return b ? a / b : a; }

export async function makeDevnetLucid({ preset = true, kupmiosOptions } = {}) {
  const slotConfig = await DEVNET_SLOT_CONFIG();
  const provider = new Kupmios(KUPO, OGMIOS, kupmiosOptions);
  const opts = { slotConfig };
  if (preset) opts.presetProtocolParameters = await devnetProtocolParameters();
  const lucid = await Lucid(provider, "Custom", opts);
  return { lucid, provider, slotConfig };
}

// Yaci DevKit public default test mnemonic (well-known, not a secret), account 0 = 10000 ADA at genesis.
export const YACI_TEST_MNEMONIC = Array(23).fill("test").join(" ") + " sauce";
export async function fundFromFaucet(lucid, addrs, lovelace = 1_000_000_000n) {
  lucid.selectWallet.fromSeed(YACI_TEST_MNEMONIC, { accountIndex: 0 });
  const faucet = await lucid.wallet().address();
  // Genesis UTxOs are not in any block, so Kupo never indexes them: read them from Ogmios.
  const raw = await ogmios("queryLedgerState/utxo", { addresses: [faucet] });
  const presetWalletInputs = raw
    .filter((u) => Object.keys(u.value).length === 1)
    .map((u) => ({ txHash: u.transaction.id, outputIndex: u.index, address: u.address, assets: { lovelace: BigInt(u.value.ada.lovelace) } }));
  let tx = lucid.newTx();
  for (const a of addrs) tx = tx.pay.ToAddress(a, { lovelace });
  const done = await tx.complete({ presetWalletInputs });
  // sign.withWallet() for a seed wallet only signs for key hashes it discovers in its own
  // provider-visible UTxOs (Kupo: none) -> 3101 missingSignatories. Sign with the derived key instead.
  const { paymentKey } = walletFromSeed(YACI_TEST_MNEMONIC, { accountIndex: 0, network: "Custom" });
  const hash = await (await done.sign.withPrivateKey(paymentKey).complete()).submit();
  await lucid.awaitTx(hash);
  return hash;
}

export function newKey(label) {
  const sk = generatePrivateKey();
  const pk = CML.PrivateKey.from_bech32(sk);
  const pkh = pk.to_public().hash().to_hex();
  const addr = CML.EnterpriseAddress.new(0, CML.Credential.new_pub_key(pk.to_public().hash())).to_address().to_bech32();
  return { label, sk, pkh, addr };
}

export async function topup(address, ada = 1000) {
  const r = await fetch(`${YACI_ADMIN}/local-cluster/api/addresses/topup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, adaAmount: ada }),
  });
  return `${r.status} ${await r.text()}`;
}

export async function waitFor(fn, label, timeoutMs = 60000) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export async function kupoMatches(pattern, extra = "") {
  const r = await fetch(`${KUPO}/matches/${pattern}?unspent${extra}`);
  return r.json();
}

export async function makeEmulatorLucid(keys) {
  const accounts = keys.map((k) => {
    // generateEmulatorAccountFromPrivateKey generates its own key; we use our own keys
    // by constructing the account object directly (same shape).
    return { address: k.addr, privateKey: k.sk, seedPhrase: "", assets: { lovelace: 1_000_000_000n } };
  });
  const emulator = new Emulator(accounts);
  const lucid = await Lucid(emulator, "Custom");
  return { lucid, emulator };
}

export { Data, Constr, CML, toUnit, paymentCredentialOf, generateEmulatorAccountFromPrivateKey };

export function j(x) {
  return JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() + "n" : v), 2);
}
