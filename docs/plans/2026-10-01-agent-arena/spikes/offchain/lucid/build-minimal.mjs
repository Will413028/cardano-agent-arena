import * as esbuild from "esbuild";
import { wasmLoader } from "esbuild-plugin-wasm";
import { statSync, readdirSync } from "node:fs";
const r = await esbuild.build({ entryPoints: ["item7-minimal-browser.mjs"], bundle: true, platform: "browser", format: "esm",
  outdir: "out/minimal", metafile: true, minify: true, plugins: [wasmLoader({ mode: "deferred" })], inject: ["./buffer-shim.mjs"] });
const pk = new Set(Object.keys(r.metafile.inputs).map((i) => (i.match(/node_modules\/((@[^/]+\/)?[^/]+)/) || [])[1]).filter(Boolean));
console.log("packages in minimal browser bundle:", [...pk].sort().join(", "));
for (const f of readdirSync("out/minimal")) console.log(f.padEnd(50), (statSync("out/minimal/" + f).size / 1048576).toFixed(2), "MiB");
