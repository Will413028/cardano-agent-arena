# Spike result: `@lucid-evolution/lucid@0.6.5`

Date: 2026-10-18. Throwaway spike for plan step 4.5. Devnet: Yaci DevKit 0.12.0 container `arena-spike-yaci-a` (magic 42, Conway, protocol version 11.0), Ogmios v7.0.0, Kupo v2.12.0. Node v26.10.0. Validator: `../validator/plutus.json` (`spike.spike`, policy `83b820c5…50de`).

All results below were measured by running the named command unless a line says "inferred". Raw outputs are in `logs/`.

**Funding.** Yaci's topup REST returned `500 {"status":false,"message":"Topup failed"}` on this instance (measured in-session on two fresh addresses, output not kept as a log file; the coordinator measured the same). Fresh keys are funded in-process from Yaci's public default test account (mnemonic `test ×23 sauce`, account 0, `m/1852'/1815'/0'/0/0`, 10000 ADA at genesis). Code: `lib.mjs` `fundFromFaucet`. The Emulator uses genesis accounts built from the same fresh keys.

## Results

| Item | Status | Evidence |
|---|---|---|
| 1 Mint + alice move 7, devnet | PASS (with workarounds W1, W2) | `logs/item1-4-devnet.log` and repeat `logs/item1-4-devnet-run2.log` (all items PASS incl. 4c) (mint `48bcf0be…`, move `ce452f87…`, Kupo shows the token at the script address with inline datum equal to the expected next datum) |
| 1 Mint + alice move 7, Emulator | PASS | `logs/item1-4-emulator.log` |
| 1 mutation: correct blueprint rejects arbitrary name | PASS | `logs/mint-mutation-devnet.log`: local eval `Mint[0] the validator crashed`; forced submit returns node `3136` |
| 1 mutation: mutant blueprint accepts arbitrary name | PASS (rebuilt mutant `d0ff06ca…`) | `logs/mint-mutation-devnet.log`: mutant ACCEPTED tx `af8707c1…` (arbitrary name, datum.name = that name); correct blueprint build-rejected + node 3136. First (defective) mutant run: `logs/mint-mutation-devnet-old-mutant.log` |
| 2 Bob's first move rejected at build time | PASS (devnet + Emulator) | `"failed script execution Spend[0] the validator crashed / exited prematurely"` in both logs |
| 3 Forced phase-2-invalid tx, node rejects | PASS (devnet) | `logs/item1-4-devnet.log`: Ogmios `submitTransaction` returns **3136** (ValidationTagMismatch, `declaredSpending: inputs`, `mismatchReason: "The transaction failed unexpectedly."`). `evaluateTransaction` on the same CBOR gives `3010`/`3012` script failure (`The machine terminated because of an error`). Not `3101`/missingSignatories |
| 3 mutation: same shape signed by alice accepted | PASS (devnet + Emulator) | `3m-alice-forced-accepted` lines |
| 3 in the Emulator | FAIL (Emulator fidelity) | `logs/item1-4-emulator.log`: the Emulator **accepted** bob's illegal tx and the token moved |
| 4 Unsigned tx + CIP-30 `signTx` mock + plain private key | PASS | 4a: bob's move built with `selectWallet.fromAddress`, 0 vkey witnesses, mock `signTx(cbor,true)` returns a witness set, `lucid.fromTx(cbor).assemble([ws]).complete().submit()` → datum moves `7,3`. 4b: `fromTx(cbor).sign.withPrivateKey(sk)`. 4c (`selectWallet.fromAPI(mock)` + `sign.withWallet()`): PASS in the Emulator and in devnet run 2 (`logs/item1-4-devnet-run2.log`); in run 1 it hit N3 |
| 5 esbuild browser bundle | FAIL with the plain CLI; builds with workaround | `logs/item5-esbuild.log` (10 errors); `logs/item5-esbuild-fixed.log` (6.51 MiB total) |
| 6 CIP-57 typed schemas | FAIL (no codegen in the SDK) | `logs/item6-blueprint-search.log`; a ~25-line runtime mapper `item6-blueprint.mjs` produces byte-identical CBOR |
| 7a Token name matches Aiken vector | PASS | `logs/item7-vector.log` |
| 7b Encoding without tx-building code | PARTIAL | `logs/item7-imports.log`: `@lucid-evolution/plutus` alone still loads the full CML WASM |
| 8 Kupmios against Ogmios v7 without patching | FAIL at init; all other calls PASS | `logs/item8-provider.log`, `logs/item8-provider-default-timeout.log`, `logs/item8-evaluate-probe.log` |
| 9 Dependency count | 149 packages (150 parseable lines incl. root), `node_modules` 139 MB | `logs/item9-deps.log` |

## Details

**Item 3 mechanism.** `complete({ evaluator })` accepts an `EvaluatorAdapter` (`{ evaluate({tx}) → EvalRedeemer[] }`). A fixed adapter that returns `{mem: 2_000_000, steps: 800_000_000}` for every redeemer skips UPLC execution entirely (`flow.mjs` `fixedEvaluator`). The tx keeps `isValid = true`. The node rejects it with 3136, which is the ledger's phase-2 failure on a tx declared valid. Ogmios gives no script trace in the submit error; `evaluateTransaction` gives the 3012 detail.

**Emulator does not run phase-2 on submit.** `Emulator.submitTx` (provider `dist/index.js` around line 1741) checks validity interval, vkey signatures, native scripts and that Plutus script witnesses are present, but does not evaluate UPLC (read from code, and measured: bob's illegal tx was accepted). Use the Emulator for build-time logic only. Negative script tests need the local evaluator or a real node.

**First mutant was defective (now fixed by the coordinator).** I disassembled both blueprints with the transitively installed `@harmoniclabs/uplc` and diffed them. The only change in the mutant is `minted == name` → `minted != #""`. The validator still runs `expect [out] = list.filter(outputs, quantity_of(o.value, policy, name) == 1)` with the *computed* `name`. An output that holds an arbitrarily named token never matches, so the mutant cannot accept an arbitrary name for any tx shape. A correct mutant also has to drop or rewrite the output filter (for example, filter by `minted`). The coordinator then rebuilt the mutant (`d0ff06ca…`, output and datum checks use the minted name). Against it, an arbitrary name is ACCEPTED on devnet, and the correct blueprint still REJECTS it.

**Item 5.** Plain `esbuild --bundle --platform=browser --format=esm` fails because of:
- three `.wasm` ESM-integration imports (`cardano-multiplatform-lib-browser`, `@lucid-evolution/uplc` browser, `cardano-message-signing-browser`): "No loader is configured for .wasm";
- the Node builtins `buffer` and `events`, required by `safe-buffer`, `ripemd160`, `readable-stream` and `core-util-is`.

`build-browser.mjs` fixes this with `esbuild-plugin-wasm@1.1.0` (deferred mode) plus the `buffer@6.0.3` and `events@3.3.0` polyfills and an injected `Buffer`. Minified output:

| File | Size | gzip |
|---|---|---|
| JS | 2.32 MiB | 584 KB |
| CML wasm | 3.04 MiB | 969 KB |
| UPLC wasm | 0.88 MiB | 322 KB |
| message-signing wasm | 0.26 MiB | 95 KB |

No `-nodejs` variants end up in the bundle; the `browser` field remaps CML. The largest inputs are `@effect/platform` (4.7 MiB source), CML, `effect`, `@cardano-sdk/core` and `libsodium-sumo`. **Whether the bundle runs in a browser was not verified.**

**Item 6.** 0.6.5 has no blueprint/CIP-57 code generator, no `bin`, and no matching strings in any `@lucid-evolution/*` dist. `@lucid-evolution/blueprint` and `@lucid-evolution/codegen` return 404 on npm. Schemas are hand-written as `Data.Object` and `Data.Array` (`lib.mjs`). Runtime mapping from the blueprint is trivial (`item6-blueprint.mjs`). Static TS types still need our own generator.

**Item 7.**
- Vector: the default `Data.to` emits indefinite-length constructor fields (`d8799f…ff`) and matches Aiken exactly. `Data.to(..., { canonical: true })` emits a definite list (`d87982…`) and produces a *different* name (`d158c113…`). Never pass `canonical: true` when deriving the thread name.
- Hashing: blake2b via `CML.hash_plutus_data(PlutusData.from_cbor_hex(...))` preserves the original encoding and matches. `@noble/hashes` matches too.
- Minimal import (`import { Data } from "@lucid-evolution/plutus"` + `@noble/hashes`) resolves 202 modules from 5 packages, versus 1713 modules / 85 packages for `@lucid-evolution/lucid`. However, `plutus` imports `@anastasia-labs/cardano-multiplatform-lib-nodejs`, which is the full CML tx-building WASM. In the browser the minimal bundle is 0.68 MiB JS + 3.04 MiB wasm. So it avoids Lucid's builder, effect and providers, but not the CML WASM.

**Item 8.**
- `Lucid(new Kupmios(kupo, ogmios), "Custom", {slotConfig})` and `Kupmios.getProtocolParameters()` throw `ParseError: ProtocolParametersSchema └─ ["plutusCostModels"] └─ ["plutus:v2"] is missing`. This devnet's ledger has only `plutus:v1` (166) and `plutus:v3` (251) cost models, which matches Yaci's warning "Plutus cost models governance proposal failed". Kupmios' schema requires all three. So the Yaci warning **does matter** for this SDK. Inferred: this is a devnet-state problem, not Ogmios v7 itself. A network with a v2 cost model would parse. Not verified here.
- Workaround W1: `presetProtocolParameters` built from raw Ogmios with the same mapping as Kupmios' `toProtocolParameters`, with `PlutusV2: []` (`lib.mjs` `devnetProtocolParameters`). Kupmios still serves every other call.
- With W1, all of these worked: `getUtxos` (address and credential), `getUtxosByOutRef`, `getUtxosWithUnit`, `getUtxoByUnit`, `getUtxosWithPolicy`, `getTransactionStatus`, `getTreasury`, `submitTx`, `awaitTx`, inline datum via Kupo, and `evaluateTx` (success and the 3010/3012 failure).
- `evaluateTx` took 40 s under host load average ~82 (measured with `uptime`) and hit Kupmios' default `requestTimeoutMs` of 30 s (`KupmiosError … TimeoutException`). It passed with `requestTimeoutMs: 180000`. The same raw Ogmios request also took ~34 s, so the slowness is in the host/node, not Kupmios.
- The default local evaluator does not depend on the provider.
- The validator uses PlutusV3 only. The v3 cost model has 251 entries, and builtins beyond that list may be unavailable. Script integrity hashes matched, since the node accepted the txs.

## Surprises and workarounds

- W1: `presetProtocolParameters` is needed on this devnet because there is no v2 cost model (item 8).
- W2: genesis UTxOs are not in any block, so Kupo never indexes them. For the faucet account, `lucid.wallet().getUtxos()` returns `[]`. Funding passes `complete({ presetWalletInputs })` with the UTxOs from Ogmios `queryLedgerState/utxo`. Also, `sign.withWallet()` on a seed wallet only signs for key hashes found in its provider-visible UTxOs, so it produced `3101 missingSignatories`. The fix is to sign with `walletFromSeed(...).paymentKey` via `sign.withPrivateKey`.
- W3: the network must be `"Custom"` with an explicit `slotConfig` (zeroTime = Shelley `startTime` 2026-10-18T02:21:06Z, slotLength 1000).
- `applyDoubleCborEncoding(compiledCode)` is required. `mintingPolicyToId` then equals the blueprint hash, which `lib.mjs` checks.
- `selectWallet.fromAPI` requires `submitTx` on the CIP-30 object (`api.submitTx is not a function` otherwise).
- N3: the node intermittently returned `3997 MempoolTxTooSlow (1.3–1.9 s)` under host load, once on the funding tx (`logs/item1-4-devnet-attempt-mempooltooslow.log`) and once on 4c. This is a node/host-load issue, not the SDK. Retrying works.
- `@lucid-evolution/lucid@0.6.5` declares `effect: ^3.12.7` and `@effect/schema: ^0.66.16` as ranges, while its own subpackages are exact pins. Today `effect` resolves to 3.22.3, and two `@effect/schema` versions (0.66.16 and 0.68.27, both deprecated) are installed. A lockfile is mandatory.
- `npm install` warns that `cbor-extract` has an install script (native optional), which was not approved. Everything still worked without it.
- Newer versions exist: 0.6.6 through 0.8.3, released 2026-10-05 to 10-17. Not evaluated, per the brief.

## Versions

From `logs/versions.log`:

- Direct: `@lucid-evolution/lucid@0.6.5`, `esbuild@0.25.10`, `esbuild-plugin-wasm@1.1.0`, `buffer@6.0.3`, `events@3.3.0`
- Lucid subpackages: `core-types@0.3.0`, `core-utils@0.1.17`, `plutus@0.1.36`, `provider@0.2.4`, `utils@0.1.74`, `wallet@0.2.2`, `uplc@0.2.23`, `tx-graph@0.0.6`, `sign_data@0.1.32`, `crc8@0.1.8`
- Other libraries: `@anastasia-labs/cardano-multiplatform-lib-{nodejs,browser}@6.2.0-1`, `@emurgo/cardano-message-signing-*@1.1.0`, `effect@3.22.3`, `@effect/platform@0.71.7`, `@effect/schema@0.66.16`

## Commands

Run all of these from this directory, with `npm ci` first:

- `node flow.mjs emulator` / `node flow.mjs devnet`: items 1–4
- `node mint-mutation.mjs`: mint mutation
- `node vector.mjs`: 7a
- `node --import ./trace-hook.mjs item7-minimal.mjs` and `node build-minimal.mjs`: 7b
- `npx esbuild browser-entry.mjs --bundle --platform=browser --format=esm --outfile=out/browser.js` and `node build-browser.mjs`: item 5
- `node item6-blueprint.mjs`: item 6
- `KUPMIOS_TIMEOUT_MS=180000 node item8-provider.mjs` and `node item8-evaluate-probe.mjs`: item 8
- Item 9: in a clean dir with `{"dependencies":{"@lucid-evolution/lucid":"0.6.5"}}`, run `npm install --ignore-scripts && npm ls --all --omit=dev --parseable | wc -l`

Note: `flow.mjs` exits 1 in Emulator mode by design, because the Emulator item-3 check records FAIL.
