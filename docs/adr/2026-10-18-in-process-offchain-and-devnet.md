---
title: 鏈下改用程式內 SDK、devnet 改用維護中的工具、verifier 以允許清單劃界、thread token 併入 match multi-validator
date: 2026-10-18
review-date: 2027-01-18
status: active
tags: [cardano-agent-arena, decision, architecture, offchain, testing]
---

# 鏈下改用程式內 SDK、devnet 改用維護中的工具、verifier 以允許清單劃界、thread token 併入 match multi-validator

## Context

Walking skeleton（`7d750cf`）為了快，交易全部在 devnet node 容器內以 `docker exec … cardano-cli` 建構、簽章、送出；devnet 由手寫的 `docker run` 啟動，並以 `docker exec cardano-cli query tip` 輪詢就緒；verifier 呼叫外部 `aiken blueprint apply` 做 thread policy 的參數套用，並用自寫的 89 行 Ogmios client 讀鏈。2026-10-01 本機出現一次 60 秒 CLI timeout，2026-10-18 在現有環境重現不出，根因未證實。讀碼還發現現行 thread policy 有兩個缺口：沒有 burn 分支（G1）；`match.ak` 只信任 datum 宣告的 policy，鏈上可以偽造建局（G2）。計畫的步驟 6–12 都建立在這條路徑上，所以在步驟 5 之前重新決定。

**約束**：

- `external` 玩家私鑰不離開玩家端，正式路徑是自管 client、本機 runner 或 CIP-30 瀏覽器錢包：Will 的 D7 決定（`2026-10-01-l1-player-controlled-arena.md`）；[CIP-30](https://cips.cardano.org/cip/CIP-0030) 只給 JS 的 `signTx` 介面。
- `external` 玩家端不會有 preprod node，而 `cardano-cli transaction build` 需要 node socket。
- `external` 正式戰局在 preprod，devnet 只做測試；不使用需註冊或付費的服務：Will 的 D8 與計畫的全域約束。
- `external` 「任何人只用公開鏈上資料就能重播」是產品宣稱：README 與前一份 ADR。
- `external` 候選 SDK 都是 0.x，發版頻繁：2026-10-18 `npm view`，Lucid Evolution 在 10/9–10/17 發了 5 版。
- `inherited` 手寫 devnet 與 cardano-cli 路徑：來自 walking skeleton 的時程選擇；已不成立，因為它擋住步驟 8，也沒有 Kupo 可供步驟 7 使用。
- `inherited` 以 seed 為參數的 one-shot policy：來自 Aiken 範例；只剩「唯一性」這個目的還成立，參數化本身不是必要條件。
- `inherited` I5「版本鍵是 match hash」：仍成立；它原本要和每局不同的 policy hash 區分，multi-validator 下兩者相等。

## Options Considered

**交易建構與 devnet**

- **基準. 程式內 SDK 經 provider 建構、評估、簽章、送出，搭配維護中的 devnet 工具並以健康檢查判斷就緒**：例如 [Lucid Evolution Kupmios／Emulator](https://github.com/anastasia-labs/lucid-evolution)、[Evolution SDK devnet](https://developers.cardano.org/docs/get-started/client-sdks/typescript/evolution-sdk/devnet/overview/)、[Yaci DevKit](https://developers.cardano.org/docs/get-started/networks/development-networks/yaci-devkit)、[Ogmios `/health`](https://ogmios.dev/getting-started/monitoring)。
- **A. 維持 cardano-cli 經 `docker exec`**：零新依賴，但步驟 8 一定要換，阻塞式呼叫與 60 秒逾時的風險也留著。
- **B. 程式內 SDK，加上自建 compose（node＋Ogmios＋Kupo）**：版本完全由我們鎖定；harness 要自己維護。
- **C. 程式內 SDK，加上 Yaci DevKit（選用）**：內建 Ogmios、Kupo、相容 Blockfrost 的 Yaci Store 與 CIP-30 錢包；node 版本跟著 Yaci 走。

**verifier 的依賴**

- **基準. 驗證工具的依賴最小化，並用套件邊界守住**：獨立套件加上 import 規則（[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)）。
- **D. 與交易建構共用同一個 SDK**：程式最少，審查範圍包含整個 SDK。
- **E. 獨立套件與允許清單，Ogmios 用官方 [`@cardano-ogmios/client`](https://ogmios.dev/typescript/)（選用）**：有 schema 型別、整數不失真；多約 10 個遞移依賴。
- **F. 同 E，但維持自寫 Ogmios client**：零依賴；協定實作與整數解析要自己維護。

**thread token**

- **基準. state thread token：花用 seed 達成 one-shot、token name 取 outref hash、mint 時驗證去向與初始 datum**：[Aiken common design patterns](https://aiken-lang.org/fundamentals/common-design-patterns)。
- **G. seed 當 policy 參數**：現況；每局 policy hash 不同，建局與 verifier 都要做 UPLC 參數套用，且有 G1、G2。
- **H. 獨立的固定 policy，match 以參數綁定它**：mint 邏輯改版不影響規則版本；兩支 script 要互相綁定。
- **I. multi-validator，policy id 等於 match hash（選用）**：只有一個版本鍵，鏈上直接擋下偽造建局；mint 邏輯改版也會換掉規則版本。

## Decision

- **D13**：選 C，而非 A、B。SDK 由 spike 依固定規則選定：(1)–(8) 項全部通過、採用版本發布滿 14 天、provider 不需修補；同分時取依賴較少者。Yaci DevKit 只要有任一條件不成立（兩平台啟動、PlutusV3、任意地址撥款、並行隔離、Kupo 全部／不 prune／從 origin、免註冊），就自動改用 B。步驟 4.5a 實測後（`docs/plans/2026-10-01-agent-arena/spike-offchain.md`）三個 SDK 都沒有全過，Will 在 2026-10-18 選 Blaze 0.3.1：它是唯一一個 Emulator 送出時會跑 phase-2 的，且自帶 provider 接 Ogmios v7 不需修補；代價是 141 個遞移依賴要靠 lockfile 鎖住、瀏覽器打包要加 shim。備案為依賴最少、但沒有 Emulator 的 Evolution SDK 0.5.16。devnet 用 Yaci DevKit 0.12.0 的 Docker image，容器生命週期自己管理。
- **D14**：選 E，而非 D、F。verifier 是獨立的 workspace 套件，依允許清單管理依賴，由 `dependency-cruiser` 規則守住。
- **D15**：選 I，而非 G、H。mint 時驗證 seed 已花用、只鑄一個、送到本地址、初始 datum 合法；spend 時驗證 token 屬於本 policy。burn（G1）在步驟 6 的結算一併做。

## Rationale

- **D13**：A 的阻擋點是 REAL 的（玩家端沒有 node socket、CIP-30 只能用 JS），不是時程問題，所以步驟 8 之前一定要換；早換可以讓步驟 6 的正式 tx builder 一開始就寫在 SDK 上，代價是數字遊戲的交易形狀（約 100 行）會丟掉。選 C 而非 B，是因為 Yaci 同時提供步驟 7 的第二條讀取路徑和步驟 8、9 要用的 CIP-30 錢包；「會被 Yaci 的版本綁住」對自己鎖的版本同樣成立，所以不構成拒絕理由。不選 Evolution SDK 內附的 devnet，因為它預設的 node 10.5.1、Ogmios v6 比 repo 鎖的版本舊。另一個代價是 Lucid Emulator 送交易時不跑 script，所以鏈上拒絕的測試仍要留在 devnet。
- **D14**：選 E 而非 D，因為 verifier 不應載入交易建構程式碼。選 E 而非 F，是 Will 看過「官方 client 帶 10 個依賴、自寫的零依賴」這個取捨後的決定：以官方維護、schema 型別與整數正確性，換取較大的審查範圍。最初建議 E 時寫的理由是「審查範圍較小」，這個前提是錯的，已更正。
- **D15**：Will 選了「固定 policy、token name 為 seed hash」。I 是它在業界基線下的形式，兩份獨立起草的草稿也都選 I。相較 G，I 省掉 verifier 的 UPLC 參數套用，允許清單因此更小，同時在鏈上補上 G2。不選 H，因為 MVP 的建局與行動規則一起演進，多一個版本鍵只會讓 indexer 和 verifier 多管一個 hash。代價是建局規則一改，規則版本就跟著換，Elo 分組也會被切開；validator 都還沒部署，所以改動可逆。

## Expected Outcome

- `offchain/`、`scripts/`、`test/` 裡沒有任何 `cardano-cli` 或 `docker exec` 呼叫，`offchain/` 與 `verifier/` 裡沒有 `child_process`（用 `rg` 驗證）；devnet harness 起停容器、E2E 以獨立行程重播 verifier 仍可用子程序，因為禁用的理由（玩家端沒有 node socket、CLI 阻塞逾時）不適用於它們（2026-10-18 Will 確認）。devnet 就緒只看 Ogmios 和 Kupo 的健康狀態。
- `make check` 在本機與 CI 都綠燈，兩個 devnet 實例並行也能過；每次 E2E 都輸出呼叫耗時摘要。
- verifier 用 `npm pack` 打包、在乾淨目錄安裝後，能重播 devnet 戰局；在 verifier 裡加一行 import 交易建構 SDK，`make check` 就會失敗。
- 偽造 policy 的建局，以及 token 沒送到 match 地址的建局，在鏈上都被拒絕；拿掉對應檢查後，對應的 Aiken 測試會失敗。

## Followup

- 步驟 4.5a–4.5d 照計畫 `docs/plans/2026-10-01-agent-arena.md` 執行；spike 的選型結果寫進 `spike-offchain.md` 和計畫的進度表。
- 步驟 11 接上 preprod 的 Koios provider；要改用 Blockfrost，等 Will 註冊後再換。
- 步驟 6：量 multi-validator 在 25 步內的 fee 與 ex-units，確認在 D8 的 10 tADA 內；加上終局 burn，`history.ts` 的 successor 邏輯接受 burn。
- 步驟 7：verifier 在 preprod 不能每次從 origin 全量 chain-sync，改用不 prune 的 Kupo 這類索引查 policy 歷史。
- 10/01 的 timeout 根因仍未證實：若在 Ogmios 或 Kupo 路徑重演，依耗時紀錄重開調查。

## Revocation Triggers

- 選定的 SDK 撐不起 PlutusV3 mint＋spend＋required signer，或 provider 又需要修補回應格式 → 改用備案 SDK。
- 官方 Ogmios client 不支援 devnet 或 preprod 的 Ogmios 版本 → 重評 D14 的選項 F。
- Yaci DevKit 停止維護，或跟不上 preprod 的協定版本 → 改用自建 compose。
- multi-validator 的建局或結算超出 D8 的成本或 ex-units 上限，或建局規則一個月內改版超過一次 → 重評 D15 的選項 H。

## Review Notes

## Related

- 來源：2026-10-18 與 Will 的討論當場拍板；本 ADR 即原始紀錄，無外部來源文件。審查紀錄與兩份獨立 ADR 草稿的對照在計畫的「壓力測試紀錄」段。
- 前一份 ADR：`2026-10-01-l1-player-controlled-arena.md`（D6 允許技術用途 token、D7 自管金鑰）。
