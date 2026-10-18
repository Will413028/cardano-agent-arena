// Item 7: PlutusData encoding + blake2b without tx-building code; Aiken vector check.
import * as Data from "@evolution-sdk/evolution/Data";
import * as CBOR from "@evolution-sdk/evolution/CBOR";
import { blake2b } from "@noble/hashes/blake2.js";

const hex = (u) => Buffer.from(u).toString("hex").toUpperCase();
const EXPECT_CBOR = "D8799F5820000000000000000000000000000000000000000000000000000000000000000102FF";
const EXPECT_NAME = "202F389E4341378FBE9324FA771F648C0BFFA23EE7B77D452EBB9A4865B0D918";

const seed = Data.constr(0n, [Data.bytearray("00".repeat(31) + "01"), 2n]);
const variants = {
  "Data.toCBORHex default": Data.toCBORHex(seed),
  "AIKEN_DEFAULT_OPTIONS": Data.toCBORHex(seed, CBOR.AIKEN_DEFAULT_OPTIONS),
  "CML_DEFAULT_OPTIONS (definite)": Data.toCBORHex(seed, CBOR.CML_DEFAULT_OPTIONS),
};
let ok = true;
for (const [k, v] of Object.entries(variants)) {
  const name = hex(blake2b(Buffer.from(v, "hex"), { dkLen: 32 }));
  const m = v.toUpperCase() === EXPECT_CBOR && name === EXPECT_NAME;
  console.log(`${k}: cbor=${v.toUpperCase()} name=${name} matchAiken=${m}`);
  if (k !== "CML_DEFAULT_OPTIONS (definite)" && !m) ok = false;
}
// Also via the typed plutus OutputReference codec (subpath ./plutus)
const { OutputReference } = await import("@evolution-sdk/evolution/plutus");
const viaCodec = OutputReference.Codec.toCBORHex({ transaction_id: Buffer.from("00".repeat(31) + "01", "hex"), output_index: 2n });
console.log(`plutus.OutputReference.Codec.toCBORHex: ${viaCodec.toUpperCase()} match=${viaCodec.toUpperCase() === EXPECT_CBOR}`);
console.log(ok ? "PASS" : "FAIL");
