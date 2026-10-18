import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { runInNewContext } from 'node:vm';
import { Kupmios, type Wallet } from '@blaze-cardano/sdk';
import { Unwrapped } from '@blaze-cardano/ogmios';
import { startDevnet, stopDevnet, ephemeralWallet, fund } from '../scripts/devnet.ts';
import { buildCreate, buildMove, created, moved, signSubmit, awaitConfirmation, keyHashOf, skipEvaluation, matchAddress, type Match, type MoveOptions } from '../offchain/tx-builder.ts';
import { indexMatch } from '../indexer/cli.ts';
import { createWebServer } from '../web/server.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const timings: Array<{ step: string; ms: number }> = [];
// SDK calls over the Ogmios WebSocket carry no timeout of their own; a stalled step fails here with its name.
async function timed<T>(step: string, action: () => Promise<T>, timeoutMs = 180_000): Promise<T> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`E2E step ${step} exceeded ${timeoutMs}ms`)), timeoutMs); });
  try { return await Promise.race([action(), stalled]); } finally {
    clearTimeout(timer);
    timings.push({ step, ms: Date.now() - started });
    if (process.env.ARENA_TRACE === '1') console.error(`${step}: ${Date.now() - started}ms`);
  }
}
const net = await timed('startDevnet', startDevnet);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void stopDevnet(net).finally(() => process.exit(130)); });
const evidence = join(ROOT, '.local/devnet', net.container);
mkdirSync(evidence, { recursive: true });
const ogmios = await Unwrapped.Ogmios.new(net.ogmios);
const provider = new Kupmios(net.kupo, ogmios);

// Each illegal move is checked twice: the builder's Ogmios evaluation refuses it, and the node refuses the same
// shape submitted with fixed budgets (phase-2), so a missing witness or a builder-only check cannot pass for the validator.
async function expectRejected(wallet: Wallet, match: Match, number: number, options: MoveOptions = {}) {
  let built: string | undefined;
  try { await buildMove(provider, wallet, match, number, options); } catch (error) { built = String((error as Error).message ?? error); }
  assert.ok(built !== undefined, 'Illegal move unexpectedly built');
  assert.match(built, /3010|script/i, `Build rejected for a non-script reason: ${built}`);
  const { tx } = await buildMove(provider, wallet, match, number, { ...options, evaluator: skipEvaluation });
  let submitted: string | undefined;
  try { await signSubmit(provider, wallet, tx); } catch (error) { submitted = `${(error as Error).message} ${JSON.stringify(error)}`; }
  assert.ok(submitted !== undefined, 'Illegal move unexpectedly accepted by the node');
  assert.match(submitted, /3136|ValidationTagMismatch|PlutusFailure|ScriptFailure/i, `Node rejection is not phase-2: ${submitted}`);
  assert.doesNotMatch(submitted, /MissingVKeyWitnesses/i);
  return { built: built.slice(0, 300), submitted: submitted.slice(0, 300) };
}

try {
  const cases = [
    { name: 'alice-wins', numbers: [9, 2], expected: 0 },
    { name: 'bob-wins', numbers: [2, 9], expected: 1 },
    { name: 'draw', numbers: [4, 4], expected: 2 },
  ];
  const results = [];
  for (const scenario of cases) {
    const [alice, bob] = [ephemeralWallet(provider), ephemeralWallet(provider)];
    const funding = await timed('fund', () => fund(provider, [alice, alice, bob, bob].map((wallet, i) => ({ address: wallet.address, lovelace: i % 2 ? 10_000_000n : 100_000_000n }))));
    await awaitConfirmation(net.kupo, funding);
    const players = [await keyHashOf(alice), await keyHashOf(bob)];
    const creation = await timed('create', () => buildCreate(provider, alice, players));
    await timed('submit', () => signSubmit(provider, alice, creation.tx));
    let match = created(creation.tx, creation.unit, creation.state);
    const rejections = {
      wrongSigner: await timed('illegal', () => expectRejected(bob, match, scenario.numbers[0])),
      invalidNumber: await timed('illegal', () => expectRejected(alice, match, 101)),
      wrongResult: undefined as Awaited<ReturnType<typeof expectRejected>> | undefined,
    };
    const first = await timed('move', () => buildMove(provider, alice, match, scenario.numbers[0]));
    await timed('submit', () => signSubmit(provider, alice, first.tx));
    match = moved(match, first.tx, first.next);
    rejections.wrongResult = await timed('illegal', () => expectRejected(bob, match, scenario.numbers[1], { claimedResult: (scenario.expected + 1) % 3 }));
    const second = await timed('move', () => buildMove(provider, bob, match, scenario.numbers[1]));
    await timed('submit', () => signSubmit(provider, bob, second.tx));
    match = moved(match, second.tx, second.next);
    // Step 7 needs full history: Kupo must still return the spent state outputs.
    const spent = await (await fetch(`${net.kupo}/matches/${matchAddress.toBech32()}?spent`)).json() as Array<{ transaction_id: string }>;
    assert.ok(spent.some(row => row.transaction_id === match.matchId), 'Kupo pruned the spent creation output');
    const index = await timed('index', () => indexMatch(net.ogmios, match.matchId));
    assert.equal(index.result, scenario.expected);
    const indexFile = join(evidence, `${scenario.name}.index.json`);
    writeFileSync(indexFile, JSON.stringify(index));
    const cli = process.execPath;
    const args = ['--experimental-strip-types', join(ROOT, 'verifier/cli.ts'), 'replay', match.matchId, net.ogmios];
    // A separate process reads chain-sync directly, with no index or submitted datum input.
    const replay = await timed('replay', async () => JSON.parse(execFileSync(cli, args, { encoding: 'utf8', timeout: 120_000 })));
    assert.deepEqual(replay, index);
    const server = createWebServer(indexFile);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      assert.deepEqual(await (await fetch(`${url}/api/match`)).json(), index);
      assert.match(await (await fetch(url)).text(), /id="result"/);
      const app = await (await fetch(`${url}/app.js`)).text();
      const elements = { '#result': { textContent: '' }, '#match': { textContent: '' } };
      await runInNewContext(app, {
        fetch: (path: string) => fetch(`${url}${path}`),
        document: { querySelector: (selector: keyof typeof elements) => elements[selector] },
      });
      assert.equal(elements['#result'].textContent, ['Alice wins', 'Bob wins', 'Draw'][scenario.expected]);
      assert.deepEqual(JSON.parse(elements['#match'].textContent), index);
      assert.equal((await fetch(`${url}/missing`)).status, 404);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
    results.push({ scenario: scenario.name, ...index, rejections });
    if (scenario.expected !== 2) {
      // Source mutation: reverse only the independent verifier result; comparison must fail. The mutant is a
      // sibling copy so concurrent runs never see each other's mutation in verifier/cli.ts.
      const original = readFileSync(join(ROOT, 'verifier/cli.ts'), 'utf8');
      const marker = 'const result = outcome(final.state.moves);';
      assert.ok(original.includes(marker));
      const mutant = join(ROOT, `verifier/.mutant-${net.container}.ts`);
      try {
        writeFileSync(mutant, original.replace(marker, 'const actual = outcome(final.state.moves); const result = actual === 2 ? 2 : actual === 0 ? 1 : actual === 1 ? 0 : -1;')
          .replace("endsWith('/verifier/cli.ts')", 'endsWith(".ts")'));
        assert.throws(() => execFileSync(cli, [args[0], mutant, ...args.slice(2)], { encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }), /Invalid terminal result/);
      } finally { rmSync(mutant, { force: true }); }
    }
    console.log(`PASS ${scenario.name}: chain result, independent replay, web; illegal signer/number/result rejected at build and by phase-2`);
  }
  const summary = Object.entries(Object.groupBy(timings, t => t.step)).map(([step, rows]) =>
    ({ step, calls: rows!.length, totalMs: rows!.reduce((sum, row) => sum + row.ms, 0), maxMs: Math.max(...rows!.map(row => row.ms)) }));
  console.table(summary);
  writeFileSync(join(evidence, 'acceptance.json'), JSON.stringify({ passed: true, devnet: net, mutations: 'reversed verifier winner rejected', timings: summary, results }, null, 2));
  console.log(`E2E evidence: ${evidence}/acceptance.json`);
} finally {
  // @blaze-cardano/ogmios 0.0.7 kill() never resolves once a socket exists; it still closes the socket.
  void ogmios.kill();
  await stopDevnet(net);
}
