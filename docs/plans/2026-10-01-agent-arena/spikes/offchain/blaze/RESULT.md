# Blaze 0.3.1 off-chain spike: results

Date: 2026-10-18. Throwaway spike. Devnet: Yaci DevKit 0.12.0 (`arena-spike-yaci-a`, magic 42, Conway, protocol 11), Ogmios `127.0.0.1:57772`, Kupo `127.0.0.1:57771`. Node v26.10.0, npm 11.19.1.
All statuses below were measured by running the named script. Raw output is under `logs/`. Keys are generated in-process and never written to disk. The faucet is Yaci's public test mnemonic, account 2.

## Results

| # | Item | Status | Evidence |
|---|---|---|---|
| 1a | Devnet: fresh alice/bob, fund, mint thread token (seed = alice UTxO) to script with inline datum, alice moves 7 (collateral + required signer), Kupo confirms | PASS | `node item1-devnet.mjs` → `logs/item1-devnet.txt`. Mint `751137b2…#0` holds `83b820c5….7c67441d…`; inline datum equals the built datum; move tx `f56e1167…` evaluated by Ogmios at {mem 148399, steps 51411326}; Kupo's next datum is `…9f07ff…20ff` (moves=[7], result=-1) |
| 1b | Emulator (`@blaze-cardano/emulator` 0.5.1): same flow | PASS | `node item1-emulator.mjs` → `logs/item1-emulator.txt`. The move's ExUnits match Ogmios exactly (148399 / 51411326) |
| 1c | Does the Emulator run phase-2 on submit? | YES | Bob's illegal move, built with evaluation bypassed and sent to `EmulatorProvider.postTransactionToChain`, is rejected with `failed script execution / Spend[0] the validator crashed`. `Emulator.submitTransaction` calls its UPLC evaluator and also checks for an underestimated budget |
| 1d | Mint mutation: the correct blueprint rejects an arbitrary token name; the mutant accepts it | PASS | `node item1-mint-mutation.mjs` → `logs/item1-mint-mutation.txt`. Correct blueprint: rejected at build with 3010/3012 (`purpose: mint`), and rejected by the node with **3136** when evaluation is bypassed. Mutant (`d0ff06ca…`): minted `deadbeef…` and Kupo confirms it (tx `08031359…`). The Emulator shows the same three outcomes |
| 2 | Bob's illegal first move (bob is the required signer and signs) is rejected at build time by evaluation | PASS | `node item2-3-illegal.mjs` → `logs/item2-3-illegal.txt`. `TxBuilder.complete()` throws Ogmios `3010` → `3012` (`purpose: spend`, "machine terminated … (error)") |
| 3 | Same illegal tx with evaluation bypassed → node rejects with phase-2 (3136), not MissingVKeyWitnesses; the same shape signed by alice is accepted | PASS | Same log. Bypass: `TxBuilder.useEvaluator(fixedEvaluator())` returns the tx's redeemers with fixed ExUnits {3,000,000 mem, 2,000,000,000 steps}. `Blaze.newTransaction()` registers its provider evaluator with `override=false`, so a user evaluator set before `complete()` takes precedence. Bob's version: `code 3136 … mismatchReason: The transaction failed unexpectedly`, with no 3117. Alice's version (same ExUnits, fee 567105): submitted and Kupo confirms it (`e87eaef7…`) |
| 4 | Unsigned tx signed by an external CIP-30-style mock `signTx(txCborHex, partialSign) → witnessSetCborHex` and by a plain local key; assemble; submit | PASS | `node item4-external-signers.mjs` → `logs/item4-external-signers.txt`. The tx has 2 inputs (alice and bob). Alice's witness comes from the mock, called raw and through Blaze's `WebWallet` wrapper (both give identical witness-set CBOR). Bob's comes from a raw `Ed25519PrivateKey`. After merging, the tx id is unchanged and Kupo confirms it (`826079bc…`) |
| 5 | esbuild browser bundle (`--bundle --platform=browser --format=esm`) | PASS with shims; FAIL without | Plain command: 10 errors (`logs/item5-esbuild-plain.txt`): `.wasm` has no loader (`@emurgo/cardano-message-signing-browser`); `path`/`fs` (`@emurgo/cardano-message-signing-nodejs`); `buffer` and `events` (safe-buffer, ripemd160, readable-stream, core-util-is, string_decoder). With shims (`node build-browser.mjs` → `logs/item5-build-browser.txt`): **full** 1,672,764 B (510,480 gzip, 81 packages); **nosign** 1,237,561 B (364,360 gzip). Runtime smoke in Node with `window` set (`logs/item5-bundle-smoke.txt`): both bundles connect to the devnet through Kupmios + WebWallet and read params. **Not run in a real browser.** |
| 6 | Typed schema generation from CIP-57 plutus.json | PASS (via a bundler); FAIL under Node native TS stripping | `npx blueprint ../validator/plutus.json -o generated/plutus.ts` (`logs/item6-generate.txt`) generates the `Datum` typebox schema and the classes `SpikeSpikeMint`/`SpikeSpikeSpend` (`TypedScript` with `.datum()`/`.redeemer()`). `node item6-use-generated.ts` fails: generated code does `import { Type, Exact, … } from "@blaze-cardano/data"`, and `Exact` is a type-only export. Transpiled with esbuild (unused imports dropped), all 3 datum cases, the mint redeemer and the spend redeemer are **byte-equal** to the hand-built PlutusData, and the script hash equals `83b820c5…` (`logs/item6-use-generated.txt`) |
| 7 | PlutusData + blake2b without tx-building code; token name equals the Aiken vector | PASS | `node build-minimal.mjs` → `logs/item7-minimal.txt`. Entry imports only `@blaze-cardano/core` {PlutusData, ConstrPlutusData, PlutusList, blake2b_256, HexBlob}. Bundle: 449,231 B (99,281 gzip), 23 packages, of which `@cardano-sdk/core` is 304,686 B. No libsodium and no tx/query/wallet code. CBOR = `D8799F5820…0102FF` and name = `202F389E…D918`, both exactly the Aiken vector. Without the Buffer shim the build still succeeds (409.8 kB) but throws `ReferenceError: Buffer is not defined` at runtime once the Buffer global is removed (`logs/item7-nobuffer-smoke.txt`) |
| 8 | Blaze's own Kupmios provider against the devnet, responses not patched | PASS (with one gap) | `node item8-provider.mjs` → `logs/item8-provider.txt`. `getParameters` works on the raw Ogmios v7 response: missing `plutus:v2` becomes an empty cost model `[]` (lengths V1=166, V2=0, V3=251), and Kupmios never reads `maxReferenceScripts*`. Items 1–4 drive `getUnspentOutputs`, `getUnspentOutputsWithAsset`, `evaluateTransaction` and `postTransactionToChain` through Kupmios unpatched. **Gap:** `getSlotConfig()` throws `unsupported network`, see Surprises |
| 9 | Clean dir, only `@blaze-cardano/sdk@0.3.1` | 141 | `logs/item9-clean-install.txt`: `npm ls --all --omit=dev --parseable \| wc -l` = **141**; node_modules is 120 MB. That install resolves **October 2026** packages (tx 0.15.4, query 0.6.4, wallet 0.6.3, uplc 0.5.4, data 0.6.11, ogmios 0.0.8), plus **two copies of core** (0.9.1 and 0.10.1) |

## Package versions (this spike, `logs/npm-ls-depth0.txt`)

Pinned to the 0.3.1 release set (2026-07-17/21) through `overrides` in package.json:

- `@blaze-cardano/sdk` 0.3.1 (2026-07-21)
- tx 0.15.1, query 0.6.1, wallet 0.6.1, uplc 0.5.1, data 0.6.8, vm 0.3.1, emulator 0.5.1 (all 2026-07-21)
- core 0.9.0 and blueprint 0.9.0 (2026-07-17)
- ogmios 0.0.7 (2024-11)

Transitive: `@cardano-sdk/core` 0.46.15, `@cardano-ogmios/schema` 6.14.0. Dev and shim packages: esbuild 0.25.9, buffer 6.0.3, events 3.3.0, esbuild-plugin-wasm 1.1.0.

## Workarounds used

- **Funding.** The faucet's genesis UTxO is read with Ogmios `queryLedgerState/utxo` and passed with `TxBuilder.addInput` and `complete({useCoinSelection:false})`. The tx is signed with a raw BIP32-derived key, path m/1852'/1815'/2'/0/0 (`lib.mjs` `fundFromFaucet`). Kupmios returns `[]` for that address, as expected.
- **Evaluation bypass** (item 3): `useEvaluator(fixedEvaluator())`. This is public API, not a patch.
- **Browser bundle** (`build-browser.mjs`):
  - alias `buffer` → `buffer/` and `events` → `events/`
  - inject a `globalThis.Buffer` shim and `define global=globalThis`
  - `esbuild-plugin-wasm` (embedded) for `@emurgo/cardano-message-signing-browser`
  - mark `@emurgo/cardano-message-signing-nodejs` external
  - Why: `@blaze-cardano/wallet` dynamically imports both message-signing packages, branching on `typeof window`. They are used only by `signData`. The "nosign" variant externalizes both and saves about 435 kB.
- **Generated TS** must go through a TS transpiler (esbuild or tsc) because of the value-import of `Exact`.
- No provider responses were patched, and no protocol parameters were hand-supplied. Kupmios' own `getParameters` was enough.

## Surprises

1. **Pinning `sdk@0.3.1` does not pin the stack.**
   - The `^` ranges pull October 2026 releases: tx 0.15.2–0.15.4 (2026-10-08 to 10-14), query 0.6.4, and a duplicated core 0.10.1.
   - `@blaze-cardano/ogmios ^0.0.7` is effectively exact, but query 0.6.4 brings 0.0.8 (2026-10-14).
   - Reproducing a July 2026 stack needs `overrides` or a lockfile.
2. **`Kupmios.getSlotConfig()` / `unixToSlot` throw `unsupported network` on the devnet.**
   - Cause: network is detected by URL substring (`mainnet-v6` / `preprod-v6` / `preview-v6`), so a local Ogmios URL becomes `networkName: "unknown"` with Testnet id.
   - None of the tested flows set validity intervals, so they were unaffected.
   - A wall-clock move timeout would need a slot config supplied by hand, e.g. a Provider subclass that overrides `getSlotConfig`. Inferred from the code, not tested.
3. **Noise on stdout.** `@blaze-cardano/ogmios` prints `url ws://…` on connect. Kupmios `evaluateTransaction` `console.error`s every failed evaluation before rethrowing the raw Ogmios error JSON.
4. **The Emulator is a real phase-2 gate.** It runs its UPLC VM evaluator on submit and also checks for an underestimated budget. Its ExUnits matched Ogmios exactly for the spend.
5. Raw `PlutusData` from `@blaze-cardano/core` (cardano-js-sdk serialization) emits indefinite-length constructor fields and non-empty lists, matching Aiken, and `80` for empty lists. The generated typebox serializer gives byte-identical output.
6. Evaluation latency was low on this run: build plus Ogmios evaluation in about 1–2 s, and full fund→mint→move in 8.5 s. No 3997 retries were needed. The retry logic exists in `submitRetry` but was not exercised.

## Remaining uncertainty

- No real-browser run. The browser bundles were only executed in Node with `window` set and with Buffer deleted for item 7. Whether esbuild-plugin-wasm's embedded wasm and libsodium-sumo initialise in a browser is not measured.
- Fixed-ExUnits bypass on the node: only shown for one tx shape (single spend or mint).
- The clean-install tree (October 2026 versions) was only counted. The flows were not run against it.
- Kupmios `awaitTransactionConfirmation` and `events()` chain-sync were not exercised. Confirmation used Kupo polling instead.
