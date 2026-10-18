// Item 5: esbuild browser bundles (--bundle --platform=browser --format=esm) with the minimum shims found.
// Variant "full":   buffer+events aliases, Buffer global inject, esbuild-plugin-wasm for the
//                   cardano-message-signing-browser wasm, nodejs variant marked external (window branch never loads it).
// Variant "nosign": same, but both cardano-message-signing packages external (WebWallet/HotWallet signData unusable).
import { build } from "esbuild";
import { wasmLoader } from "esbuild-plugin-wasm";
import { writeFileSync, statSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
mkdirSync("out", { recursive: true });
writeFileSync("out/buffer-shim.mjs", 'import { Buffer } from "buffer"; globalThis.Buffer ??= Buffer; export { Buffer };\n');
const common = {
  bundle: true, platform: "browser", format: "esm", minify: true, logLimit: 0, metafile: true,
  alias: { buffer: require.resolve("buffer/"), events: require.resolve("events/") },
  inject: ["out/buffer-shim.mjs"],
  define: { global: "globalThis" },
};
const variants = {
  full: { external: ["@emurgo/cardano-message-signing-nodejs"], plugins: [wasmLoader({ mode: "embedded" })] },
  nosign: { external: ["@emurgo/cardano-message-signing-nodejs", "@emurgo/cardano-message-signing-browser"] },
};
const report = {};
for (const [name, v] of Object.entries(variants)) {
  const outfile = `out/browser-${name}.js`;
  try {
    const r = await build({ ...common, ...v, entryPoints: ["entries/browser-full.mjs"], outfile });
    writeFileSync(`out/browser-${name}.meta.json`, JSON.stringify(r.metafile));
    const size = statSync(outfile).size;
    const gz = gzipSync(readFileSync(outfile)).length;
    const pkgs = new Set(Object.keys(r.metafile.inputs).map((p) => p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean));
    report[name] = { ok: true, bytes: size, gzipBytes: gz, warnings: r.warnings.length, packages: pkgs.size };
  } catch (e) {
    report[name] = { ok: false, errors: (e.errors ?? [String(e)]).map((x) => x.text ?? x) };
  }
}
console.log(JSON.stringify(report, null, 2));
