// Item 4: build an UNSIGNED tx needing two signatures; carol signs via a CIP-30 mock (signTx(txCborHex, partialSign) -> witnessSetCborHex),
// dave signs with a plain local private key; assemble both witness sets; submit.
import { devnetChain, newKey, fund, waitTx, kupoMatches, KUPO, OGMIOS, j, Evo } from "./lib.mjs";
import { protocolParameters, provider } from "./lib.mjs";
const chain = await devnetChain();
const carol = newKey("carol"), dave = newKey("dave"), erin = newKey("erin");
const f = await fund([{ address: carol.address, lovelace: 50_000_000n }, { address: dave.address, lovelace: 30_000_000n }], chain); await waitTx(f.txHash);

// CIP-30 mock backed by carol's key. Only uses SDK primitives; never sees the SDK wallet internals.
const cip30Log = [];
const mockApi = {
  getUsedAddresses: async () => [Evo.Address.toHex(carol.address)],
  getUnusedAddresses: async () => [],
  getRewardAddresses: async () => [],
  // CIP-30 getUtxos: CBOR TransactionUnspentOutput = [input, output]; the mock wallet tracks its own UTxOs via Kupo
  getUtxos: async () => (await provider().getUtxos(carol.address)).map((u) => Buffer.concat([Buffer.from([0x82]),
    Evo.TransactionInput.toCBORBytes(new Evo.TransactionInput.TransactionInput({ transactionId: u.transactionId, index: u.index })),
    Evo.TxOut.toCBORBytes(new Evo.TxOut.TransactionOutput({ address: u.address, assets: u.assets }))]).toString("hex")),
  signData: async () => { throw new Error("not implemented"); },
  submitTx: async () => { throw new Error("mock wallet does not submit"); },
  signTx: async (txCborHex, partialSign) => {
    cip30Log.push({ method: "signTx", partialSign, txCborHexPrefix: txCborHex.slice(0, 40) + "...", len: txCborHex.length / 2 });
    const bodyHash = Evo.TransactionBody.toHashFromBytes(Evo.Transaction.extractBodyBytes(Evo.Bytes.fromHex(txCborHex)));
    const w = new Evo.TransactionWitnessSet.VKeyWitness({ vkey: Evo.VKey.fromPrivateKey(carol.sk), signature: Evo.PrivateKey.sign(carol.sk, bodyHash.hash) });
    return Evo.TransactionWitnessSet.toCBORHex(Evo.TransactionWitnessSet.fromVKeyWitnesses([w]));
  },
};
const carolClient = Evo.Client.make(chain).withKupmios({ kupoUrl: KUPO, ogmiosUrl: OGMIOS }).withCip30(mockApi);
const daveSigner = Evo.Client.make(chain).withPrivateKey({ paymentKey: dave.bech }); // offline signer, no provider
console.log("carol (cip30) address from wallet:", Evo.Address.toBech32(await carolClient.address()), "expected", carol.bech32);
const [daveUtxo] = await carolClient.getUtxos(dave.address);

const sb = await carolClient.newTx()
  .collectFrom({ inputs: [daveUtxo] })                       // dave's input -> needs dave's signature
  .payToAddress({ address: erin.address, assets: Evo.Assets.fromLovelace(40_000_000n) })
  .build({ fullProtocolParameters: await protocolParameters() });
const unsigned = await sb.toTransaction();
const unsignedHex = Evo.Transaction.toCBORHex(unsigned);
console.log("unsigned tx: inputs", unsigned.body.inputs.length, "vkey witnesses", unsigned.witnessSet.vkeyWitnesses?.length ?? 0, "cbor bytes", unsignedHex.length / 2);

const wCarol = await sb.partialSign();                                     // -> CIP-30 mock signTx(hex, true)
const wDave = await daveSigner.signTx(unsignedHex, { utxos: [daveUtxo] }); // -> plain local key
console.log("carol witness (via CIP-30):", wCarol.vkeyWitnesses?.length, "dave witness (local key):", wDave.vkeyWitnesses?.length);
console.log("cip30 calls:", j(cip30Log));
const submitB = await sb.assemble([wCarol, wDave]);
const h = Evo.TransactionHash.toHex(await submitB.submit());
console.log("submitted", h); await waitTx(h);
const km = await kupoMatches(erin.bech32);
console.log("erin utxos via kupo:", km.map((x) => `${x.transaction_id}#${x.output_index} ${x.value.coins}`));
console.log(km.some((x) => x.transaction_id === h && x.value.coins === 40_000_000) ? "PASS" : "FAIL");
