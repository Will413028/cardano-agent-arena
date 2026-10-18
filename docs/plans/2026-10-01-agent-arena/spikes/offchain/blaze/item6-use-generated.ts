// Item 6: use the @blaze-cardano/blueprint 0.9.0 generated module (generated/plutus.ts, run via Node type stripping)
// and compare its CBOR to the hand-built raw PlutusData from lib.mjs.
import { Datum, SpikeSpikeMint, SpikeSpikeSpend } from "./generated/plutus.ts";
import { serialize } from "@blaze-cardano/data";
import { datumData, seedData, intData, loadScript } from "./lib.mjs";

const alice = "11".repeat(28), bob = "22".repeat(28);
const name = "202f389e4341378fbe9324fa771f648c0bffa23ee7b77d452ebb9a4865b0d918";
const cases: [string, any][] = [
  ["empty moves", { players: [alice, bob], moves: [], name, result: -1n }],
  ["moves [7]", { players: [alice, bob], moves: [7n], name, result: -1n }],
  ["moves [7,3,1000000]", { players: [alice, bob], moves: [7n, 3n, 1000000n], name, result: 2n }],
];
const spend = new SpikeSpikeSpend();
const mint = new SpikeSpikeMint();
let ok = true;
for (const [label, v] of cases) {
  const gen = spend.datum(v).toCbor();
  const gen2 = serialize(Datum, v).toCbor();
  const hand = datumData({ ...v, moves: v.moves.map(Number), result: Number(v.result) }).toCbor();
  const eq = gen === hand && gen2 === hand;
  ok &&= eq;
  console.log(label, eq ? "EQUAL" : "DIFF", "\n  generated:", gen, "\n  hand-built:", hand);
}
const r1 = mint.redeemer({ transaction_id: "00".repeat(31) + "01", output_index: 2n }).toCbor();
const r2 = seedData("00".repeat(31) + "01", 2).toCbor();
console.log("mint redeemer", r1 === r2 ? "EQUAL" : "DIFF", r1);
const s1 = spend.redeemer(7n).toCbor(), s2 = intData(7).toCbor();
console.log("spend redeemer", s1 === s2 ? "EQUAL" : "DIFF", s1);
const L = loadScript();
console.log("generated script hash", spend.Script.hash(), "== blueprint", spend.Script.hash() === L.policyId, "mint==spend script", mint.Script.hash() === spend.Script.hash());
ok &&= r1 === r2 && s1 === s2 && spend.Script.hash() === L.policyId;
console.log("STATUS", ok ? "PASS" : "FAIL");
