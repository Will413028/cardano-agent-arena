# 步驟 4.5a spike：鏈下 SDK、Ogmios client 與 devnet 工具

2026-10-18 實測。除非註明「推論」，每一項都附指令與原始輸出，存在 `spikes/offchain/<sdk>/RESULT.md` 與各自的 `logs/`。主機負載高（load 約 80），各項耗時只能當作「有沒有卡住」的參考，不是效能數據。

## 共同環境

- validator：`spikes/offchain/validator/`，拋棄式 PlutusV3 multi-validator（mint＋spend，policy id 等於 script hash `83b820c5…`），token name 為 `blake2b_256(cbor(seed))`。Aiken 的 CBOR 向量是 indefinite list：`D8799F58…0102FF` → `202F389E…D918`。mutant（`d0ff06ca…`）拿掉 name 檢查，用來證明測試真的打到這條檢查。第一版 mutant 的 output 篩選仍用計算出來的 name，所以無效；重建後三個 SDK 都重跑過。
- devnet：Yaci DevKit 0.12.0 的 Docker image，用 `docker run --entrypoint /app/yaci-cli … up --enable-kupomios` 起兩個實例並行，port 動態配置。
- 撥款：Yaci 的 topup REST 在 Docker 模式回 `Topup failed`（本機與 CI 都實測到），改由 Yaci 公開的預設測試助記詞帳號在程式內轉帳。genesis UTxO 不在 Kupo 的索引裡，要從 Ogmios 讀出來。

## SDK 比較

| 測項 | Lucid Evolution 0.6.5 | Evolution SDK 0.5.16 | Blaze 0.3.1 |
|---|---|---|---|
| (1) devnet 完整流程 | 通過（要兩個 workaround） | 通過 | 通過 |
| (1) Emulator 流程 | 通過 | 0.5.16 沒有 Emulator；改用 scalus 本機評估，execution units 與 Ogmios 相同 | 通過，execution units 與 Ogmios 相同 |
| Emulator 送出時跑 phase-2 | 不跑（bob 的非法交易被接受） | 不適用 | 跑（bob 的非法交易被拒） |
| mint mutation | 通過 | 通過（重建 mutant 後由我重跑） | 通過 |
| (2) 建構時擋下非法交易 | 通過 | 通過 | 通過 |
| (3) 強行送出以 phase-2 被拒（3136） | 通過 | 通過 | 通過 |
| (4) 外部 CIP-30 mock 與本機金鑰簽章後組合 | 通過 | 通過 | 通過 |
| (5) esbuild 瀏覽器打包 | 直接打包失敗；加 wasm plugin 與 buffer／events polyfill 後 6.51 MiB | 直接通過，987 KB（gzip 291 KB） | 直接打包失敗；加 shim 後 1.67 MB（gzip 510 KB） |
| (6) 從 CIP-57 產生型別 | 沒有，要自寫約 25 行 | 內建 `Codegen.generateTypeScript` | 內建；產生的程式碼要經 bundler 轉譯，Node 原生 strip-types 會失敗 |
| (7) 編碼模組單獨 import | 部分：仍載入約 3 MB 的 CML WASM | 通過：`/Data` 子路徑 6 個模組、0 個建構模組，420 KB | 通過：`@blaze-cardano/core` 449 KB、23 個套件 |
| (8) 自帶 Kupmios 接 Ogmios v7，不修補回應 | 初始化失敗（缺 PlutusV2 cost model）；其餘呼叫通過 | 協定參數失敗：SDK 讀已改名的 `maxReferenceScriptsSize`，且要求 V2 cost model；其餘呼叫通過；10 秒逾時寫死 | 通過；缺 V2 時補空陣列、不讀改名欄位；`getSlotConfig()` 對自訂網路拋錯，要自己提供 slot config |
| (9) 遞移依賴數 | 149 | 11 | 141（`^` 範圍會拉進 10 月的版本，要靠 lockfile 或 overrides 鎖住） |

依 D13 的規則：三者都沒有 (1)–(8) 全過，也都完成了 (1)–(4)，所以沒有觸發停止條件，但規則選不出贏家。這是規則沒涵蓋的情況，交給 Will 決定（見「選型」段）。

## Ogmios client

`@cardano-ogmios/client@7.0.0`（2026-06-20 發布）對 devnet 的 Ogmios v7.0.0：`getServerHealth`、`networkTip`、從 origin 起的 chain-sync 200 個 block 花 2.1 秒，初始 rollBackward 事件會觸發；大於 2^53 的整數解析成 bigint 不失真（原生 `JSON.parse` 會失真）。單一出塊者的 devnet 不會分叉，真正的 rollback 沒測到。證據：`spikes/offchain/ogmios/chainsync.log`。

## devnet 工具：Yaci DevKit 0.12.0

| D13 條件 | 結果 | 證據 |
|---|---|---|
| macOS arm64 啟動 | 通過：Docker image 是 arm64 原生，node 11.0.1 linux-aarch64 | 本機實測 |
| ubuntu-latest 啟動 | 通過：兩個實例各在 11–16 秒內通過健康檢查 | CI run `39090704534`、`39090888319`（暫時分支 `spike/yaci-ci`） |
| Conway 時代可跑 PlutusV3 | 通過：三個 SDK 的 mint 與 spend 都在節點上通過 | 各 SDK 的 `logs/` |
| 能為任意地址撥款 | 通過，但不是用 topup REST：Docker 模式下 topup 回 `Topup failed`，改由公開預設帳號轉帳 | 各 SDK 的 `lib.mjs` |
| 兩個實例並行、`down` 只影響自己 | Docker 模式通過（動態 port，`docker rm` 一個不影響另一個）。npm 啟動器不通過：用全域的 `~/.yaci-cli` PID 檔，啟動時會殺掉機器上任何既有的 yaci-cli，關掉後 node／Ogmios／submit-api 還會變成孤兒進程 | CI run `39090704534`；`spikes/offchain/yaci/evidence/npm-launcher-start.mjs` |
| Kupo 設為全部、不 prune、從 origin | 通過：預設參數就是 `--since origin --match *` | `ps` 實測 |
| 免註冊 | 通過 | — |

另外三個發現：

- 帳本缺 PlutusV2 cost model，只有 V1（166）與 V3（251），但 Yaci 的 alonzo genesis 檔有 V2。推論和 Yaci 啟動時失敗的 cost model 治理提案有關，未證實。preprod 有 V2，所以 devnet 的協定參數和 preprod 不一致。這不在 D13 的條件裡，但正是 Lucid 與 Evolution 的 Kupmios 失敗原因之一。
- Yaci 內附 node 11.0.1，repo 目前鎖的是 11.1.2；Yaci 的 npm 版本在 macOS 下載的是 amd64 的 node（走 Rosetta）。
- Ogmios v7 的 `/health` 用 `lastKnownTip.height`，不是計畫原先寫的 `blockNo`；Kupo 的 `/health` 要加 `Accept: application/json` 才回 JSON（預設是 Prometheus 文字）。

依 D13，Yaci DevKit 的條件全部成立，選定 Yaci。用法是我們自己管理 Docker image 的生命週期，不用它的 npm 啟動器，也不用 `devkit.sh`。

## 選型

- SDK：**Blaze 0.3.1**（Will 在 2026-10-18 看過上表後決定）。它是唯一一個 Emulator 送出時會跑 phase-2 的，負向測試不用 Docker 就能跑；自帶的 Kupmios 接 Ogmios v7 不需修補；編碼模組可以單獨 import。代價：141 個遞移依賴，要靠 lockfile 鎖住整套；瀏覽器打包要加 wasm 與 Node 內建模組的 shim；產生的型別要經 bundler 轉譯；自訂網路要自己提供 slot config。採用的整套版本：sdk 0.3.1、tx 0.15.1、query 0.6.1、wallet 0.6.1、uplc 0.5.1、data 0.6.8、vm 0.3.1、emulator 0.5.1、core 0.9.0、blueprint 0.9.0、ogmios 0.0.7（`spikes/offchain/blaze/package.json` 的 overrides）。
- 備案 SDK：Evolution SDK 0.5.16，依賴最少且打包最乾淨，但沒有 Emulator，自帶 Kupmios 讀不到 Ogmios v7 的協定參數。
- devnet：Yaci DevKit 0.12.0 的 Docker image，由我們自己管理容器生命週期。
- Ogmios client：`@cardano-ogmios/client@7.0.0`（D14）。
- 帶進步驟 4.5b 的事實：就緒看 Ogmios `/health` 的 `connectionStatus` 與 `lastKnownTip.height`，以及 Kupo `/health`（JSON）的 `most_recent_checkpoint`；撥款改由公開預設帳號轉帳，不用 topup REST；genesis UTxO 從 Ogmios 讀；Blaze 要自己提供 slot config；devnet 缺 PlutusV2 cost model。
