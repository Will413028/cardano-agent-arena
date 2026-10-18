// Item 5: the off-chain builder as a browser app would import it.
import { Lucid, Kupmios, Data, Constr, toUnit, applyDoubleCborEncoding, mintingPolicyToId } from "@lucid-evolution/lucid";
export async function buildMove(kupo, ogmios, walletApi, compiledCode, utxo, scriptAddr, number, nextDatum) {
  const lucid = await Lucid(new Kupmios(kupo, ogmios), "Custom", { slotConfig: { zeroTime: 0, zeroSlot: 0, slotLength: 1000 } });
  lucid.selectWallet.fromAPI(walletApi);
  const script = { type: "PlutusV3", script: applyDoubleCborEncoding(compiledCode) };
  const tx = await lucid.newTx().collectFrom([utxo], Data.to(BigInt(number))).attach.SpendingValidator(script)
    .pay.ToContract(scriptAddr, { kind: "inline", value: nextDatum }, utxo.assets).complete();
  return (await tx.sign.withWallet().complete()).submit();
}
export { Constr, toUnit, mintingPolicyToId };
