// Item 4 (devnet): build an unsigned tx spending one alice input and one bob input; alice signs through an
// external CIP-30-style mock signTx(txCborHex, partialSign) -> witnessSetCborHex (also via Blaze's WebWallet
// wrapper), bob signs with a plain local key; assemble; submit; confirm via Kupo.
import { WebWallet } from "@blaze-cardano/sdk";
import { devnetProvider, fundFromFaucet, kupoWait, submitRetry, witnessSetFor, addWitnesses, newWallet, Core, TxBuilder, j, errText, log } from "./lib.mjs";

const out = [];
const p = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : j(x))).join(" "); console.log(s); out.push(s); };
let status = "FAIL";
try {
  const provider = await devnetProvider();
  const alice = newWallet(provider);
  const bob = newWallet(provider);
  const f = await fundFromFaucet(provider, [{ address: alice.address, lovelace: 20_000_000n }, { address: bob.address, lovelace: 20_000_000n }]);
  await kupoWait(f.txHash);

  // External CIP-30-style mock (only this closure sees alice's key; the dApp side only gets CBOR hex).
  const cip30 = {
    async signTx(txCborHex, partialSign) {
      const tx = Core.Transaction.fromCbor(Core.TxCBOR(txCborHex));
      if (!partialSign) throw new Error("mock requires partialSign=true for multi-party tx");
      return witnessSetFor(tx, alice.rawKey);
    },
    async getNetworkId() { return 0; },
  };

  const params = await provider.getParameters();
  const [ua] = await provider.getUnspentOutputs(alice.address);
  const [ub] = await provider.getUnspentOutputs(bob.address);
  const unsigned = await new TxBuilder(params).setNetworkId(Core.NetworkId.Testnet).setChangeAddress(alice.address)
    .addInput(ua).addInput(ub).payLovelace(bob.address, 25_000_000n).complete({ useCoinSelection: false });
  const unsignedHex = unsigned.toCbor();
  p("unsigned tx id", unsigned.getId(), "vkeys before:", (unsigned.witnessSet().vkeys()?.toCore() ?? []).length, "bytes:", unsignedHex.length / 2);

  // (a) raw CIP-30 mock call
  const wsAlice = await cip30.signTx(unsignedHex, true);
  p("alice witness set from CIP-30 mock:", wsAlice.slice(0, 40) + "...");
  // (b) Blaze's WebWallet wrapper around the same mock (what a browser dApp would use)
  const ww = new WebWallet(cip30);
  const wsAlice2 = await ww.signTransaction(Core.Transaction.fromCbor(Core.TxCBOR(unsignedHex)), true);
  p("WebWallet.signTransaction returned same witness set:", wsAlice2.toCbor() === wsAlice);
  // (c) plain local key
  const wsBob = witnessSetFor(unsigned, bob.rawKey);

  const assembled = Core.Transaction.fromCbor(Core.TxCBOR(unsignedHex));
  addWitnesses(assembled, wsAlice);
  addWitnesses(assembled, wsBob);
  p("assembled id unchanged:", assembled.getId() === unsigned.getId(), "vkeys:", assembled.witnessSet().vkeys().toCore().length);
  const id = await submitRetry(provider, assembled);
  const k = await kupoWait(id);
  p("confirmed in Kupo", k.map((x) => `${x.transaction_id}#${x.output_index} ${x.address} ${x.value.coins}`));
  status = "PASS";
} catch (e) { p("ERROR", errText(e), e?.stack ?? ""); }
p("STATUS", status);
log("item4-external-signers.txt", "$ node item4-external-signers.mjs\n" + out.join("\n") + "\n");
process.exit(0);
