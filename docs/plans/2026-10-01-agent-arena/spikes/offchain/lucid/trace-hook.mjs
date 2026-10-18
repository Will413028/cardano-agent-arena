// Records every module URL resolved, printed at exit grouped by package.
import { registerHooks } from "node:module";
const seen = new Set();
registerHooks({ resolve(spec, ctx, next) { const r = next(spec, ctx); seen.add(r.url); return r; } });
process.on("exit", () => {
  const pk = new Map();
  for (const u of seen) { const m = u.match(/node_modules\/((@[^/]+\/)?[^/]+)/); const k = m ? m[1] : u.startsWith("node:") ? "(node builtin)" : "(local)"; pk.set(k, (pk.get(k) || 0) + 1); }
  console.log(`modules resolved: ${seen.size}; packages: ${[...pk.keys()].filter((k) => !k.startsWith("(")).length}`);
  for (const [k, v] of [...pk].sort()) console.log(`  ${k} (${v})`);
});
