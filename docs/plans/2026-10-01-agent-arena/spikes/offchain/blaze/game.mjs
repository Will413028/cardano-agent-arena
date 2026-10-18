// Game transactions with Blaze, shared by the devnet and the Emulator runs.
import {
  Blaze, Core, makeValue, loadScript, seedData, tokenNameFor, datumData, intData, newWallet, fixedEvaluator,
} from "./lib.mjs";

const { AssetName, PolicyId, AssetId, Ed25519KeyHashHex } = Core;

export async function players(provider) {
  const alice = newWallet(provider);
  const bob = newWallet(provider);
  return { alice, bob };
}

// Mint the thread token to the script address. nameOverride = arbitrary token name (mutation test).
export async function buildMint(provider, who, { which = "correct", playerPkhs, nameOverride, evaluator } = {}) {
  const S = loadScript(which);
  const blaze = await Blaze.from(provider, who.wallet);
  const utxos = await who.wallet.getUnspentOutputs();
  if (!utxos.length) throw new Error("minter has no utxos");
  const seed = utxos[0];
  const txHash = seed.input().transactionId();
  const index = seed.input().index();
  const name = nameOverride ?? tokenNameFor(txHash, index);
  const unit = AssetId(S.policyId + name);
  const datum = datumData({ players: playerPkhs, moves: [], name, result: -1 });
  let b = blaze.newTransaction()
    .addInput(seed)
    .addMint(PolicyId(S.policyId), new Map([[AssetName(name), 1n]]), seedData(txHash, index))
    .provideScript(S.script)
    .lockAssets(S.address, makeValue(2_000_000n, [unit, 1n]), datum);
  if (evaluator) b = b.useEvaluator(evaluator);
  const tx = await b.complete();
  return { tx, blaze, unit, name, S, seed: { txHash, index: Number(index) }, datum };
}

// One move: spend the thread UTxO with redeemer `number`, required signer = mover, next datum appended.
export async function buildMove(provider, mover, threadUtxo, game, number, { evaluator, which = "correct" } = {}) {
  const S = loadScript(which);
  const blaze = await Blaze.from(provider, mover.wallet);
  const next = datumData({ players: game.players, moves: [...game.moves, number], name: game.name, result: -1 });
  let b = blaze.newTransaction()
    .addInput(threadUtxo, intData(number))
    .provideScript(S.script)
    .addRequiredSigner(Ed25519KeyHashHex(mover.pkh))
    .lockAssets(S.address, makeValue(threadUtxo.output().amount().coin(), [game.unit, 1n]), next);
  if (evaluator) b = b.useEvaluator(evaluator);
  const tx = await b.complete();
  return { tx, blaze };
}

export function summarizeTx(tx) {
  const ws = tx.witnessSet();
  return {
    id: tx.getId(), fee: String(tx.body().fee()), sizeBytes: tx.toCbor().length / 2,
    collateral: (tx.body().collateral()?.values() ?? []).length,
    requiredSigners: (tx.body().requiredSigners()?.values() ?? []).map((x) => x.value()),
    redeemers: (ws.redeemers()?.values() ?? []).map((r) => ({ tag: r.tag(), index: String(r.index()), exUnits: r.exUnits().toCore() })),
  };
}

export { fixedEvaluator };
