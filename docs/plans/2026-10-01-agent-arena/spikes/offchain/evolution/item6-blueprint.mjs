// Item 6: generate typed schemas from CIP-57 plutus.json via @evolution-sdk/evolution/blueprint
import { readFileSync, writeFileSync } from "node:fs";
import { Codegen, CodegenConfig } from "@evolution-sdk/evolution/blueprint";
const bp = JSON.parse(readFileSync(new URL("../validator/plutus.json", import.meta.url)));
const cfg = CodegenConfig.createCodegenConfig({
  imports: { data: 'import * as Data from "@evolution-sdk/evolution/Data"', tschema: 'import * as TSchema from "@evolution-sdk/evolution/TSchema"', schema: 'import { Schema } from "effect"' },
});
const ts = Codegen.generateTypeScript(bp, cfg);
writeFileSync(new URL("./generated/spike-blueprint.ts", import.meta.url), ts);
console.log(ts);
