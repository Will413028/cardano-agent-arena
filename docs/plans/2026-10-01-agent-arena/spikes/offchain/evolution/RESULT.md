# Spike result: `@evolution-sdk/evolution` 0.5.16 for arena off-chain

Date: 2026-10-18. Throwaway spike. Every claim below comes from running the listed script against the local devnet, unless it is marked *inferred*.

## Environment

- Devnet: Yaci DevKit 0.12.0 (arm64) in container `arena-spike-yaci-b`, network magic 42, Conway, protocol version 11.0, 1 s slots, epoch length 600. Ogmios v7.0.0 (`127.0.0.1:57778`), Kupo v2.12.0 (`127.0.0.1:57780`).
- **Funding:** the Yaci topup REST returned `{"status":false,"message":"Topup failed"}` on every call (`logs/yaci-topup-failed.log`). Instead, every fresh key is funded in-process from Yaci's **public default test mnemonic** (`test test … sauce`), **account index 1** (`m/1852'/1815'/1'/0/0`, address `addr_test1qpqy3luf…qaqa8te`). This is a well-known public test mnemonic, not a secret (`lib.mjs` `fund()`).
- Node v26.10.0. Run every script from this directory with `node <script>` (`.ts` files need `node --experimental-strip-types`).

Packages (`npm ls --depth=0`, see `logs/npm-ls-depth0.log` and `logs/npm-ls-all.log`):

| package | version | role |
|---|---|---|
| @evolution-sdk/evolution | 0.5.16 (exact pin) | SDK under test |
| @evolution-sdk/aiken-uplc | 2.0.16 (exact pin; peer `evolution@0.5.16`) | local in-process evaluator (tried) |
| @evolution-sdk/scalus-uplc | 2.0.16 (exact pin; peer `evolution@0.5.16`) | local in-process evaluator (tried) |
| esbuild | 0.28.2 | browser bundle test |
| transitive | effect 3.22.3, @noble/curves 2.4.0, @noble/hashes 2.4.0, @scure/base/bip32/bip39 2.4.0, fast-check 3.23.2, pure-rand 6.1.0, @standard-schema/spec 1.1.0, scalus 0.17.0 | |

## Results

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Devnet: fresh alice/bob, mint thread token (seed = alice UTxO) to script with inline datum, alice spends with redeemer 7; confirmed via Kupo | **PASS** | `node item1-devnet.mjs provider` → `logs/item1-devnet-provider.log` (the first run hit a 10 s Kupmios timeout: `logs/item1-devnet-provider-run1-timeout.log`) |
| 1 | Same flow with the SDK's local in-process evaluation | **PASS with scalus-uplc** (ex-units identical to Ogmios: mint 122351 mem / 44332249 cpu, spend 152293 / 53988803). **FAIL with aiken-uplc**: it rejects the valid mint | `node item1-devnet.mjs scalus` → `logs/item1-devnet-scalus-evaluator.log`; `node item1-devnet.mjs aiken` → `logs/item1-devnet-aiken-evaluator.log`; `node item1-aiken-debug.mjs` → `logs/item1-aiken-debug.log` |
| 1 | In-process emulator / offline ledger | **Does not exist in 0.5.16** (no emulator module; the only match for "emulator" is a doc comment in `SlotConfig.js`). The local evaluators only run phase-2 scripts; they are not a ledger | `logs/item1-emulator-search.log` |
| 1-mut | Correct blueprint rejects an arbitrary token name | **PASS**: build-time eval fails, and a force-submit gets node error 3136 | `node item1-mint-mutation.mjs` → `logs/item1-mint-mutation.log`; `logs/item2-local-scalus.log`; `logs/item8-evaluate-timing.log` (Ogmios 3012 on the arbitrary-name tx) |
| 1-mut | Mutant blueprint accepts an arbitrary token name | **PASS** (re-run 2026-10-18 by the orchestrator after rebuilding the mutant, hash d0ff06ca…, so the output filter and datum check use the minted name): mutant with token = arbitrary and datum name = arbitrary was ACCEPTED; correct blueprint REJECTED at build and at force-submit. The first mutant (BLOCKED row) was an artifact, log kept as `logs/item1-mint-mutation-oldmutant.log` | `node item1-mint-mutation.mjs` → `logs/item1-mint-mutation.log` |
| 2 | Bob's illegal first move rejected at build time | **PASS**: provider evaluation (Ogmios 3010/3012 "machine terminated … error") and local scalus evaluation both reject | `node item2-3-illegal-move.mjs` → `logs/item2-3-illegal-move.log`; `node item2-local-scalus.mjs` → `logs/item2-local-scalus.log` |
| 3 | Force-submit the phase-1-valid, phase-2-invalid tx; node rejects with a phase-2 class error; the same shape signed by alice is accepted | **PASS**: evaluation bypassed with a custom `Evaluator` that returns fixed ex-units. Node error **3136 ValidationTagMismatch** (`declaredSpending: "inputs"`, `mismatchReason: "The transaction failed unexpectedly."`), not MissingVKeyWitnesses (bob is the required signer and his vkey witness is present). Mutation: alice's tx with the same bypass was accepted, and Kupo shows the token moved | `logs/item2-3-illegal-move.log` |
| 4 | Unsigned tx, signed by a CIP-30 mock `signTx(txCborHex, partialSign) -> witnessSetCborHex` plus a plain local private key, assembled and submitted | **PASS**: `withCip30(mockApi)` builder → `partialSign()` (calls the mock with `partialSign=true`) + `withPrivateKey().signTx(unsignedHex, {utxos})` → `assemble([w1, w2]).submit()` | `node item4-external-signers.mjs` → `logs/item4-external-signers.log` |
| 5 | esbuild `--bundle --platform=browser --format=esm` of the builder path | **PASS**: no Node built-ins referenced, and the bundle evaluates. Minified 987,641 B (291,096 B gzip); unminified 2.1 MB. Adding aiken-uplc fails without a `.wasm` loader; with `--loader:.wasm=file` it builds (+931 KB wasm) but was not run in a browser | `logs/item5-browser-bundle.log`, `entries/browser-builder.mjs` |
| 6 | Typed schemas from CIP-57 `plutus.json` | **PASS (built in)**: `import { Codegen, CodegenConfig } from "@evolution-sdk/evolution/blueprint"`; `Codegen.generateTypeScript(bp, config)` emits TSchema codecs (`SpikeDatum`, `CardanoTransactionOutputReference`, a per-validator `datum`/`redeemer` codec, compiledCode, hash). It is a library function, not a CLI (no `bin`). The generated module loads, and its datum CBOR equals hand-built `Data` | `node item6-blueprint.mjs` → `generated/spike-blueprint.ts`, `logs/item6-blueprint.log`; `node --experimental-strip-types item6-use-generated.ts` → `logs/item6-use-generated.log` |
| 7 | PlutusData + blake2b without loading the tx builder; Aiken vector | **PASS**: `@evolution-sdk/evolution/Data` (+ `@noble/hashes/blake2.js`) pulls 6 SDK modules (Bytes, CBOR, Bytes32, DatumHash, Numeric, Data) and 0 `sdk/` modules, 420 KB minified (mostly `effect` + `fast-check`). The root import pulls 213 SDK modules, 59 of them under `sdk/`. The default `Data.toCBORHex` and `AIKEN_DEFAULT_OPTIONS` give `D8799F58…0102FF` → name `202F389E…D918`, an exact match. `CML_DEFAULT_OPTIONS` (definite list `D87982…`) gives a different name, `D158C113…` | `node item7-token-name.mjs` → `logs/item7-token-name.log`; `node meta.mjs entries/data-only.mjs entries/plutus-subpath.mjs entries/root-index.mjs` → `logs/item7-metafile.log` |
| 8 | SDK Kupmios provider, unpatched, against Ogmios v7 | **FAIL (partial)**: `getProtocolParameters` fails. getUtxos, getUtxosByOutRef, inline-datum resolution, evaluateTx, submitTx and awaitTx work. A hard-coded 10 s timeout causes intermittent `evaluateTx` failures on this loaded devnet | `node item8-provider.mjs` → `logs/item8-provider-probe.log`; `logs/item8-pp-cause.log`; `node item8-pp-schema-offline.mjs` → `logs/item8-pp-schema-offline.log`; `logs/item8-evaluate-probe.log`; `logs/item8-evaluate-timing.log` |
| 9 | `npm ls --all --omit=dev --parseable \| wc -l` in a clean copy | **11** (root + 10 packages: evolution, effect, fast-check, pure-rand, @standard-schema/spec, @noble/curves, @noble/hashes, @scure/base, @scure/bip32, @scure/bip39); node_modules 48 MB | `logs/item9-deps.log` |

## Item 8 detail: Kupmios vs Ogmios v7 (measured)

`getProtocolParameters` decode error (`logs/item8-pp-cause.log`): `ProtocolParametersSchema → ["maxReferenceScriptsSize"] is missing`. Decoding the saved Ogmios v7 response offline with the SDK's own schema and `errors: "all"` (`logs/item8-pp-schema-offline.log`) shows exactly two gaps:

1. `maxReferenceScriptsSize` is missing. Ogmios v7 names it `maxReferenceScriptsSizePerTransaction` (a real v6→v7 incompatibility).
2. `plutusCostModels["plutus:v2"]` is missing. This devnet has only `plutus:v1` (166) and `plutus:v3` (251), because Yaci's cost-model governance proposal failed. It is specific to this devnet, but the SDK makes the key mandatory.

With both fixed, the response decodes. Workaround used in every script: map the protocol parameters by hand from `queryLedgerState/protocolParameters` (`lib.mjs` `protocolParameters()`) and pass them as `build({ fullProtocolParameters })`. No provider response was patched.

## About the Yaci note "Plutus cost models governance proposal failed"

- Effect measured on this devnet: no PlutusV2 cost model (this breaks Kupmios, as above), and the V3 cost model has 251 entries. Our validator's mint and spend scripts ran fine on the node at PV 11 with this model, so the builtins it uses (blake2b_256, serialiseData, list/data ops) are covered.
- *Inferred, not tested:* builtins that need cost-model entries beyond 251 (later batches) would fail or be unavailable on this devnet. A validator that uses them would need a devnet whose proposal succeeded.

## Surprises and workarounds

1. **Yaci topup REST failed** (`Topup failed`) on this instance. Funding comes from the public test mnemonic, account 1 (above). Genesis UTxOs are not indexed by Kupo (`/matches/*` was empty before the first tx), so the faucet's first UTxO is read through Ogmios `queryLedgerState/utxo` and passed as `availableUtxos` (`lib.mjs` `ogmiosUtxos()`).
2. **Kupmios `getProtocolParameters` is incompatible with Ogmios v7 and with a devnet that lacks a V2 cost model.** Fixed with hand-mapped `fullProtocolParameters` (item 8).
3. **Kupmios uses a hard-coded 10 s timeout** (`KupmiosEffects.js: const TIMEOUT = 10_000`, not configurable). On this shared devnet, Ogmios `evaluateTransaction` took 0.9 to 11.2 s (`logs/item8-evaluate-timing.log`; Ogmios was spending about half its CPU time in GC: `gcCpuTime` 412 s of 786 s). Several builds failed with `Operation timed out after '10s'` and needed retries (`item1-mint-mutation.mjs` `buildRetry`). A local evaluator (scalus) avoids this entirely.
4. **aiken-uplc 2.0.16 rejects a valid tx** (`Mint[0] the validator crashed / exited prematurely`) that Ogmios and scalus accept, and padding the cost model to 297 entries makes no difference. The WASM embeds `uplc-1.1.21`, while the validator was compiled with Aiken v1.1.24. *Inferred:* the cause is that version gap (the newer compiler emits UPLC that the older machine cannot run). scalus-uplc 2.0.16 works and matches Ogmios ex-units exactly.
5. **Bypassing evaluation**: `RedeemerData.exUnits` exists internally but is not settable through `collectFrom`/`mintAssets` params. The supported route is a custom `BuildOptions.evaluator` (interface `Evaluator.evaluate(tx, utxos, ctx) -> Effect<EvalRedeemer[]>`) that returns fixed ex-units (`game.mjs` `fixedEvaluator`). If all redeemers have non-zero ex-units, the builder then skips re-evaluation.
6. **Phase-2 rejection code**: the node reports a script failure in a tx marked `isValid=true` as Ogmios **3136 ValidationTagMismatch** ("The transaction failed unexpectedly"). It does not report 3010/3012. The 3012 code with the script error text appears only on `evaluateTransaction`.
7. **The CIP-30 wallet path takes UTxOs from `api.getUtxos()`** (CBOR `[input, output]`), not from the provider. A mock returning `[]` makes coin selection fail with `have 0`. The offline private-key signer needs `signTx(hex, { utxos })` to know which inputs are its own.
8. **The mutant blueprint does not isolate the token-name check.** The mutant accepts a valid mint but rejects any arbitrary name. *Inferred* from the trace and the source shape: the output filter `quantity_of(o.value, policy, name) == 1` still uses the computed name, so `expect [out]` fails on an empty list. A mutant that also uses `minted` for the output filter is needed to prove the name check is exercised. The correct blueprint's rejection of an arbitrary name is proven on both the local and node paths.
9. The `Data` module imports `fast-check` (for `arbitrary`), which adds about 380 KB of input to any bundle that encodes PlutusData.
10. Bundling aiken-uplc for the browser needs a wasm loader or plugin. scalus-uplc was not bundle-tested.

## Remaining uncertainty

- The browser bundle was only evaluated in Node (exports load) and not executed in a real browser against a CIP-30 wallet. The runtime behaviour of the aiken wasm in a bundle is untested.
- The cause of the aiken-uplc failure (Aiken/uplc version gap) is inferred, not proven.
- The "name check exercised" mutation was proven after the orchestrator rebuilt the mutant (see the 1-mut row).
- The Kupmios timeouts depend on load. On an unloaded devnet the first evaluate call took 0.3 to 4.5 s, so whether timeouts would occur without load is unmeasured.
- Ogmios v7 behaviour on preprod/mainnet (where `plutus:v2` exists) was not tested. Only gap 1 of item 8 would apply there (*inferred*).
