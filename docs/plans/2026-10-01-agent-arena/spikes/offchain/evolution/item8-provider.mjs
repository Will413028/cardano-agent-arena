// Item 8: SDK Kupmios provider against Yaci devnet (Ogmios v7.0.0 / Kupo v2.12.0), unpatched
import { provider, devnetChain, newKey, fund, waitTx, j, Evo } from "./lib.mjs";
const p = provider();
const step = async (name, f) => { try { const r = await f(); console.log(`[OK] ${name}:`, typeof r === "string" ? r : j(r).slice(0, 600)); return r; } catch (e) { console.log(`[FAIL] ${name}: ${e?.message ?? e}`); console.log("  cause:", String(e?.cause?.message ?? e?.cause ?? "").slice(0, 1500)); } };
const chain = await devnetChain();
console.log("chain:", j(chain));
await step("getProtocolParameters", () => p.getProtocolParameters());
const k = newKey("probe");
const f = await fund([{ address: k.address, lovelace: 50_000_000n }], chain); console.log("funded", k.bech32, f.txHash);
await waitTx(f.txHash);
const utxos = await step("getUtxos(address)", () => p.getUtxos(k.address));
await step("getUtxosByOutRef", () => p.getUtxosByOutRef([new Evo.TransactionInput.TransactionInput({ transactionId: utxos[0].transactionId, index: utxos[0].index })]));
await step("awaitTx", () => p.awaitTx(Evo.TransactionHash.fromHex(f.txHash), 1000));
await step("getDelegation(faucet stake addr) [not needed by arena]", async () => "skipped");
