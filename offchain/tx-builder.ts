import { readFileSync } from 'node:fs';
import { Blaze, Core, makeValue, applyParams, cborToScript, type Provider, type Wallet } from '@blaze-cardano/sdk';
import { serialize } from '@blaze-cardano/data';
import { cardano_transaction_OutputReference } from './generated/contract.ts';
import { encodeState, encodeMove, outcome, type State } from './codec.ts';
const { AssetId, AssetName, PolicyId, TransactionId, TransactionInput, NetworkId, Ed25519KeyHashHex, ExUnits, Redeemers } = Core;
export const TOKEN_NAME = '6172656e61';
const STATE_LOVELACE = 3_000_000n;
const blueprint = JSON.parse(readFileSync(new URL('../validators/plutus.json', import.meta.url), 'utf8'));
function compiled(title: string): string {
  const script = blueprint.validators.find((v: { title: string }) => v.title === title);
  if (!script) throw new Error(`Blueprint validator missing: ${title}`);
  return script.compiledCode;
}
const matchScript = cborToScript(compiled('match.match.spend'), 'PlutusV3');
export const matchAddress = Core.addressFromValidator(NetworkId.Testnet, matchScript);
export interface OutRef { txId: string; index: number }
export interface Match { matchId: string; stateRef: OutRef; unit: string; state: State }
export async function keyHashOf(wallet: Wallet): Promise<string> {
  const hash = (await wallet.getChangeAddress()).getProps().paymentPart?.hash;
  if (!hash) throw new Error('Wallet change address has no payment key hash');
  return hash;
}
function outputIndex(tx: Core.Transaction, unit: string): number {
  const index = tx.body().outputs().findIndex(output =>
    output.address().toBech32() === matchAddress.toBech32() && (output.amount().multiasset()?.get(AssetId(unit)) ?? 0n) === 1n);
  if (index < 0) throw new Error('Transaction has no match state output');
  return index;
}

// Builders return unsigned transactions; the caller's wallet (local key or CIP-30) signs.
export async function buildCreate(provider: Provider, creator: Wallet, players: string[]) {
  const blaze = await Blaze.from(provider, creator);
  const [seed] = await creator.getUnspentOutputs();
  if (!seed) throw new Error('Match creator has no UTxO');
  const reference = { transaction_id: seed.input().transactionId(), output_index: seed.input().index() };
  const seedParam = serialize(cardano_transaction_OutputReference, reference);
  const threadScript = cborToScript(applyParams(Core.HexBlob(compiled('thread.thread.mint')), seedParam), 'PlutusV3');
  const policy = threadScript.hash();
  const unit = policy + TOKEN_NAME;
  const state: State = { players, moves: [], policy, result: -1 };
  const tx = await blaze.newTransaction()
    .addInput(seed)
    .addMint(PolicyId(policy), new Map([[AssetName(TOKEN_NAME), 1n]]), Core.PlutusData.newConstrPlutusData(new Core.ConstrPlutusData(0n, new Core.PlutusList())))
    .provideScript(threadScript)
    .lockAssets(matchAddress, makeValue(STATE_LOVELACE, [unit, 1n]), encodeState(state))
    .complete();
  return { tx, unit, state };
}
export function created(tx: Core.Transaction, unit: string, state: State): Match {
  return { matchId: tx.getId(), stateRef: { txId: tx.getId(), index: outputIndex(tx, unit) }, unit, state };
}

export interface MoveOptions { claimedResult?: number; evaluator?: Core.Evaluator }
// The mover is listed as required signer; whether it is the player on turn is the validator's decision.
export async function buildMove(provider: Provider, mover: Wallet, match: Match, number: number, options: MoveOptions = {}) {
  const blaze = await Blaze.from(provider, mover);
  const [stateUtxo] = await provider.resolveUnspentOutputs([new TransactionInput(TransactionId(match.stateRef.txId), BigInt(match.stateRef.index))]);
  if (!stateUtxo) throw new Error('Match state UTxO not found');
  const moves = [...match.state.moves, number];
  const next: State = { ...match.state, moves, result: options.claimedResult ?? outcome(moves) };
  let builder = blaze.newTransaction()
    .addInput(stateUtxo, encodeMove(number))
    .provideScript(matchScript)
    .addRequiredSigner(Ed25519KeyHashHex(await keyHashOf(mover)))
    .lockAssets(matchAddress, makeValue(STATE_LOVELACE, [match.unit, 1n]), encodeState(next));
  if (options.evaluator) builder = builder.useEvaluator(options.evaluator);
  return { tx: await builder.complete(), next };
}
export function moved(match: Match, tx: Core.Transaction, next: State): Match {
  return { ...match, stateRef: { txId: tx.getId(), index: outputIndex(tx, match.unit) }, state: next };
}

// Fixed budgets bypass local and Ogmios evaluation, so the node's phase-2 check is the only judge.
export const skipEvaluation: Core.Evaluator = async tx => Redeemers.fromCore((tx.witnessSet().redeemers()?.values() ?? []).map(redeemer => {
  redeemer.setExUnits(ExUnits.fromCore({ memory: 3_000_000, steps: 2_000_000_000 }));
  return redeemer.toCore();
}));

export async function awaitConfirmation(kupo: string, txId: string, timeoutMs = 30_000): Promise<void> {
  // Kupmios.awaitTransactionConfirmation in @blaze-cardano/query 0.6.1 never reports a match reliably; poll Kupo directly.
  const deadline = AbortSignal.timeout(timeoutMs);
  while (!deadline.aborted) {
    const matches = await (await fetch(`${kupo}/matches/*@${txId}`, { signal: AbortSignal.any([deadline, AbortSignal.timeout(5000)]) })).json();
    if (Array.isArray(matches) && matches.length) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Transaction ${txId} not seen by Kupo within ${timeoutMs}ms`);
}
export async function signSubmit(provider: Provider & { kupoUrl: string }, wallet: Wallet, tx: Core.Transaction): Promise<string> {
  const blaze = await Blaze.from(provider, wallet);
  const txId = await provider.postTransactionToChain(await blaze.signTransaction(tx));
  await awaitConfirmation(provider.kupoUrl, txId);
  return txId;
}
