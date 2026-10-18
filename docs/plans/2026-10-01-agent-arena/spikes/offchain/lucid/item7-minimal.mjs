// Item 7: PlutusData encoding + blake2b without the tx builder: import only @lucid-evolution/plutus.
import { Data } from "@lucid-evolution/plutus";
import { blake2b } from "@noble/hashes/blake2b"; // transitive dep here; would be a direct dep in production
const Seed = Data.Object({ transaction_id: Data.Bytes(), output_index: Data.Integer() });
const cbor = Data.to({ transaction_id: "00".repeat(31) + "01", output_index: 2n }, Seed);
const name = Buffer.from(blake2b(Buffer.from(cbor, "hex"), { dkLen: 32 })).toString("hex");
console.log("cbor", cbor);
console.log("name", name, name === "202f389e4341378fbe9324fa771f648c0bffa23ee7b77d452ebb9a4865b0d918" ? "MATCH" : "DIFF");
console.log("rss MiB", (process.memoryUsage().rss / 1048576).toFixed(0));
