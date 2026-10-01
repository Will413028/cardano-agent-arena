import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { runInNewContext } from 'node:vm';
import { startDevnet, stopDevnet, ROOT } from '../scripts/devnet.ts';
import { createMatch, move } from '../offchain/tx-builder.ts';
import { indexMatch } from '../indexer/cli.ts';
import { createWebServer } from '../web/server.ts';

const net = await startDevnet();
try {
  const cases = [
    { name: 'alice-wins', numbers: [9, 2], expected: 0 },
    { name: 'bob-wins', numbers: [2, 9], expected: 1 },
    { name: 'draw', numbers: [4, 4], expected: 2 },
  ];
  const results = [];
  for (const scenario of cases) {
    const match = await createMatch(net);
    const wrongSigner = await move(net, match, scenario.numbers[0], { signer: 1, expectReject: true });
    assert.equal(wrongSigner.rejected, true);
    const invalidNumber = await move(net, match, 101, { expectReject: true });
    assert.equal(invalidNumber.rejected, true);
    await move(net, match, scenario.numbers[0]);
    const wrongResult = await move(net, match, scenario.numbers[1], { claimedResult: (scenario.expected + 1) % 3, expectReject: true });
    assert.equal(wrongResult.rejected, true);
    await move(net, match, scenario.numbers[1]);
    const index = await indexMatch(net.endpoint, match.matchId);
    assert.equal(index.result, scenario.expected);
    const cli = process.execPath;
    const args = ['--experimental-strip-types', join(ROOT, 'verifier/cli.ts'), 'replay', match.matchId, net.endpoint];
    // A separate process reads chain-sync directly, with no index or submitted datum input.
    const replay = JSON.parse(execFileSync(cli, args, { encoding: 'utf8', timeout: 120_000 }));
    assert.deepEqual(replay, index);
    const indexFile = join(net.directory, `${scenario.name}.index.json`);
    writeFileSync(indexFile, JSON.stringify(index));
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
    results.push({ scenario: scenario.name, ...index });
    if (scenario.expected !== 2) {
      // Source mutation: reverse only the independent verifier result; comparison must fail.
      const path = join(ROOT, 'verifier/cli.ts');
      const original = readFileSync(path, 'utf8');
      const marker = 'const result = outcome(final.state.moves);';
      assert.ok(original.includes(marker));
      try {
        writeFileSync(path, original.replace(marker, 'const actual = outcome(final.state.moves); const result = actual === 2 ? 2 : actual === 0 ? 1 : actual === 1 ? 0 : -1;'));
        assert.throws(() => execFileSync(cli, args, { encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }), /Invalid terminal result/);
      } finally { writeFileSync(path, original); }
    }
    console.log(`PASS ${scenario.name}: chain result, independent replay, web; illegal signer/number/result rejected`);
  }
  writeFileSync(join(net.directory, 'acceptance.json'), JSON.stringify({ passed: true, mutations: 'reversed verifier winner rejected', results }, null, 2));
  console.log(`E2E evidence: ${net.directory}/acceptance.json`);
} finally { await stopDevnet(net); }
