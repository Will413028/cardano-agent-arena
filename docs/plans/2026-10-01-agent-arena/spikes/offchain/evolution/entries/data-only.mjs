import * as Data from "@evolution-sdk/evolution/Data";
import { blake2b } from "@noble/hashes/blake2.js";
export const tokenName = (txIdHex, index) =>
  Buffer.from(blake2b(Data.toCBORBytes(Data.constr(0n, [Data.bytearray(txIdHex), BigInt(index)])), { dkLen: 32 })).toString("hex");
