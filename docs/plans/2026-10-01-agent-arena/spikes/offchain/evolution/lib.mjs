// Shared helpers for the evolution-sdk 0.5.16 spike (devnet: Yaci DevKit, magic 42)
import { readFileSync } from "node:fs";
import * as Evo from "@evolution-sdk/evolution";
import { KupmiosProvider } from "@evolution-sdk/evolution/sdk/provider/Kupmios";

export const KUPO = "http://127.0.0.1:57780";
export const OGMIOS = "http://127.0.0.1:57778";
export const ADMIN = "http://127.0.0.1:57779";

export async function devnetChain() {
  const r = await fetch(OGMIOS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "queryNetwork/genesisConfiguration", params: { era: "shelley" } }) }).then((x) => x.json());
  const g = r.result;
  return { id: 0, name: "yaci-devnet", networkMagic: g.networkMagic, epochLength: g.epochLength,
    slotConfig: { zeroTime: BigInt(Date.parse(g.startTime)), zeroSlot: 0n, slotLength: g.slotLength.milliseconds } };
}

export function newKey(label) {
  const sk = Evo.PrivateKey.fromBytes(Evo.PrivateKey.generate());
  const bech = Evo.PrivateKey.toBech32(sk);
  const kh = Evo.KeyHash.fromPrivateKey(sk);
  const address = new Evo.Address.Address({ networkId: 0, paymentCredential: kh });
  return { label, sk, bech, kh, khHex: Evo.KeyHash.toHex(kh), address, bech32: Evo.Address.toBech32(address) };
}

export async function topup(addrBech32, ada = 1000) {
  const r = await fetch(`${ADMIN}/local-cluster/api/addresses/topup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: addrBech32, adaAmount: ada }) });
  return `${r.status} ${await r.text()}`;
}

export async function kupoMatches(pattern, extra = "") {
  return fetch(`${KUPO}/matches/${pattern}?unspent${extra}`).then((r) => r.json());
}

export async function waitKupo(pattern, pred = (m) => m.length > 0, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const m = await kupoMatches(pattern);
    if (pred(m)) return m;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timeout waiting kupo ${pattern}`);
}

export function loadValidator(file = "plutus.json") {
  const bp = JSON.parse(readFileSync(new URL(`../validator/${file}`, import.meta.url)));
  const v = bp.validators.find((x) => x.title === "spike.spike.mint");
  return { blueprintHash: v.hash, compiledCode: v.compiledCode };
}

export const provider = () => new KupmiosProvider(KUPO, OGMIOS);
export const j = (x) => JSON.stringify(x, (_k, v) => (typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v), 2);
export { Evo };

// ---- Workarounds (see RESULT.md "surprises") ----
export async function ogmios(method, params = {}) {
  const r = await fetch(OGMIOS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method, params, id: null }) }).then((x) => x.json());
  if (r.error) { const e = new Error(`ogmios ${method}: ${JSON.stringify(r.error)}`); e.ogmios = r.error; throw e; }
  return r.result;
}
const ratio = (s) => { const [a, b] = String(s).split("/").map(Number); return a / b; };
// Hand-mapped ProtocolParameters, because KupmiosProvider.getProtocolParameters fails against Ogmios v7
// (field maxReferenceScriptsSize renamed to maxReferenceScriptsSizePerTransaction) and this devnet has no plutus:v2 cost model.
export async function protocolParameters() {
  const r = await ogmios("queryLedgerState/protocolParameters");
  const cm = (k) => Object.fromEntries((r.plutusCostModels[k] ?? []).map((v, i) => [String(i), Number(v)]));
  return {
    minFeeA: Number(r.minFeeCoefficient), minFeeB: Number(r.minFeeConstant.ada.lovelace),
    maxTxSize: Number(r.maxTransactionSize.bytes), maxValSize: Number(r.maxValueSize.bytes),
    keyDeposit: BigInt(r.stakeCredentialDeposit.ada.lovelace), poolDeposit: BigInt(r.stakePoolDeposit.ada.lovelace),
    drepDeposit: BigInt(r.delegateRepresentativeDeposit.ada.lovelace), govActionDeposit: BigInt(r.governanceActionDeposit.ada.lovelace),
    priceMem: ratio(r.scriptExecutionPrices.memory), priceStep: ratio(r.scriptExecutionPrices.cpu),
    maxTxExMem: BigInt(r.maxExecutionUnitsPerTransaction.memory), maxTxExSteps: BigInt(r.maxExecutionUnitsPerTransaction.cpu),
    coinsPerUtxoByte: BigInt(r.minUtxoDepositCoefficient), collateralPercentage: Number(r.collateralPercentage),
    maxCollateralInputs: Number(r.maxCollateralInputs), minFeeRefScriptCostPerByte: Number(r.minFeeReferenceScripts.base),
    costModels: { PlutusV1: cm("plutus:v1"), PlutusV2: cm("plutus:v2"), PlutusV3: cm("plutus:v3") },
  };
}
// Genesis UTxOs are not indexed by Kupo, so the faucet's first UTxO is read via Ogmios.
export async function ogmiosUtxos(addrBech32) {
  const res = await ogmios("queryLedgerState/utxo", { addresses: [addrBech32] });
  return res.map((u) => {
    let assets = Evo.Assets.fromLovelace(BigInt(u.value.ada.lovelace));
    for (const [pid, toks] of Object.entries(u.value)) if (pid !== "ada") for (const [n, q] of Object.entries(toks)) assets = Evo.Assets.addByHex(assets, pid, n, BigInt(q));
    if (u.datum || u.script) throw new Error("faucet utxo with datum/script not handled");
    return new Evo.UTxO.UTxO({ transactionId: Evo.TransactionHash.fromHex(u.transaction.id), index: BigInt(u.index), address: Evo.Address.fromBech32(u.address), assets });
  });
}
// Faucet = Yaci's public default test mnemonic, account index 1 (m/1852'/1815'/1'/0/0). Public, well-known, not a secret.
export const FAUCET_MNEMONIC = "test test test test test test test test test test test test test test test test test test test test test test test sauce";
export async function fund(payouts /* [{address, lovelace}] */, chain) {
  const pp = await protocolParameters();
  const client = Evo.Client.make(chain).withKupmios({ kupoUrl: KUPO, ogmiosUrl: OGMIOS }).withSeed({ mnemonic: FAUCET_MNEMONIC, accountIndex: 1 });
  const faucetAddr = await client.address();
  const fbech = Evo.Address.toBech32(faucetAddr);
  const utxos = await ogmiosUtxos(fbech); // ledger view (includes genesis utxo)
  let tx = client.newTx();
  for (const p of payouts) tx = tx.payToAddress({ address: p.address, assets: Evo.Assets.fromLovelace(p.lovelace) });
  const signB = await tx.build({ availableUtxos: utxos, fullProtocolParameters: pp });
  const hash = await signB.signAndSubmit();
  return { faucet: fbech, txHash: Evo.TransactionHash.toHex(hash) };
}
export async function waitTx(txHashHex, tries = 90) {
  for (let i = 0; i < tries; i++) {
    const m = await fetch(`${KUPO}/matches/*@${txHashHex}`).then((r) => r.json());
    if (m.length) return m;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("timeout waiting for " + txHashHex);
}
