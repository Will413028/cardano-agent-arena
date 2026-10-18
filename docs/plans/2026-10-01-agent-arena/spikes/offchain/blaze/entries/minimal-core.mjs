// Item 7 entry: PlutusData encoding + blake2b only, from @blaze-cardano/core (no tx builder).
import { PlutusData, ConstrPlutusData, PlutusList, blake2b_256, HexBlob } from "@blaze-cardano/core";
export function tokenName(txHashHex, index) {
  const l = new PlutusList();
  l.add(PlutusData.newBytes(Uint8Array.from(txHashHex.match(/../g).map((h) => parseInt(h, 16)))));
  l.add(PlutusData.newInteger(BigInt(index)));
  const cbor = PlutusData.newConstrPlutusData(new ConstrPlutusData(0n, l)).toCbor();
  return { cbor, name: blake2b_256(HexBlob(cbor)) };
}
