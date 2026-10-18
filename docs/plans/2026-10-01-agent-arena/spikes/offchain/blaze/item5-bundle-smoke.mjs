// Item 5 runtime smoke (NOT a real browser): import the browser bundle in Node with window defined and
// Node's global WebSocket/fetch, connect to devnet through Kupmios + WebWallet(mock CIP-30), read params.
globalThis.window = globalThis;
const which = process.argv[2] ?? "full";
const { connect } = await import(`./out/browser-${which}.js`);
const cip30 = { getNetworkId: async () => 0, getUtxos: async () => [], getChangeAddress: async () => "", signTx: async () => { throw new Error("n/a"); } };
try {
  const { blaze, Core } = await connect(cip30, "http://127.0.0.1:57771", "ws://127.0.0.1:57772");
  console.log(which, "OK params.protocolVersion", JSON.stringify(blaze.params.protocolVersion), "costModels", [...blaze.params.costModels.keys()]);
  console.log(which, "blake2b_256('')", Core.blake2b_256(Core.HexBlob("")));
} catch (e) { console.log(which, "FAIL", e?.stack ?? e); }
process.exit(0);
