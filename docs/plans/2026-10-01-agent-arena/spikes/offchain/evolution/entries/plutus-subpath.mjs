import { OutputReference } from "@evolution-sdk/evolution/plutus";
export const enc = (o) => OutputReference.Codec.toCBORHex(o);
