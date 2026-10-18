// Item 1 (devnet): fresh alice/bob, fund, mint thread token with inline datum, alice moves 7; confirm via Kupo.
import { devnetProvider, fundFromFaucet, kupoWait, submitRetry, j, errText, log, KUPO } from "./lib.mjs";
import { players, buildMint, buildMove, summarizeTx } from "./game.mjs";

const out = [];
const p = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : j(x))).join(" "); console.log(s); out.push(s); };
const t0 = Date.now();
const el = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
let status = "FAIL";
try {
  const provider = await devnetProvider();
  const { alice, bob } = await players(provider);
  p("alice", alice.address.toBech32(), "pkh", alice.pkh);
  p("bob  ", bob.address.toBech32(), "pkh", bob.pkh);
  const f = await fundFromFaucet(provider, [
    { address: alice.address, lovelace: 50_000_000n }, { address: alice.address, lovelace: 10_000_000n },
    { address: bob.address, lovelace: 50_000_000n }, { address: bob.address, lovelace: 10_000_000n }]);
  p(el(), "fund tx", f);
  await kupoWait(f.txHash);
  p(el(), "fund confirmed in Kupo");

  const m = await buildMint(provider, alice, { playerPkhs: [alice.pkh, bob.pkh] });
  p(el(), "mint built", summarizeTx(m.tx), "seed", m.seed, "name", m.name);
  const signed = await m.blaze.signTransaction(m.tx);
  const mintId = await submitRetry(provider, signed);
  p(el(), "mint submitted", mintId);
  const km = await kupoWait(mintId);
  p(el(), "mint in Kupo", km.map((x) => ({ out: `${x.transaction_id}#${x.output_index}`, address: x.address, value: x.value, datum_type: x.datum_type })));

  const [thread] = await provider.getUnspentOutputsWithAsset(m.S.address, m.unit);
  p(el(), "thread utxo via Kupmios", `${thread.input().transactionId()}#${thread.input().index()}`,
    "inline datum == built:", thread.output().datum()?.asInlineData()?.toCbor() === m.datum.toCbor());

  const mv = await buildMove(provider, alice, thread, { players: [alice.pkh, bob.pkh], moves: [], name: m.name, unit: m.unit }, 7);
  p(el(), "alice move built (evaluated by Ogmios)", summarizeTx(mv.tx));
  const s2 = await mv.blaze.signTransaction(mv.tx);
  const moveId = await submitRetry(provider, s2);
  p(el(), "move submitted", moveId);
  const k2 = await kupoWait(moveId);
  const datumHash = k2.find((x) => x.datum_hash)?.datum_hash;
  let datumCbor;
  if (datumHash) datumCbor = (await fetch(`${KUPO}/datums/${datumHash}`).then((r) => r.json()))?.datum;
  p(el(), "move in Kupo", k2.map((x) => ({ out: `${x.transaction_id}#${x.output_index}`, address: x.address, value: x.value })), "next datum (Kupo):", datumCbor);
  status = "PASS";
} catch (e) {
  p(el(), "ERROR", errText(e), e?.stack ?? "");
}
p("STATUS", status);
log("item1-devnet.txt", "$ node item1-devnet.mjs\n" + out.join("\n") + "\n");
process.exit(0);
