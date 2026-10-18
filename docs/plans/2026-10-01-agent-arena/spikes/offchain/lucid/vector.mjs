// Item 7b: token name vector vs Aiken.
import { seedCbor, threadName, OutputReferenceSchema, Data, CML } from "./lib.mjs";
const tx = "00".repeat(31) + "01";
const want = { cbor: "D8799F5820000000000000000000000000000000000000000000000000000000000000000102FF", name: "202F389E4341378FBE9324FA771F648C0BFFA23EE7B77D452EBB9A4865B0D918" };
const def = seedCbor(tx, 2);
const canon = Data.to({ transaction_id: tx, output_index: 2n }, OutputReferenceSchema, { canonical: true });
const name = threadName(tx, 2);
console.log("default   cbor:", def, def.toUpperCase() === want.cbor ? "MATCH" : "DIFF");
console.log("canonical cbor:", canon, canon.toUpperCase() === want.cbor ? "MATCH" : "DIFF (definite list)");
console.log("name          :", name, name.toUpperCase() === want.name ? "MATCH" : "DIFF");
console.log("name(canon)   :", CML.hash_plutus_data(CML.PlutusData.from_cbor_hex(canon)).to_hex());
const { blake2b } = await import("@noble/hashes/blake2b");
const nb = Buffer.from(blake2b(Buffer.from(def, "hex"), { dkLen: 32 })).toString("hex");
console.log("noble blake2b :", nb, nb.toUpperCase() === want.name ? "MATCH" : "DIFF");
process.exit(def.toUpperCase() === want.cbor && name.toUpperCase() === want.name ? 0 : 1);
