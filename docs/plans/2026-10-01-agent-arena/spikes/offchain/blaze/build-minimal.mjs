// Item 7: esbuild metafile for the minimal entry (browser, same shims as item 5), then run the bundle.
import { build } from "esbuild";
import { writeFileSync, mkdirSync, statSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
mkdirSync("out", { recursive: true });
writeFileSync("out/buffer-shim.mjs", 'import { Buffer } from "buffer"; globalThis.Buffer ??= Buffer; export { Buffer };\n');
const opts = { bundle: true, platform: "browser", format: "esm", minify: true, metafile: true, logLimit: 0,
  alias: { buffer: require.resolve("buffer/"), events: require.resolve("events/") }, inject: ["out/buffer-shim.mjs"], define: { global: "globalThis" } };
let r;
try { r = await build({ ...opts, entryPoints: ["entries/minimal-core.mjs"], outfile: "out/minimal-core.js" }); }
catch (e) { console.log("FAIL", (e.errors ?? []).map((x) => x.text).join("\n")); process.exit(0); }
writeFileSync("out/minimal-core.meta.json", JSON.stringify(r.metafile));
const by = {};
for (const [p, v] of Object.entries(Object.values(r.metafile.outputs)[0].inputs)) {
  const k = p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1] ?? p; by[k] = (by[k] || 0) + v.bytesInOutput;
}
const size = statSync("out/minimal-core.js").size;
console.log("bundle bytes", size, "gzip", gzipSync(readFileSync("out/minimal-core.js")).length, "packages", Object.keys(by).length);
console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k} ${v}`).join("\n"));
globalThis.window = globalThis;
const { tokenName } = await import("./out/minimal-core.js");
const t = tokenName("00".repeat(31) + "01", 2);
const EXP_CBOR = "d8799f5820000000000000000000000000000000000000000000000000000000000000000102ff";
const EXP_NAME = "202f389e4341378fbe9324fa771f648c0bffa23ee7b77d452ebb9a4865b0d918";
console.log("cbor", t.cbor, t.cbor === EXP_CBOR ? "== Aiken vector" : "!= Aiken vector");
console.log("name", t.name, t.name === EXP_NAME ? "== Aiken vector" : "!= Aiken vector");
console.log("STATUS", t.cbor === EXP_CBOR && t.name === EXP_NAME ? "PASS" : "FAIL");
process.exit(0);
