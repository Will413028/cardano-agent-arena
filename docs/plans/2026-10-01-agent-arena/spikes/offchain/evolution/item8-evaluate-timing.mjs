// Item 8d: time Ogmios evaluateTransaction for valid vs invalid (arbitrary token name) mint txs; SDK's Kupmios has a hard 10s timeout.
import { devnetChain, newKey, fund, waitTx, ogmios, Evo } from "./lib.mjs";
import { script, signingClient, buildMint, threadName, fixedEvaluator } from "./game.mjs";
const chain = await devnetChain(); const sc = script();
const alice = newKey("alice"), bob = newKey("bob");
const f = await fund([{ address: alice.address, lovelace: 100_000_000n }, { address: alice.address, lovelace: 100_000_000n }], chain); await waitTx(f.txHash);
const ca = signingClient(chain, alice); const [seed] = await ca.getWalletUtxos();
for (const [label, tok] of [["valid", threadName(seed)], ["arbitrary token name", "deadbeef"]]) {
  const m = await buildMint({ client: ca, sc, seedUtxo: seed, players: [alice.khHex, bob.khHex], tokenName: tok, datumName: threadName(seed), extraOpts: { evaluator: fixedEvaluator() } });
  const cbor = Evo.Transaction.toCBORHex(await (await m.build()).right.toTransaction());
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now(); let out;
    try { out = "OK " + JSON.stringify(await ogmios("evaluateTransaction", { transaction: { cbor } })); } catch (e) { out = "ERR " + e.message.slice(0, 250); }
    console.log(`[${label} #${i}] ${Date.now() - t0} ms: ${out}`);
  }
}
