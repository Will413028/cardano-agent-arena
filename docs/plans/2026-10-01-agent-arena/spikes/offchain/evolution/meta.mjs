import * as esbuild from "esbuild";
for (const e of process.argv.slice(2)) {
  const r = await esbuild.build({ entryPoints: [e], bundle: true, platform: "browser", format: "esm", minify: true, metafile: true, write: true, outfile: `out/${e.split("/").pop().replace(".mjs","")}.js`, logLevel: "warning", define: { "process.env.NODE_ENV": '"production"' } });
  const inputs = Object.keys(r.metafile.inputs);
  const out = Object.values(r.metafile.outputs)[0];
  const evo = inputs.filter(i => i.includes("@evolution-sdk")).map(i => i.replace(/.*evolution\/dist\//, ""));
  const builder = evo.filter(i => i.startsWith("sdk/"));
  console.log(`== ${e}: bundle ${out.bytes} bytes minified, ${inputs.length} input files, evolution modules ${evo.length}, sdk/ (tx-builder/provider) modules ${builder.length}`);
  console.log("  evolution modules:", evo.join(" "));
  const pkgs = [...new Set(inputs.map(i => (i.match(/node_modules\/((@[^/]+\/)?[^/]+)/)||[])[1]).filter(Boolean))];
  console.log("  packages:", pkgs.join(" "));
}
