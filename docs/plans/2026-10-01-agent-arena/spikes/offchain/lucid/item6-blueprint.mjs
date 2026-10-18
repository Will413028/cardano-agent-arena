// Item 6: lucid-evolution 0.6.5 ships no CIP-57 codegen. Minimal runtime mapper (blueprint -> Data schema)
// to size the "custom generator" work. Static TS types would still need a codegen step.
import { readFileSync } from "node:fs";
import { Data } from "@lucid-evolution/lucid";
import { VALIDATOR_DIR, DatumSchema, datumCbor } from "./lib.mjs";
const bp = JSON.parse(readFileSync(VALIDATOR_DIR + "/plutus.json", "utf8"));
const defs = bp.definitions;
const deref = (s) => (s.$ref ? defs[decodeURIComponent(s.$ref.replace("#/definitions/", "")).replace(/~1/g, "/")] : s);
function toSchema(s) {
  s = deref(s);
  if (s.dataType === "bytes") return Data.Bytes();
  if (s.dataType === "integer") return Data.Integer();
  if (s.dataType === "list") return Data.Array(toSchema(s.items));
  if (s.anyOf && s.anyOf.length === 1 && s.anyOf[0].dataType === "constructor" && s.anyOf[0].index === 0) {
    return Data.Object(Object.fromEntries(s.anyOf[0].fields.map((f) => [f.title, toSchema(f)])));
  }
  throw new Error("unsupported schema shape: " + JSON.stringify(s).slice(0, 120));
}
const Gen = toSchema({ $ref: "#/definitions/spike~1Datum" });
const v = { players: ["aa".repeat(28), "bb".repeat(28)], moves: [7n], name: "cd".repeat(32), result: -1n };
const a = Data.to(v, Gen), b = datumCbor(v);
console.log("generated-schema cbor == hand-written cbor:", a === b);
console.log("roundtrip:", JSON.stringify(Data.from(a, Gen), (_, x) => (typeof x === "bigint" ? `${x}n` : x)));
process.exit(a === b ? 0 : 1);
