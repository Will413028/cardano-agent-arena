// Item 5b: browser bundle with workarounds (wasm ESM-integration plugin + node builtin polyfills).
import * as esbuild from "esbuild";
import { wasmLoader } from "esbuild-plugin-wasm";
import { statSync, readdirSync, writeFileSync } from "node:fs";
const r = await esbuild.build({
  entryPoints: ["browser-entry.mjs"], bundle: true, platform: "browser", format: "esm",
  outdir: "out/browser-fixed", metafile: true, minify: true, target: "es2022",
  plugins: [wasmLoader({ mode: "deferred" })],
  alias: { buffer: "buffer", events: "events" },
  inject: ["./buffer-shim.mjs"],
  logLimit: 0,
});
writeFileSync("out/browser-fixed-meta.json", JSON.stringify(r.metafile));
console.log("warnings:", r.warnings.length);
let total = 0;
for (const f of readdirSync("out/browser-fixed")) { const s = statSync("out/browser-fixed/" + f).size; total += s; console.log(f.padEnd(60), (s / 1024 / 1024).toFixed(2), "MiB"); }
console.log("TOTAL", (total / 1024 / 1024).toFixed(2), "MiB");
