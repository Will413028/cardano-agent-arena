// Item 5 entry: the browser-side surface a dApp would use (sdk + Kupmios + WebWallet + script/data helpers).
import { Blaze, Core, Kupmios, WebWallet, cborToScript, makeValue } from "@blaze-cardano/sdk";
import { Unwrapped } from "@blaze-cardano/ogmios";
export async function connect(cip30, kupoUrl, ogmiosUrl) {
  const provider = new Kupmios(kupoUrl, await Unwrapped.Ogmios.new(ogmiosUrl));
  const blaze = await Blaze.from(provider, new WebWallet(cip30));
  return { blaze, Core, cborToScript, makeValue };
}
