// Arena spike tx shapes built with @evolution-sdk/evolution 0.5.16
import { blake2b } from "@noble/hashes/blake2.js";
import { Effect } from "effect";
import { Evo, KUPO, OGMIOS, loadValidator, protocolParameters } from "./lib.mjs";
const { Data } = Evo;

export function script(file) {
  const v = loadValidator(file);
  const s = new Evo.PlutusV3.PlutusV3({ bytes: Buffer.from(v.compiledCode, "hex") });
  const hash = Evo.ScriptHash.fromScript(s);
  const policyHex = Evo.ScriptHash.toHex(hash);
  if (file === undefined && policyHex !== v.blueprintHash) throw new Error("script hash mismatch");
  const address = new Evo.Address.Address({ networkId: 0, paymentCredential: hash });
  return { s, hash, policyHex, address, bech32: Evo.Address.toBech32(address) };
}
export const seedData = (u) => Data.constr(0n, [Data.bytearray(Evo.TransactionHash.toHex(u.transactionId)), u.index]);
export const threadName = (u) => Buffer.from(blake2b(Data.toCBORBytes(seedData(u)), { dkLen: 32 })).toString("hex");
export const datum = ({ players, moves, name, result }) =>
  Data.constr(0n, [players.map((p) => Data.bytearray(p)), moves.map(BigInt), Data.bytearray(name), BigInt(result)]);

export const signingClient = (chain, key) => Evo.Client.make(chain).withKupmios({ kupoUrl: KUPO, ogmiosUrl: OGMIOS }).withPrivateKey({ paymentKey: key.bech });

// Evaluator that skips evaluation and returns fixed ex-units for every redeemer in the tx (forces phase-2 to the node)
export const fixedEvaluator = (mem = 2_000_000n, steps = 800_000_000n) => ({
  evaluate: (tx) => Effect.sync(() => {
    const rs = tx.witnessSet.redeemers;
    const list = !rs ? [] : rs._tag === "RedeemerMap" ? [...rs.value.keys()].map(([tag, index]) => ({ tag, index: Number(index) })) : rs.value.map((r) => ({ tag: r.tag, index: Number(r.index) }));
    return list.map(({ tag, index }) => ({ redeemer_tag: tag, redeemer_index: index, ex_units: new Evo.Redeemer.ExUnits({ mem, steps }) }));
  }),
});

export async function buildMint({ client, sc, seedUtxo, players, tokenName, datumName, extraOpts = {} }) {
  const name = tokenName ?? threadName(seedUtxo);
  const mintAssets = Evo.Assets.addByHex(Evo.Assets.fromLovelace(0n), sc.policyHex, name, 1n);
  const out = Evo.Assets.addByHex(Evo.Assets.fromLovelace(3_000_000n), sc.policyHex, name, 1n);
  const d = datum({ players, moves: [], name: datumName ?? name, result: -1 });
  const b = client.newTx()
    .collectFrom({ inputs: [seedUtxo] })
    .attachScript({ script: sc.s })
    .mintAssets({ assets: mintAssets, redeemer: seedData(seedUtxo), label: "mint-thread" })
    .payToAddress({ address: sc.address, assets: out, datum: new Evo.InlineDatum.InlineDatum({ data: d }) });
  const pp = await protocolParameters();
  return { name, datum: d, builder: b, build: (o = {}) => b.buildEither({ fullProtocolParameters: pp, ...extraOpts, ...o }) };
}

export async function buildMove({ client, sc, scriptUtxo, state, number, signerKh, extraOpts = {} }) {
  const next = datum({ ...state, moves: [...state.moves, number] });
  const out = Evo.Assets.addByHex(Evo.Assets.fromLovelace(3_000_000n), sc.policyHex, state.name, 1n);
  const b = client.newTx()
    .collectFrom({ inputs: [scriptUtxo], redeemer: BigInt(number), label: "move" })
    .attachScript({ script: sc.s })
    .addSigner({ keyHash: signerKh })
    .payToAddress({ address: sc.address, assets: out, datum: new Evo.InlineDatum.InlineDatum({ data: next }) });
  const pp = await protocolParameters();
  return { next, builder: b, build: (o = {}) => b.buildEither({ fullProtocolParameters: pp, ...extraOpts, ...o }) };
}

export function showErr(e) {
  const parts = [`${e?._tag ?? e?.name}: ${e?.message}`];
  let c = e?.cause, d = 0;
  while (c && d < 6) { parts.push(`  cause[${d}]: ${typeof c === "object" ? (c.message ?? JSON.stringify(c, (_k, v) => typeof v === "bigint" ? v.toString() : v)) : c}`); if (c.failures) parts.push("  failures: " + JSON.stringify(c.failures, (_k, v) => typeof v === "bigint" ? v.toString() : v)); c = c.cause; d++; }
  if (e?.failures) parts.push("  failures: " + JSON.stringify(e.failures, (_k, v) => typeof v === "bigint" ? v.toString() : v));
  return parts.join("\n").slice(0, 4000);
}
