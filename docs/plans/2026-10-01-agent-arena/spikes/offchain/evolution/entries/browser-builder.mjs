// Browser entry: full builder path (Client + Kupmios provider + CIP-30 wallet + Data + script mint/spend shape)
import { Client, Data, Assets, PlutusV3, ScriptHash, Address, InlineDatum, KeyHash } from "@evolution-sdk/evolution";
export async function mintThread({ chain, kupoUrl, ogmiosUrl, cip30Api, compiledCode, seedUtxo, players, name, pp }) {
  const client = Client.make(chain).withKupmios({ kupoUrl, ogmiosUrl }).withCip30(cip30Api);
  const s = new PlutusV3.PlutusV3({ bytes: Uint8Array.from(compiledCode.match(/../g).map((h) => parseInt(h, 16))) });
  const policy = ScriptHash.toHex(ScriptHash.fromScript(s));
  const addr = new Address.Address({ networkId: chain.id, paymentCredential: ScriptHash.fromScript(s) });
  const d = Data.constr(0n, [players.map(Data.bytearray), [], Data.bytearray(name), -1n]);
  const sb = await client.newTx().collectFrom({ inputs: [seedUtxo] }).attachScript({ script: s })
    .mintAssets({ assets: Assets.addByHex(Assets.fromLovelace(0n), policy, name, 1n), redeemer: Data.constr(0n, [Data.bytearray("00"), 0n]) })
    .payToAddress({ address: addr, assets: Assets.addByHex(Assets.fromLovelace(3_000_000n), policy, name, 1n), datum: new InlineDatum.InlineDatum({ data: d }) })
    .addSigner({ keyHash: KeyHash.fromHex(players[0]) })
    .build({ fullProtocolParameters: pp });
  return (await sb.signAndSubmit());
}
