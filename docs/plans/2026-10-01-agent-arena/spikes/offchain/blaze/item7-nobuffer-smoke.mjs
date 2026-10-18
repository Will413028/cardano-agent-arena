// Item 7/5: simulate a browser without a Buffer global (Node with globalThis.Buffer deleted).
globalThis.window = globalThis; delete globalThis.Buffer;
for (const f of ["./out/minimal-plain.js", "./out/minimal-core.js"]) {
  try { const { tokenName } = await import(f); console.log(f, "OK", tokenName("00".repeat(31) + "01", 2).name); }
  catch (e) { console.log(f, "FAIL", String(e)); }
}
