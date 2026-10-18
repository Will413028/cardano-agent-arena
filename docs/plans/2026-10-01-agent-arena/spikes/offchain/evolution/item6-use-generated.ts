// Item 6b: the generated module type-checks/loads and its Datum codec equals hand-built Data
import * as Data from "@evolution-sdk/evolution/Data";
import { SpikeDatum, Spike_spike_spend, Spike_spike_mint } from "./generated/spike-blueprint.ts";
const pkh = (b: string) => Buffer.from(b.repeat(28), "hex");
const d = { players: [pkh("aa"), pkh("bb")], moves: [7n], name: Buffer.from("11".repeat(32), "hex"), result: -1n };
const viaGen = Spike_spike_spend.datum.toCBORHex(d);
const manual = Data.toCBORHex(Data.constr(0n, [[Data.bytearray("aa".repeat(28)), Data.bytearray("bb".repeat(28))], [7n], Data.bytearray("11".repeat(32)), -1n]));
console.log("generated datum cbor:", viaGen);
console.log("manual    datum cbor:", manual);
console.log("roundtrip:", JSON.stringify(Spike_spike_spend.datum.fromCBORHex(viaGen), (_k, v) => typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Buffer.from(v).toString("hex") : v));
console.log("mint redeemer cbor:", Spike_spike_mint.redeemer.toCBORHex({ transaction_id: Buffer.from("00".repeat(31) + "01", "hex"), output_index: 2n }));
console.log(viaGen === manual ? "PASS" : "FAIL");
