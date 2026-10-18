// Item 8e (diagnostic, offline): decode the saved Ogmios v7 protocolParameters with the SDK's own schema, then with the v7 rename undone,
// to list every incompatibility (not only the first one reported). Does not touch the devnet.
import { readFileSync } from "node:fs";
import { Schema, Either } from "effect";
import * as Ogmios from "@evolution-sdk/evolution/sdk/provider/internal/Ogmios";
// same number-as-text reviver the SDK HttpUtils uses before schema decoding
const raw = JSON.parse(readFileSync(new URL("./logs/ogmios-v7-protocolParameters.json", import.meta.url), "utf8"), (_k, v, ctx) => (typeof v === "number" ? ctx.source : v)).result;
const dec = (x) => Schema.decodeUnknownEither(Ogmios.ProtocolParametersSchema)(x, { errors: "all" });
const show = (label, x) => { const r = dec(x); console.log(`[${label}]`, Either.isRight(r) ? "decodes OK" : String(r.left.message ?? r.left)); };
show("as returned by Ogmios v7.0.0 on this devnet", raw);
const renamed = { ...raw, maxReferenceScriptsSize: raw.maxReferenceScriptsSizePerTransaction };
show("with maxReferenceScriptsSizePerTransaction copied to maxReferenceScriptsSize", renamed);
show("plus an empty plutus:v2 cost model", { ...renamed, plutusCostModels: { ...renamed.plutusCostModels, "plutus:v2": [] } });
