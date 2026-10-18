# AI Agent 對戰競技場：從產品驗證到第一款可驗證對戰遊戲上線

**Goal：** 一款簡單、非即時的策略遊戲，玩家用自己的 Agent（經公開客戶端）參賽；合約驗證每個合法行動與勝負；任何人只用公開鏈上資料與公開規則就能以 verifier 重播正式戰局並重算排名；網站提供觀戰、回放與排名。終態由步驟 13 的驗收逐項核對。若 D1 選「先驗證」且結論是沒人要，本計畫在步驟 1 結束，終態是一份驗證報告。

**上層：** 暫代。沒有主清單（需求來源是一次性的構想筆記，不算主清單），範圍段的「延後」暫當清單，下一段暫放全域約束與完成定義。

**附件：** `2026-10-01-agent-arena/`：`requirements.md`（需求清單與來源句）、`nfr-and-risks.md`（非功能需求、產品風險）、`external-interfaces.md`（外部介面與既有先例，查詢日期 2026-10-01）、`spike-l1.md`／`spike-alternatives.md`（實測與適用界線）、`spikes/`（拋棄式程式碼與原始資料）、`check_plan.py`（計畫與需求清單的欄位檢查）。Walking skeleton 已建立；計畫、附件與 spike 的版本控制基線為 `7d750cf`。

**位置：** 已選定獨立公開 repo `Will413028/cardano-agent-arena`（D2）；本檔與附件已在目標 checkout，步驟 4 建立產品 scaffold。

## 全域約束與完成定義（暫代主計畫）

- 未經 Will 授權，不公開發布、不聯絡使用者、不在社群貼文（來源 A：「也未授權公開發布或聯絡使用者」）。
- 不收款、不分潤；Token／NFT 不作產品核心（來源 A 的產品範圍）。技術用途的 token 是否允許見 D6。
- 對外文案不得宣稱鏈上紀錄證明行動由指定模型或未修改的 Agent 產生，也不得宣稱排名保證沒有刷分（來源 A S6）。
- 不用真實資金：mainnet 不在本階段範圍，變更 D8 並取得 Will 授權後才能交易。開發與測試用本機 devnet 與 preprod 測試網。
- 不註冊外部服務、不使用付費 API，除非列在步驟的「需要人做的事」且 Will 完成。
- 介面語言英文或中英雙語。
- 完成定義（每個切片都要做到）：
  - `make check` 綠燈（含 `aiken check`、鏈下單元測試、規則引擎與 validator 共用測試向量的差異測試、devnet 端到端測試）。
  - 改到 validator 或規則的切片：附「破壞新行為要失敗」的 mutation 紀錄（改了哪一行、哪個測試失敗）。
  - verifier 能重播該切片產生的所有 devnet 戰局，結果與索引器一致。
  - 不變量表補上實際檔案路徑。
  - 進度表只在驗收真的跑過之後更新。

## 前提（開工時核對過，2026-10-01）

- P1 會改到或取代的既有部署是否在線：無既有部署，全新系統。部署到鏈上的 validator 不可修改，寫成不變量 I5；步驟 12 的正式部署僅限 preprod（D8）。
- P2 Will 已確認進入開發（2026-10-01），不再擋住步驟。
- P3 投入的時間預算未定（未確認；影響步驟節奏，不擋步驟）。
- P4 工具鏈（預設（可推翻））：validator 用 Aiken（來源 A 點名）；鏈下交易建構、客戶端、索引與 verifier 用 TypeScript（Cardano 鏈下函式庫生態最完整）；網站用靜態前端讀索引器 API；本機 devnet 跑測試，preprod 跑實測。2026-10-18 起交易在程式內以 SDK 建構、devnet 改用維護中的工具，見 D13、D14、D15 與步驟 4.5a–4.5d。
- P5 Cardano L1 參數：preprod maxTxSize 16,384 bytes、maxTxExecutionUnits memory 17,500,000／steps 10,000,000,000；devnet memory 14,000,000／steps 10,000,000,000。來源：節點 query 與 Koios epoch_params，2026-10-01 已查實值。preprod 20 筆入塊延遲 median 25.44s、p95 47.11s、max 105.18s，見 spike-l1.md；不是最終性。
- P6 Hydra head 要求所有參與者執行 hydra-node 並在線，不配合時要上 L1 關閉 head（docs.cardano.org／hydra.family，2026-10-01；已實測 Bob 離線後 Close/Fanout，見 spike-alternatives.md）。
- P7 對局詳情頁列出每步的交易 ID，讓人自行到任何 explorer 或節點核對（推論自 S4，不改契約；未確認）。
- P8 安全參數：玩家私鑰的存放照 Cardano 錢包慣例（CIP-30 瀏覽器錢包或本機 signing key 檔，不上傳）（預設（可推翻）；來源：CIP-30，步驟 8 開工時附連結）。
- P9 既有缺陷：無（全新系統）。

**驗收基線：** 規劃時無可執行的產品 scaffold；目前 Walking skeleton 的 `make check` 在 CI（`48aa0be`）與本機（2026-10-18，`858e125`）都通過；步驟 2、3 的 spike 驗收不等於產品驗收。

## 本階段依賴的不變量

Walking skeleton 的實際路徑為 `validators/validators/match.ak`、`offchain/tx-builder.ts`、`indexer/cli.ts`、`verifier/cli.ts`、`web/server.ts`、`offchain/generated/contract.ts`；下表其餘模組仍是後續步驟的預計位置。步驟 4.5a–4.5d 會改寫 `offchain/tx-builder.ts`、`offchain/chain.ts`、`offchain/history.ts`、`scripts/devnet.ts` 與 `test/devnet.e2e.ts`，完成後在此補實際路徑。

| 不變量 | 依賴它的機制（預計模組） |
|---|---|
| I1 行動合法性與勝負只由 validator 判定；鏈下規則引擎只做預覽與重播 | `validators/match.ak`（行動與結算 redeemer）、`offchain/tx-builder`（結算交易）、`indexer`（只記錄鏈上已接受的狀態）、`ranking`、`verifier` |
| I2 營運者沒有繞過驗證的權限：validator 參數裡沒有營運者金鑰可改戰局或結果（D10 已確認） | `validators/match.ak` 的參數、`scripts/deploy`、`offchain/tx-builder` |
| I3 正式戰局只用公開鏈上資料與公開規則就能完整重播，不依賴營運者的索引器或網站 | `verifier`（多個資料來源）、`validators/match.ak` 的 datum／redeemer 編碼、逐步 L1 交易歷史（D5） |
| I4 鏈下規則引擎與 validator 對同一行動序列得出相同的合法性與結果 | `rules/`（鏈下引擎）、`test-vectors/*.json`、`validators/match.ak` 的測試、差異測試 `make check` 一項 |
| I5 已部署的 validator 不可修改；規則改版等於新的 match validator script hash（版本鍵是 match validator 的 hash；D15 起 thread token 與 match 同一個 multi-validator，policy id 等於這個 hash）；hash 與規則版本的對照公開在 repo 的 `rules/versions.json`（D6 已確認 thread token） | `scripts/deploy`、`indexer`（以 script hash 分版本）、`verifier`（依 script hash 選規則版本）、`ranking`（依版本分組） |
| I6 玩家私鑰不離開玩家端（D7 已確認自管 client／本機 runner） | `client`（簽章）、`starter-kit`、網站的錢包連接 |
| I8 datum／redeemer 的編碼只有一個來源：Aiken 產生的 `plutus.json` blueprint；TS 型別由它產生，CI 檢查產生物沒有漂移 | `validators/`、`offchain/tx-builder`、`indexer`、`verifier`、`client`、`starter-kit`、CI 的 blueprint 漂移檢查 |
| I7 排名是正式戰局結果的確定性函式，任何人可重算（D9 已確認鏈上可重算的計分限制） | `ranking`、`verifier rank` 子指令、排名頁 |
| I9 verifier 是獨立的 npm workspace 套件，執行期依賴只有允許清單：規則引擎與 blueprint 編碼（共用模組）、`@cardano-ogmios/client`、步驟 4.5a 選定的編碼函式庫（限不載入交易建構程式的子路徑），加上步驟 7 的第二條讀取路徑 client；不依賴交易建構 SDK、外部 CLI 或營運者服務（D14 已確認） | `verifier/package.json`、`verifier/`、`offchain/history.ts`、`offchain/chain.ts` 的替代、`make check` 的 `dependency-cruiser` 規則 |

## 範圍

- 做：一款遊戲（D4）從建局、行動、逾時到結算的鏈上驗證；公開客戶端與 starter kit；索引器；verifier CLI；觀戰、回放、對局詳情與排名頁；對抗測試；testnet 上的完整營運流程。產品風險驗證（依 D1）。
- 不做：
  - 證明行動由指定模型或未修改的 Agent 產生（來源 A 明說鏈上做不到；R25）。
  - 收款、分潤、Token／NFT 作產品核心、獎金（來源 A 排除；R26）。
  - 即時遊戲（來源 A：「從一款簡單、非即時遊戲起步」）。
- 延後：
  - 公開發布、在社群招募玩家（R24）——觸發條件：Will 授權公開發布。
  - 第二款以上遊戲——觸發條件：第一款在 testnet 有至少一個非 Will 的玩家打完一場正式戰局，且 Will 決定加遊戲。
  - 賽季營運工具（若 D3 選「排行榜不分賽季」）——觸發條件：D3 改選賽季。
  - 防刷分的進階機制（D9 選最小方案時）——觸發條件：排名出現可疑的同源帳號群聚，或玩家數超過 Will 訂的門檻。
  - 外部安全審計——觸發條件：D8 選 mainnet 且合約會鎖住他人資金以外的價值；目前不鎖他人資金（無獎金），只鎖最低 ADA。

## 步驟

- [ ] **1. 產品風險驗證**（被擋於：無；不適用：D1 選 B）
  - 範圍：依 D1 的選項做最便宜的驗證（訪談、假門頁、或用既有框架手動辦一場鏈下比賽）。產出 `2026-10-01-agent-arena/validation-report.md`：問了誰、幾人、各風險（`nfr-and-risks.md` 的表）的證據與結論。不寫產品程式碼。
  - 消費端：無（產品 scaffold 未建）。
  - 不能動：全域約束的「不公開、不聯絡」——每次對外接觸都要先有 Will 的授權。
  - 驗收：報告的每個風險列都有「證據」與「結論」欄，`python3 check_plan.py --report validation-report.md` 檢查無空格；Will 依報告回覆是否繼續（寫進決定表 D1 的修訂）。
  - 停止條件：Will 沒有授權聯絡或公開時停下，回報可做的無接觸替代（例如只蒐集公開社群的討論量）。
  - 需要人做的事：授權聯絡使用者或公開假門頁；若要貼社群，用 Will 的帳號發。
  - 完成後的狀態：D1 選「先驗證再建」時，結論是否定就結束本計畫，延後項搬回主清單。

- [ ] **2. Spike：L1 每步上鏈的成本與延遲**（被擋於：無；已完成）
  - 範圍：拋棄式。寫一個最小的 Aiken validator：兩人在 5×5 格子各走一步、不可走到已佔格。在本機 devnet 量每筆行動交易的大小、execution units、手續費、狀態 UTxO 的最低鎖定 ADA；在 preprod 量 20 筆行動的入塊時間分布。產出 `2026-10-01-agent-arena/spike-l1.md`，附原始數字與重跑指令。同時記下同一個狀態 UTxO 被兩位玩家同時花用時的衝突行為（UTxO contention）。
  - 消費端：無（產品 scaffold 未建；spike 程式碼放 `2026-10-01-agent-arena/spikes/l1/`）。
  - 不能動：不做產品程式碼；不碰 mainnet。
  - 驗收：`spike-l1.md` 有每筆交易的 tx size、memory／steps、fee、入塊秒數表，且附可重跑的指令；在 devnet 送一筆非法行動（走到已佔格）被拒，把 validator 的佔格檢查拿掉後同一筆被接受（mutation）；兩方同時花用同一狀態 UTxO 時，失敗方的錯誤訊息、重試次數與總耗時有紀錄；每局鎖住的最低 ADA 有數字（D10 要用）。
  - 停止條件：本機 devnet 或 preprod 需要註冊或付費才能跑時停下，列出選項。
  - 需要人做的事：如需 preprod 測試幣而水龍頭要求登入或 API key，由 Will 取得；如用 Blockfrost 需 Will 註冊並把 key 存在本機（回覆 `done`，不貼值）。

- [ ] **3. Spike：替代的執行與結算方式**（被擋於：無；已完成）
  - 範圍：拋棄式，兩個子題各產出數字。(a) 在本機起兩個 hydra-node 開 head，把步驟 2 的 validator 放進 head 走 20 步再關 head，量 head 內每步延遲、開關 head 的 L1 費用、一方離線時關 head 的流程與時間。(b) 量「一筆交易驗證整局行動序列」的 script 預算：在 Aiken 測試裡驗證 N 步序列（含玩家簽章檢查），找出在 maxTxExecutionUnits 與 maxTxSize（transcript 加每步簽章）兩個上限內可驗證的最大 N，取較小者，並在 devnet 用真實交易驗證最終的 N（Aiken 測試的預算不含交易的額外開銷）。產出 `2026-10-01-agent-arena/spike-alternatives.md`。
  - 消費端：無（產品 scaffold 未建；程式碼放 `2026-10-01-agent-arena/spikes/alt/`）。
  - 不能動：同步驟 2。
  - 驗收：兩個子題各有數字表與重跑指令；(a) 附一方離線時的實測紀錄；(b) 附 N 與預算的曲線，並在序列中改一步為非法時驗證失敗（mutation）。
  - 停止條件：hydra-node 無法在本機無註冊下運行時，(a) 改為只整理文件事實並標「未實測」，回報。
  - 完成後的狀態：步驟 2、3 都完成後才交 D4、D5、D8。

- [ ] **4. Walking skeleton**（被擋於：無；P2、D1、D2、D5、D6 已決）
  - 範圍：在既有 repo 建產品 scaffold、CI（GitHub Actions）、驗收入口 `make check`。接通最薄的端到端路徑，遊戲可以是假的（例如「每人送一個數字，大者勝」）：兩個腳本 Agent 在本機 devnet 建局並各送一步 → validator 驗證 → 索引器記錄 → `verifier replay <match-id>` 從鏈資料重算結果 → 靜態頁顯示該局結果。TS 型別由 `plutus.json` blueprint 產生，CI 加產生物漂移檢查（I8）。執行形式固定為逐步 L1（D5）。
  - 消費端：`rg -n "MatchDatum|MatchRedeemer" validators/ offchain/ indexer/ verifier/ test/ -g '*.ak' -g '*.ts'`、`rg -n "verifier|replay|indexMatch|createWebServer" offchain/ indexer/ verifier/ web/ test/`。
  - 不能動：無（第一個產品步驟）。
  - 驗收：本機與 CI 的 `make check` 綠燈，CI 每個 job 自己的結論都是 success；端到端測試比對 verifier 重算結果與索引器記錄一致；mutation：讓 verifier 把勝負反過來，端到端測試要失敗。
  - 停止條件：devnet 無法在 CI 內啟動時停下，回報選項（改用 emulator 測 validator、devnet 測試改為本機必跑）。
  - 需要人做的事：GitHub repo 已建立；需要對外登入或下載時仍依 session 授權規則處理。
  - 完成後的狀態：計畫與附件已在 repo 的 `docs/plans/`；驗證後依授權建立初始 commit，步驟 2、3 的重跑指令從此有版本控制。

- [ ] **4.5a. Spike：鏈下 SDK、Ogmios client 與 devnet 工具選型**（被擋於：無；D13、D14、D15 已決）
  - 範圍：拋棄式，程式碼放 `2026-10-01-agent-arena/spikes/offchain/`，產出 `2026-10-01-agent-arena/spike-offchain.md`；ubuntu 上的測項用暫時分支上的一次性 workflow 跑，跑完刪分支。
    - SDK 候選：Lucid Evolution、Evolution SDK；兩者都不過關時才測 Blaze。採用版本須在 2026-10-18 前發布滿 14 天，編碼函式庫跟著該版本。每個候選做：
      - (1) devnet 與該 SDK 的 Emulator 各跑一次真實流程：在程式內產生短命金鑰並由 devnet 撥款 → 用 D15 的 multi-validator 鑄 thread token（policy 即 match script hash、token name 為 seed outref 的 hash；用 spike 內的拋棄式 Aiken validator）→ 輸出到 match script 並附 inline datum → 帶 redeemer、collateral 與 required signer 的 spend。
      - (2) 非法交易在建構時被本機評估擋下。
      - (3) 手動指定 execution units、跳過本機評估後強行送出一筆「phase-1 合法、phase-2 失敗」的交易：不是輪到的玩家把自己列為 required signer 並簽章。節點經 Ogmios submit 拒絕，錯誤屬 phase-2 類別，不是 `MissingVKeyWitnesses`。
      - (4) 建構未簽交易，交給外部簽章者（mock 的 CIP-30 `signTx(tx, partialSign)` 物件與本機金鑰檔各一）簽完再組合送出。
      - (5) 用 esbuild 把建構器打包成瀏覽器 bundle，建置成功。
      - (6) 能否從 `plutus.json`（CIP-57）產生型別化 schema；不能時記錄需要自寫產生器。
      - (7) 編碼模組（PlutusData 編解碼、blake2b）能否在不載入交易建構程式的情況下單獨 import：列出實際載入的模組與套件。
      - (8) provider 用 SDK 自己的 Ogmios＋Kupo 實作接 devnet，不需修補回應格式。
      - (9) 在乾淨目錄 `npm ls --all --omit=dev --parseable | wc -l` 的遞移依賴數。
    - Ogmios client：`@cardano-ogmios/client` 對 devnet 的 Ogmios 跑 `findIntersection`／`nextBlock`（含 rollback 事件）與 `submitTransaction`，大於 2^53 的整數不失真；記錄它支援的 Ogmios 版本。
    - devnet 工具：Yaci DevKit 在 macOS arm64 Docker Desktop 與 ubuntu-latest 各測一次，記錄：
      - 內附的 node、Ogmios、Kupo 版本。
      - Conway 時代 PlutusV3 可用。
      - 能否設定 slot 與 epoch 長度。
      - 從啟動到第一個 block 的秒數。
      - 怎麼為任意地址撥款。
      - 兩個實例能否以不同 port 並行，`down` 只影響自己。
      - Kupo 的 match、`--prune-utxo`、since 設定能否改成「全部、不 prune、從 origin」。
      - 是否需要註冊。
      - 官方文件來源與查詢日期補進 `external-interfaces.md`。
  - 消費端：無（拋棄式；結論依 D13 的選型規則落地）。
  - 不能動：產品程式碼；不碰 preprod、mainnet。
  - 驗收：`spike-offchain.md` 對每個候選與 devnet 工具，逐項列出通過或失敗、指令與原始輸出、套件版本與發布日期，最後依 D13 的規則寫出選定的 SDK、備案 SDK、devnet 工具。mutation：把 spike validator 的 token name 檢查拿掉後，用任意 token name 鑄造的交易要被接受（證明測項 (1) 的拒絕案例真的打到 policy）；測項 (3) 的交易改由輪到的玩家簽章時要被接受（證明拒絕來自 validator）。
  - 停止條件：所有 SDK 候選都無法完成測項 (1)–(4)，或 Yaci DevKit 與自建 compose 都無法在 ubuntu-latest 啟動時停下，回報選項。
  - 需要人做的事：無（下載屬 session 授權範圍）。

- [x] **4.5b. devnet 與程式內交易建構**（被擋於：步驟 4.5a；必須在同一批完成：換掉 devnet 後舊的 `cli()` 交易路徑就不能用）
  - 範圍：
    - devnet：依 D13 換掉 `scripts/devnet.ts` 的 `docker run`／`docker exec` 啟動，改用 Yaci DevKit 0.12.0 的 Docker image（`--entrypoint /app/yaci-cli … up --enable-kupomios`）起 node、Ogmios、Kupo；容器生命週期由 harness 自己管理，不用 Yaci 的 npm 啟動器（全域 PID 檔會殺掉別人的實例）也不用 `devkit.sh`。Kupo 設定為 match 全部、不 prune、從 origin（步驟 7 的完整歷史）。每次啟動用唯一的實例名與動態 port，`down` 只移除自己的實例。
    - 就緒條件：Ogmios `/health` 的 `connectionStatus` 為 `connected` 且 `lastKnownTip.height > 0`（Ogmios v7 的欄位，4.5a 實測），加上 Kupo `/health`（帶 `Accept: application/json`）的 `most_recent_checkpoint` ≥ Ogmios tip 的 slot。全部非同步並以 AbortSignal 設逾時，逾時錯誤帶最近的服務 log。
    - 交易：`offchain/tx-builder.ts` 改用 D13 選定的 SDK，建構、平衡、評估、簽章、送出、等確認都在程式內；provider 直接用 SDK 的 Ogmios＋Kupo 實作，不另包自訂介面。金鑰在程式內每次產生，由 Yaci 公開預設測試帳號在程式內轉帳撥款（topup REST 在 Docker 模式失敗；genesis UTxO 要從 Ogmios 讀，Kupo 不索引）。Blaze 對自訂網路要自己提供 slot config。
    - 選定 Yaci DevKit 時刪除 `infra/cardano-fixtures` 與 README 裡的 fixture 說明；選定自建 compose 時保留，並在 `infra/cardano-fixtures/README.md` 寫明用途。
    - 編碼：`offchain/codec.ts` 與 `offchain/generated/` 改成選定 SDK 的型別化 schema，不再輸出 cardano-cli 的 detailed JSON。4.5a 測項 (6) 通過就改用 SDK 的 CIP-57 產生方式並刪掉 `scripts/generate-blueprint.ts` 的自寫輸出；不通過就保留自寫產生器但改輸出 SDK schema。I8 的漂移檢查沿用。
    - 非法交易保留兩層：建構時被擋，以及 4.5a 測項 (3) 那種跳過本機評估後強行送出、以 phase-2 被拒。
    - `make devnet-up`／`make devnet-down`、`npm run devnet`、CI 的 image 拉取與 `timeout-minutes`、README 的 Development 段跟著改；CI 證據上傳改為 `if-no-files-found: error`。
  - 消費端：`rg -n "devnet\.ts|ROOT|startDevnet|stopDevnet|createMatch|SkeletonMatch|from ['\"].*(tx-builder|codec|generated)" -g '*.ts'`、`rg -n "devnet|credentials|cardano-fixtures|acceptance.json" Makefile .github/workflows/check.yml package.json README.md infra/`。
  - 不能動：validator 邏輯（D15 的 policy 改寫在 4.5c）；`make check` 入口；I6 的方向（簽章在呼叫端，不在 devnet 容器內）；步驟 4 的 E2E 驗收項（三種勝負、非法交易拒絕、獨立重播、結果頁、verifier mutation）。
  - 驗收：本機與 CI `make check` 綠燈；`rg -n "cardano-cli|docker\(['\"]exec|cli\(net" offchain/ scripts/ test/` 無輸出；E2E 的三個非法案例（錯簽、數字超界、錯結果）都同時驗建構被擋，以及強行送出後錯誤符合 phase-2 類別、不含 `MissingVKeyWitnesses`；兩個 devnet 實例並行時 `make check` 仍通過。mutation：把 validator 的簽章檢查拿掉重新 build，強行送出的錯簽測試要失敗；把就緒條件改成只看 HTTP 200，對剛啟動、尚無 block 的 devnet 跑就緒檢查的測試要失敗。
  - 停止條件：選定的 devnet 工具在 CI 內啟動失敗時，依 D13 改用自建 compose 並在進度表記錄，不停下；兩者都失敗時停下回報。SDK 無法表達 4.5a 已驗過的交易形狀時，依 D13 改用備案 SDK。

- [ ] **4.5c. verifier 獨立套件、官方 Ogmios client 與固定 thread policy**（被擋於：步驟 4.5b）
  - 範圍：
    - 依 D15 把 `thread.ak` 併進 `match.ak` 成為 multi-validator（`mint` 與 `spend` 兩個 handler），policy id 即 match script hash：
      - mint：token name 為 seed outref 的 blake2b-256，seed 由 redeemer 指定且必須被花用；每次只鑄一個；token 必須送到本 script 地址；初始 datum 必須合法（兩位玩家、空行動、`result` 為 -1、datum 的 token name 等於鑄出的 name）。
      - spend：輸入與輸出都持有本 policy、datum 指定 name 的 token；不再從 datum 讀 policy，也不寫死 `"arena"`。這樣鏈上就擋下偽造的建局（審查發現 G2）。
      - burn 仍屬步驟 6 的結算範圍（審查發現 G1：現行 policy 無法銷毀），本步不做；walking skeleton 的終局 UTxO 照 README 所述留在可拋棄的 devnet。
      - 刪除 `thread.ak`，重新產生 `plutus.json` 與型別，tx builder 跟著改。
    - `offchain/history.ts` 與 tx builder 移除 `aiken blueprint apply` 與所有 `child_process`：policy 等於 match hash，verifier 只算 token name 的 hash；`scriptAddress()` 改用 payment credential 比對，不再寫死 `addr_test` 與 header `70`。
    - 依 D14 把 `offchain/chain.ts` 換成 `@cardano-ogmios/client`，indexer 與 verifier 共用，整數不失真。
    - 把 verifier 拆成 npm workspace 套件，自己的 `package.json` 只列 I9 允許清單內的依賴；用 `dependency-cruiser` 規則禁止 `verifier/` 遞移 import 交易建構相關套件（`@lucid-evolution/lucid|cml|provider|wallet`、`@evolution-sdk/evolution` 的交易建構子路徑、`@blaze-cardano/sdk|tx|query|wallet|uplc|vm|emulator|blueprint`、`@meshsdk/*`）與 `node:child_process`；I9 允許的編碼函式庫是 `@blaze-cardano/data` 與 `@blaze-cardano/core`（4.5b 的 codec 已依賴），本步量它們遞移載入的 `@cardano-sdk/*` 與 `@sinclair/typebox` 是否含交易建構程式，含就改由 codec 自帶編碼，規則接進 `make check`。
  - 消費端：`rg -n "thread|6172656e61|TOKEN_NAME|arena|policy|addr_test|scriptAddress" validators/ offchain/ verifier/ indexer/ web/ test/ -g '*.ak' -g '*.ts'`、`rg -n "from ['\"].*(history|chain)" -g '*.ts'`、`rg -n "execFileSync|child_process" offchain/ verifier/ indexer/ test/`、`rg -n "\"workspaces\"|verifier" package.json`。
  - 不能動：I3、I5（版本鍵仍是 match validator 的 hash，現在也等於 policy id）、I8；verifier 的輸出格式與 E2E 的重播比對。
  - 驗收：`make check` 綠燈；`rg -n "child_process" offchain/ verifier/ indexer/` 無輸出；在乾淨暫存目錄只安裝 verifier 套件（`npm pack` 後安裝），對 devnet 戰局跑 `verifier replay` 成功；Aiken 測試涵蓋「token name 不等於 seed hash」「未花用 seed」「一次鑄兩個」「token 沒送到本 script」「初始 datum 非空盤」「spend 時 token 屬於別的 policy」六個拒絕案例；一筆含 2^53 以上 lovelace 的 Ogmios 回應 fixture 解碼後數值相等。mutation：在 `verifier/` 加一行 import 交易建構 SDK，`dependency-cruiser` 要失敗；把 mint 的 token name 檢查拿掉，「token name 不等於 seed hash」的 Aiken 測試要失敗；把 spend 的 policy 檢查拿掉，「別的 policy」測試要失敗。
  - 停止條件：官方 client 不支援選定 devnet 的 Ogmios 版本且無相容版本時停下，回到 D14。

- [ ] **4.5d. 測試分層與逾時觀測**（被擋於：步驟 4.5c）
  - 範圍：
    - 交易建構器的單元測試改在選定 SDK 的 Emulator 跑：建構邏輯、datum／redeemer 形狀、費用與找零，非法案例靠建構時的本機評估失敗。審查已指出 Lucid Emulator 送出時不跑 script，所以鏈上拒絕留在 devnet。
    - 現有斷言的去向：

      | 現有斷言（`test/devnet.e2e.ts`） | 去向 |
      |---|---|
      | 三種勝負的鏈上結果 | devnet |
      | 錯簽、數字超界、錯結果：建構時被擋 | Emulator |
      | 錯簽、數字超界、錯結果：強行送出以 phase-2 被拒 | devnet |
      | indexer 記錄與 verifier 獨立重播一致 | devnet |
      | 結果頁顯示 | devnet |
      | verifier 勝負反轉 mutation（現為改寫原始碼） | 改成竄改重播輸入 fixture，不改 repo 原始碼 |

    - 每次 devnet 呼叫記錄耗時，E2E 結束輸出各類呼叫的次數、最大與 p95 耗時。單次呼叫逾時上限 30 秒，與 Ogmios RPC 一致；逾時錯誤帶服務 log。
    - `make check` 加 Emulator 測試。
  - 消費端：`rg -n "test:e2e|npm test|--test|ARENA_TRACE" package.json Makefile .github/workflows/check.yml scripts/ test/`。
  - 不能動：步驟 4 的驗收項全部保留，依上表換執行層，不刪檢查。
  - 驗收：`make check` 綠燈並印出耗時摘要；Emulator 測試在停掉 Docker 時也能跑；上表每一列在測試裡都找得到對應斷言，`test/devnet.e2e.ts` 不再寫入 `verifier/`（`rg -n "writeFileSync.*verifier" test/` 無輸出）。mutation：在 tx builder 把 datum 的 `result` 寫成錯的勝者，Emulator 測試要失敗；把重播 fixture 的一步行動竄改，verifier 比對要失敗。
  - 停止條件：無特殊。
  - 完成後的狀態：10/01 的 CLI timeout 根因仍未證實；本批只移除那條機制並加上觀測，之後若在 Ogmios 或 Kupo 路徑重演，照耗時紀錄重開 bug-fix。

- [ ] **5. 規則引擎與共用測試向量**（被擋於：步驟 4）
  - 範圍：用 TypeScript 寫 D4 遊戲的純函式規則引擎（5×5 空格落子、兩人交替、橫直斜連四、滿盤和局、5 分鐘逾時）；建立 `test-vectors/*.json`（每個向量：初始狀態、行動序列、預期合法性與結果），寫一個產生器把向量轉成 Aiken 測試檔（`validators/tests/vectors.ak`，生成物不手改），讓步驟 6 的 validator 直接用同一組向量（I4）。本步只驗鏈下引擎與產生器；validator 那半在步驟 6。
  - 消費端：`rg -n "from ['\"].*rules" offchain/ web/ verifier/`（verifier、觀戰頁、回放頁、starter kit 的本地預覽）。
  - 不能動：步驟 4 的 `make check` 入口與既有端到端測試。
  - 驗收：`make check` 綠燈；向量涵蓋每條規則至少一個合法與一個非法案例（`check_plan.py` 不負責，這裡用 `make vectors-coverage` 列出每條規則的案例數）；產生器的輸出與 commit 的 `vectors.ak` 一致（漂移檢查）；mutation：在鏈下引擎放寬一條規則（例如允許走到已佔格），向量測試要失敗。
  - 停止條件：某條規則在 Aiken 內的成本超過步驟 2、3 量到的預算時停下回報，可能要回頭改 D4 的規則。

- [ ] **6. 切片：一場完整的正式戰局**（被擋於：步驟 5；步驟 4.5d）
  - 範圍：validator 實作公開建局、玩家自管簽章加入與行動、5 分鐘逾時判負、結算與 thread token 銷毀全流程；明定首步計時、未加入挑戰的取消與退款，以及有效期／datum 的 slot 一致性；鏈下 tx builder；兩個參考 Agent 在 devnet 打完一整局。規則版本對應 script hash（I5）。
  - 消費端：`rg -n "MatchDatum|MatchRedeemer|buildMoveTx|buildSettleTx" -g '*.ak' -g '*.ts'`（索引器、verifier、client、網站）。
  - 不能動：I1、I2、I4；共用測試向量只能新增，不改既有向量的預期（改了代表規則變了，回到 D4）。
  - 驗收：`make check` 綠燈；devnet 端到端：一局打完、結算交易被接受、verifier 重算一致；非法行動、逾時前搶判負、錯誤勝者的結算交易都被拒；`validators/tests/vectors.ak` 全部通過。mutation：在 validator 放寬步驟 5 那條規則，向量測試要失敗；分別拿掉合法性檢查、逾時檢查、勝者檢查，各自對應的拒絕測試要失敗。
  - 停止條件：同一狀態 UTxO 的併發衝突讓一局無法在合理時間內完成（門檻依 D4、D5 拍板的延遲上限）時停下回報。

- [ ] **7. 切片：獨立重播 verifier**（被擋於：步驟 6）
  - 範圍：`verifier replay`、`verifier check <match-id>`：從兩條獨立讀取路徑讀正式戰局（devnet：節點的 chain-sync 與 Kupo 類的 UTxO 索引，由步驟 4.5b 的 devnet 提供；preprod 另加一個公開 API；verifier 的依賴依 D14／I9）。重播已花用的 UTxO 需要完整鏈歷史，文件寫明要用不 prune 的索引，依 script hash 選規則版本重播，輸出逐步盤面與勝負，並與鏈上結算比對。發布為可單獨安裝的 CLI 與文件。
  - 消費端：`rg -n "verifier" web/ offchain/ docs/`（回放頁、排名重算、文件）。
  - 不能動：I3——verifier 不得讀營運者的索引器或資料庫。
  - 驗收：devnet 上步驟 6 產生的每一局 `verifier check` 都通過；devnet 上兩條讀取路徑結果一致；preprod 戰局（步驟 11 之後）再加公開 API 比對；mutation：在 fixture 裡竄改一步行動，`verifier check` 要回報不一致並以非零結束。
  - 停止條件：D5 選鏈下 transcript 而 transcript 的公開保存位置無法不經營運者取得時停下（違反 I3）。
  - 需要人做的事：preprod 比對若用 Blockfrost，Will 註冊並把 key 存本機，回覆 `done`。

- [ ] **8. 切片：玩家用自己的 Agent 參賽**（被擋於：步驟 6）
  - 範圍：依 D7 的接入方式交付公開客戶端與 starter kit（Agent 只需實作「給盤面、回行動」的介面）、登記頁、文件；鏈上登記須錢包授權，明定更新權、Agent 識別與更新順序；一位「外部」玩家（用另一台機器或乾淨環境模擬）照文件從零接入並打完一局。
  - 消費端：`rg -n "client|starter" docs/ web/` 與 starter kit 本身（它是對外 API，改動要更新文件與範例）。
  - 不能動：I6（除非 D7 改寫它）；步驟 6 的合約介面。
  - 驗收：乾淨環境照 README 接入的端到端腳本通過，紀錄所需時間；客戶端用錯誤金鑰簽的行動被拒；Agent 回傳非法行動時客戶端先擋下、強行送出時鏈上拒絕。mutation：把客戶端的本地合法性檢查拿掉，「先擋下」的測試要失敗，而鏈上拒絕測試仍通過。
  - 停止條件：接入需要外部帳號或付費服務時停下回報。

- [ ] **9. 切片：觀戰、回放與對局詳情**（被擋於：步驟 6；步驟 7）
  - 範圍：觀戰頁（以鏈上確認為準，標示「待確認」狀態）、回放頁（用規則引擎逐步重播）、對局詳情（每步 tx ID 與 verifier 結果，P7）；索引器的公開讀取 API。
  - 消費端：`rg -n "/api/" web/`（網站是索引器 API 的唯一前端消費端；starter kit 若讀它也列入）。
  - 不能動：I1——頁面顯示的勝負來自鏈上結算，不由前端計算。
  - 驗收：端到端瀏覽器測試（Playwright）在 devnet 跑一局，觀戰頁在每步確認後更新、回放逐步盤面與 verifier 輸出一致；mutation：把回放的步序打亂，比對測試要失敗。
  - 停止條件：無特殊。

- [ ] **10. 切片：排名**（被擋於：步驟 7）
  - 範圍：依規則版本分組的常駐 Elo 排名；每個 UTC 日、無序錢包配對及規則版本僅前 3 局計分，超額仍可回放；實作排名計算與頁面；`verifier rank` 從正式戰局重算整份排名（I7）。
  - 消費端：`rg -n "ranking|leaderboard|season" -g '*.ts' web/ verifier/`。
  - 不能動：I5（排名依規則版本分組）、I7。
  - 驗收：`verifier rank` 結果與網站排名逐列一致；兩者都對一份手算的 golden fixture（`test-fixtures/ranking-golden.json`，10 局以上）比對；mutation：在共用的 `ranking` 模組改 K 值或計分規則，golden 比對要失敗（兩邊共用模組，彼此比對抓不到）；刷分測試：同一人的兩個錢包互打 N 局，記錄排名變化，結果寫進驗收紀錄並對照 D9 的預期。
  - 停止條件：D9 的防刷分方案需要鏈下身分（例如 GitHub 登入）而 Will 沒有授權時停下。

- [ ] **11. 硬化**（被擋於：步驟 6–10）
  - 範圍：preprod 的 provider 接上：預設用 SDK 的 Koios 實作（免註冊），Will 註冊 Blockfrost 後可改用；對抗測試（double satisfaction、datum 偽造、逾時濫用、UTxO 搶占、超大 datum 讓對手交易超出上限）；非功能需求門檻（`nfr-and-risks.md`）的量測與監控指令；營運手冊（索引器重建、devnet／testnet 重置）；建部署腳本與 script hash 檢查，先部署到 preprod（步驟 12 沿用同一支腳本）。
  - 消費端：同步驟 6、7。
  - 不能動：I1–I7。
  - 驗收：每項攻擊一個 devnet 測試，被拒；mutation：拿掉對應檢查時該攻擊測試要失敗（逐項紀錄）；NFR 每項有量測值與門檻比較（每步延遲門檻來自 D5、每局成本上限來自 D8）；preprod 上連續跑 20 局無人工介入；另開一個 session 只照營運手冊從零重建索引器成功。
  - 停止條件：發現需要改 validator 介面的漏洞時停下，回到步驟 6 並在決定表記錄。
  - 需要人做的事：preprod 測試幣（水龍頭若需登入或 API key）。

- [ ] **12. 正式網路部署**（被擋於：步驟 11）
  - 範圍：用步驟 11 的部署腳本，在 preprod 部署最終版 validator（D8）、公布 script hash、規則版本、verifier 版本與重播文件；網站上線（是否公開依「延後」的公開發布觸發條件）。
  - 消費端：`rg -n "SCRIPT_HASH|NETWORK" -g '*.ts' -g '*.toml' -g '*.json'`。
  - 不能動：I2、I5——部署後不可改；部署前最後核對 script hash 與 repo 內編譯結果一致。
  - 驗收：鏈上 script hash 等於 `aiken build` 的輸出（指令附在 `scripts/deploy` 的檢查）；部署後打一局正式戰局並用 verifier（不經營運者資料來源）通過；mutation：在部署檢查裡用改過一個位元組的 script，檢查要失敗。
  - 停止條件：Will 未授權正式部署或公開發布時停下。
  - 需要人做的事：preprod 測試 ADA；如需網域與託管帳號，由 Will 處理。
  - 完成後的狀態：validator 不可修改（I5）；之後規則修正都是新版本。

- [ ] **13. 收尾**（被擋於：步驟 12）
  - 完成定義逐項核對；跑 design-review skill（獨立設計審查）；把長期守住不變量的檢查（差異測試、部署 hash 檢查、verifier 重播 devnet 戰局）確認接在 CI；延後項附觸發條件搬回主清單（屆時沒有主清單就搬進 repo 的 roadmap 或 Will 指定處）；需要人做的事列給 Will。
  - 驗收：`python3 check_plan.py` 無錯；CI 每個 job success；design-review 報告的每個發現都已處理或附駁回理由；`sed -n '/^## 本階段依賴的不變量/,/^## 範圍/p' docs/plans/2026-10-01-agent-arena.md | rg -c '^\| I.*預計'` 輸出 0（不變量表的資料列全部換成實際路徑）；D1 選 B 時步驟 1 的狀態是「不適用」並附 D1 的指向。

## 決定

Will 已於 2026-10-01 拍板下列結論；D1–D12 全部已決；選項保留作比較脈絡。

- **D1 是否先做產品風險驗證再建系統**（狀態：已決，2026-10-01，Will；擋住步驟：1–13（A 時 2 以後等步驟 1）；需要的事實：無）
  - A：先做最便宜的驗證（訪談、假門、手動辦鏈下比賽），有正面訊號才進步驟 2——成本最低，但需要 Will 授權聯絡人或公開，且延後技術產出。（建議：來源 A 傾向先找使用者，且目前沒有任何使用者證據。）
  - B：直接建，以技術展示價值（Aiken、交易建構、索引、verifier）為主要回報——不需對外授權，但可能做出沒人用的系統。
  - C：並行：先做技術 spike（步驟 2、3，各約數天），同時做驗證——兩邊事實同時到位，代價是 spike 可能白做。
  - 結論：B：直接建，以技術展示為主要回報；步驟 1 不適用；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D2 目標 repo**（狀態：已決，2026-10-01，Will；擋住步驟：4；需要的事實：無）
  - A：新的個人 repo（GitHub 帳號 `Will413028`），公開——verifier 與客戶端本來就要公開，技術展示可見。（建議）
  - B：新的個人 repo，先私有，步驟 12 前轉公開——開發期不曝光，但 I3 的「公開客戶端」要到那時才成立。
  - C：放進既有 monorepo——共用 CI，但與 Cardano 工具鏈無關的 repo 混在一起。
  - 結論：A：獨立公開 repo，目標 Will413028/cardano-agent-arena；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D3 參賽者與排名範圍**（來源不一致：A 寫「開發者」「賽季排名」，B 寫「玩家」「排行榜」）（狀態：已決，2026-10-01，Will；擋住步驟：8、10；需要的事實：步驟 1 若有做，參考其結論）
  - A：參賽者是開發者（帶程式 Agent），排名分賽季——賽季讓新玩家有機會、對應規則改版（I5），但有賽季營運成本（S10）。
  - B：參賽者是開發者，單一常駐排行榜（依規則版本分組）——營運最省；舊高分壓住新人。（建議：先 B，賽季列在延後。）
  - C：參賽者含人類玩家（手動下棋）——擴大受眾，但偏離「Agent 對戰」且需要人用的介面。
  - 結論：B：開發者帶 Agent，常駐排行榜依規則版本分組；賽季延後；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D4 第一款遊戲**（含人數、輪流或同時行動、逾時規則）（狀態：已決，2026-10-01，Will；擋住步驟：5、6；需要的事實：步驟 2、3）
  - A：兩人輪流搶格子（完全資訊，無需隱藏行動）——合約最簡單、每步一筆交易就能驗；策略深度有限。
  - B：多人資源爭奪（同時行動）——更有戰略性，但同時行動需要 commit-reveal（每步兩筆交易，延遲與費用加倍）或 Hydra。
  - C：重複的合作與背叛（兩人、同時行動）——規則最短、題材適合 Agent 研究，同樣需要 commit-reveal。
  - 逾時（各選項共用）：超過 N 個 slot 未行動判負，任何人可送判負交易（建議）／營運者送（違反 I2，不建議）。
  - 建議：A，等步驟 2 的成本確認後再拍；若步驟 3 顯示 Hydra 或整局驗證可行，C 的成本下降，可重新比較。
  - 結論：A：兩人輪流、完全資訊、佔空格；5×5 棋盤，橫直斜連四獲勝，滿盤無勝者和局；每步逾時 5 分鐘，自前一個有效行動的 slot 起算，任何人可送逾時判負交易；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D5 執行與結算方式**（來源 A：「實際執行與結算方式尚未決定」）（狀態：已決，2026-10-01，Will；擋住步驟：4、6、7；需要的事實：步驟 2、3）
  - A：每步一筆 L1 交易，validator 逐步驗證——最直接、完全符合 I3；每步約 20 秒以上、每步一筆手續費，同一狀態 UTxO 有併發衝突。
  - B：Hydra head 內逐步、結算上 L1——head 內快且可零手續費；所有參賽者要跑 hydra-node 並在線（P6），提高接入門檻；head 內的逐步紀錄要另外公開保存才符合 I3。
  - C：鏈下執行、每步由玩家簽章，整局 transcript 提交上鏈，validator 一次驗證；樂觀提交＋挑戰期是另一安全模型——費用最低；受單筆交易預算限制（步驟 3b 的 N），完整終態、拒簽與退出仍須設計；樂觀方案另需挑戰機制。transcript 要放在鏈上 datum／metadata 才符合 I3。
  - D：鏈下執行，只把結果與 transcript hash 上鏈——最便宜，但合約沒有驗證行動，不符合來源 A／B 的「合約驗證合法行動及勝負」，列出只作光譜對照。
  - 每步延遲上限：120 秒（送出至首次入塊）；連續 20 步全部符合。
  - 建議：等步驟 2、3 的數字；若每局成本在 D8 的上限內，傾向 A（最簡單且最直接證明來源的主張）。
  - 結論：A：每步一筆 L1 交易，validator 逐步驗證；連續樣本 20 步，從送出到首次入塊每筆均 ≤120 秒；這是驗收門檻，不是網路保證或最終性；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D6 技術用的 state token 是否允許**（狀態：已決，2026-10-01，Will；擋住步驟：4、6；需要的事實：無）
  - 背景：Cardano 上確保「這個 UTxO 就是這一局」的常見做法是鑄一個不可轉讓、局結束即銷毀的 thread token。來源 A 排除「Token／NFT 作為產品核心」，沒說技術用途。
  - A：允許，玩家看不到、不可交易、結束即銷毀——標準做法，validator 簡單。（建議）
  - B：不用任何 token，以 script 參數與 datum 內的局 ID 加檢查確保唯一——避開疑慮，但 validator 更複雜、較容易出現偽造狀態 UTxO 的漏洞；若局 ID 做成 script 參數，每局 script hash 都不同，要改寫 I5 的版本鍵。
  - 結論：A：允許技術用途 state token，只供識別戰局，結束時銷毀；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D7 Agent 接入方式與金鑰**（狀態：已決，2026-10-01，Will；擋住步驟：6（validator 檢查誰的簽章）、8，可能改寫 I6；需要的事實：D5 的結論）
  - A：玩家自己的客戶端讀鏈狀態、自己簽送交易（Asteria 模式）——完全符合「其他客戶端參賽」與 I6；接入門檻較高。
  - B：營運者的 runner 呼叫玩家的 HTTP endpoint（ArenaBot 模式），代為簽送——接入最容易；營運者持有簽章金鑰，等於可代替玩家行動，削弱 I2 與 I6。
  - C：A 為正式路徑，另提供玩家自己執行的 runner（開源、本機執行，Agent 只要實作 HTTP endpoint）——兼顧容易與自管金鑰。（建議）
  - 結論：自管客戶端＋官方開源本機 runner；玩家私鑰留在玩家端，Agent 實作讀盤面與回傳行動；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D8 正式戰局的網路、手續費承擔與每局成本上限**（狀態：已決，2026-10-01，Will；擋住步驟：12；需要的事實：步驟 2、3）
  - A：只在 preprod 測試網營運——不需 mainnet ADA；仍有 tADA fee 與操作成本；「正式戰局」的可信度較弱（測試網可能重置），技術展示足夠。
  - B：mainnet，玩家自付手續費——最可信；每位玩家都要持有 ADA，接入門檻高；不屬於收款。
  - C：mainnet，營運者補貼手續費（例如代付交易費）——接入容易，Will 承擔持續成本，且代付設計需確認不違反 I2。
  - 每局成本上限：10 tADA（最長正常 25 步，含建局、行動、結算 fee；可退還的最低 ADA 另列）。
  - 建議：A 起步，延後 mainnet 到有外部玩家之後；但這是成本與可信度的取捨，由 Will 決定。
  - 結論：A：正式戰局僅在 preprod，使用測試 ADA；最長正常 25 步對局的建局、行動與結算總 fee ≤10 tADA，不含可退還的最低鎖定 ADA；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D9 排名演算法與防刷分**（狀態：已決，2026-10-01，Will；擋住步驟：10，可能改寫 I7；需要的事實：步驟 1 若有做）
  - 演算法：勝場數（簡單、最易刷）／Elo（業界常用、單一數值）／Glicko-2 或 TrueSkill（考慮不確定度、多人）。建議 Elo 起步，因為兩人遊戲且最容易讓 verifier 重算。
  - 防刷分：A 不設防，頁面明示「排名不保證沒有刷分」（S6）——零成本；B 只計算不同對手的戰局、限制同對手局數——鏈上可驗、可重算；C 登記時綁外部帳號（GitHub）——較難開分身，但引入營運者可審核的鏈下身分，削弱 I7 的「任何人可重算」。建議 A＋B。
  - 結論：Elo；限制同對手計分局數。以 UTC 日、無序錢包配對與規則版本計算，每日前 3 局影響 Elo；超額對局仍可打與回放，但不計分；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D10 營運者權限**（狀態：已決，2026-10-01，Will；擋住步驟：6、12，可能改寫 I2；需要的事實：無）
  - A：完全沒有管理金鑰；卡住的對局只靠逾時規則解決——完全符合來源 A 的「沒有營運者繞過驗證的權限」；部署後發現的 bug 只能以新版本修，舊局無法救，卡住的局鎖住的最低 ADA（步驟 2 量每局金額）可能永久取不回。（建議）
  - B：有限的緊急暫停鍵（只能停止新建局，不能改既有戰局或結果）——可止血；需要公開說明權限範圍，且「有管理金鑰」本身會被質疑。
  - 結論：A：完全沒有管理金鑰，戰局只靠公開規則與逾時機制處理；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D11 誰建局、怎麼配對**（狀態：已決，2026-10-01，Will；擋住步驟：6，可能影響 I2 與 D9；需要的事實：無）
  - A：任何人都能建公開挑戰局，其他人自行加入——不需營運者，符合 I2；容易自建自打刷分（D9 的 B 方案可部分緩解）。（建議）
  - B：營運者排程配對（例如每天依排名配對）——比賽品質與防刷分較好；營運者能決定誰跟誰打，需要公開配對規則，且營運者停擺就沒有比賽。
  - C：A＋B，排名只計 B 的局——兼顧，但兩套流程。
  - 結論：A：任何人可建公開挑戰局，其他人自行加入；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D12 登記資料存在哪裡**（Agent 名稱、說明、對應錢包）（狀態：已決，2026-10-01，Will；擋住步驟：8，可能影響 I7；需要的事實：無）
  - A：鏈上（登記交易的 datum 或 metadata）——任何人可重算排名與顯示名稱，符合 I7；改名要再送交易、資料永久公開。（建議）
  - B：營運者的資料庫——改起來容易；名稱與歸屬顯示需信任營運者，Elo 仍可依鏈上錢包與結果重算。
  - 結論：A：Agent 名稱、說明與對應錢包存鏈上，只登記適合公開的資料；ADR：[拍板紀錄](2026-10-01-agent-arena/decision-draft.md)。

- **D13 鏈下交易建構與本機 devnet**（狀態：已決，2026-10-18，Will；擋住步驟：4.5a–4.5d、6、8；需要的事實：步驟 4.5a 的 SDK 與 devnet 實測）
  - A：維持 `docker exec` 進 devnet node 容器跑 cardano-cli 建構、簽章、送出：這是現況。`transaction build` 要 node socket，玩家端不會有 preprod node；瀏覽器只能用 CIP-30。步驟 8 一定要換。10/01 的 60 秒 timeout 就卡在這條路上。
  - B：程式內 TypeScript SDK（Lucid Evolution、Evolution SDK、Blaze、Mesh）經 provider 建構、評估、簽章、送出：這是業界基線。代價是 SDK 為 0.x、發版頻繁。
  - devnet 的選項：自建 `docker run`＋`docker exec` 輪詢（現況）／自建 compose（node＋Ogmios＋Kupo、健康就緒）／Yaci DevKit（內建 Ogmios、Kupo、相容 Blockfrost 的 Yaci Store 與 CIP-30 錢包，由 4.5a 查證）。
  - 建議：B，加 Yaci DevKit 與健康就緒；先做步驟 4.5a 的 spike 再定 SDK。
  - 結論：B＋Yaci DevKit。步驟 4.5a 的實測結果：三個 SDK 都沒有 (1)–(8) 全過，規則選不出贏家，Will 在 2026-10-18 看過比較表後選 **Blaze 0.3.1**（整套版本鎖定），備案 Evolution SDK 0.5.16；devnet 為 Yaci DevKit 0.12.0 的 Docker image；證據在 `2026-10-01-agent-arena/spike-offchain.md`。原先的選型規則保留如下：
    - SDK：取 4.5a 測項 (1)–(8) 全部通過、採用版本發布滿 14 天者；都通過時取測項 (9) 依賴數較少者；排名第二的通過者為備案。
    - devnet：取 Yaci DevKit，條件是在 macOS arm64 與 ubuntu-latest 都能啟動、Conway 時代可跑 PlutusV3、能為任意地址撥款、兩個實例可並行且 `down` 只影響自己、Kupo 可設為全部／不 prune／從 origin、免註冊。任一不成立就改用自建 compose（node＋Ogmios＋Kupo，版本鎖定），不停下。
    - 理由與取捨見 ADR `docs/adr/2026-10-18-in-process-offchain-and-devnet.md`。

- **D14 verifier 的依賴範圍**（狀態：已決，2026-10-18，Will；擋住步驟：4.5c、7，新增 I9；需要的事實：步驟 4.5a 測項 (7) 與 Ogmios client 實測）
  - A：verifier 與交易建構共用同一個 SDK：程式最少，但「可獨立驗證」的審查範圍包含整個 SDK。
  - B：verifier 是獨立套件，只依賴允許清單（規則引擎、blueprint 編碼、編碼函式庫的子路徑、官方 `@cardano-ogmios/client`）：有 schema 型別、整數不失真、由官方維護；官方 client 帶約 10 個遞移依賴（ws、cross-fetch、json-bigint 等，2026-10-18 `npm view` 查到）。
  - C：同 B，但 Ogmios 讀取維持自寫 client（Node 原生 WebSocket、零依賴）：審查範圍最小；協定實作與整數解析要自己維護。
  - 建議：最初建議 B 時，理由寫成「審查範圍較小」，這個前提是錯的；更正後改建議 C。
  - 結論：B。Will 在 2026-10-18 看過「官方 client 帶 10 個依賴、自寫的零依賴」這個取捨後，選官方 client。邊界改用允許清單、獨立 workspace 套件與 `dependency-cruiser` 規則守住（I9）。

- **D15 thread token 的形式**（狀態：已決，2026-10-18，Will；擋住步驟：4.5a、4.5c、6；需要的事實：無）
  - A：以 seed UTxO 為參數的 one-shot policy（Aiken 範例做法、現況）：每局 policy hash 不同，建局與 verifier 都要做 UPLC 參數套用。現行版本還有兩個缺口：沒有 burn 分支；`match.ak` 只信任 datum 宣告的 policy，鏈上可偽造建局。
  - B：獨立的固定 policy，token name 為 seed outref 的 hash，match 以參數綁定這個 policy：policy 改版與規則版本分開，但兩支 script 要互相綁定。
  - C：multi-validator，mint 與 spend 同一個 script，policy id 等於 match hash，token name 為 seed outref 的 hash，mint 時驗初始 datum 與去向（[Aiken common design patterns](https://aiken-lang.org/fundamentals/common-design-patterns)）：只有一個版本鍵，鏈上直接擋下偽造建局；代價是 mint 邏輯改版也會換掉規則版本。
  - 建議：C（兩份獨立 ADR 草稿也都選 C）。
  - 結論：C。Will 在 2026-10-18 選了「固定 policy、token name 為 seed hash」，C 是它在業界基線下的形式。在步驟 4.5c 改 walking skeleton，burn 在步驟 6；不影響 D6，I5 的文字已同步。

拍板順序：
1. 現在可拍：P2（是否進入開發）→ D1 → D2、D3、D6、D10、D11、D12（彼此獨立）。
2. 步驟 2、3 完成後：D5 → D4（D4 的同時行動選項依 D5 的成本）→ D7（依 D5）→ D8。
3. D9 在 D3 之後，步驟 10 開工前。
拍板後，有真正替代方案的決定（預計 D1、D5、D7、D8、D10，可合成一份）依 decision-log skill 寫 ADR；專案頁已存在，ADR 正式落點為該頁的 decisions/；ADR 已歸檔，附件 decision-draft.md 僅保留本機導向。

## 進度

狀態值：未開始／進行中／程式完成待驗收／完成／不適用（附指向的決定）。

| 步驟 | 狀態 | 已跑的驗收 | 未跑的驗收與原因 | commit |
|---|---|---|---|---|
| 1 產品風險驗證 | 不適用（D1 選 B） | | 不適用 | |
| 2 Spike：L1 成本與延遲 | 完成 | devnet 合法／非法與 mutation、UTxO contention、雙玩家簽章與 state token、最低 ADA；preprod 20 筆入塊與索引延遲，全部驗證為有效 script spend；見 spike-l1.md | 無（只完成 spike 的驗收，不代表正式產品） | |
| 3 Spike：替代執行方式 | 完成 | Hydra 20 步 confirmed snapshots、L1 開關與 deposit 成本、Bob 離線 Close/Fanout；簽章 transcript 曲線與最大 N=84 的 devnet 真實交易、合法／非法與 source mutation；19 Aiken checks；見 spike-alternatives.md | 無（N=84 只適用本 fixture 與 devnet 14M memory，不是 preprod 上限） | |
| 4 Walking skeleton | 完成 | `48aa0be` 的 CI `make check` 全部通過（run `36868324868`，walking-skeleton job success）：Aiken 4 checks、blueprint 漂移、TS、unit 2 tests、三種勝負、非法交易拒絕、獨立重播、結果頁與 verifier mutation；超時清理修正 `85c7830` 的 CI run `36870994814` 全部 success。2026-10-18 本機（Docker Desktop 29.1.3、linux/arm64 image、8 CPU）在 `858e125` 跑完整 `make check` exit 0，另跑 3 次 `test:e2e` 與 1 次 8 核 CPU 滿載下的 `test:e2e` 皆通過，單次 docker 呼叫最長 894ms | 無。2026-10-01 本機 query tip／transaction build 的 60 秒 timeout 未能重現，根因未證實；當時的 Docker 執行環境已無法核對，CPU 滿載已排除 | `7d750cf`、`48aa0be`、`85c7830` |
| 4.5a Spike：SDK、Ogmios client、devnet 選型 | 完成 | 三個 SDK 各 9 項（含 mint mutation，mutant 重建後重跑）、官方 Ogmios client 對 devnet 的 chain-sync 與 bigint、Yaci DevKit 在 macOS arm64 與 ubuntu-latest（CI run `39090704534`、`39090888319`）的並行與健康檢查；見 spike-offchain.md | 瀏覽器 bundle 只在 Node 裡載入過，沒有在真的瀏覽器跑；devnet 單一出塊者，真正的 rollback 沒測到 | |
| 4.5b devnet 與程式內交易建構 | 完成 | `2fef09d` 的 CI `make check` success（run `39102747529`）。2026-10-18 本機（load 80–150）：改動前基線 `make check` exit 0；改動後 `make check` 兩個同時並行皆 exit 0（各自的 Yaci 容器）；三個非法案例建構時 Ogmios 3010、強行送出 3136，無 `MissingVKeyWitnesses`；mutation：拿掉簽章檢查後錯簽測試在建構層失敗，再略過建構層則在強行送出層失敗；就緒改成只看 HTTP 200 後就緒單元測試 2/3 失敗；`rg -n "cardano-cli\|docker\(['\"]exec\|cli\(net" offchain/ scripts/ test/` 無輸出 | 就緒 mutation 用 stub 回應：Yaci 0.12.0 的 Ogmios 實測要到已有 block 才連得上，「200 但無 block」在真實 devnet 觀察不到 | `2fef09d`、`6cc13ad` |
| 4.5c verifier 套件、Ogmios client、固定 policy | 未開始 | | 步驟 4.5b | |
| 4.5d 測試分層與逾時觀測 | 未開始 | | 步驟 4.5c | |
| 5 規則引擎與測試向量 | 未開始 | | 尚未開工 | |
| 6 完整正式戰局 | 未開始 | | 步驟 5、4.5d | |
| 7 Verifier | 未開始 | | 步驟 6 | |
| 8 自帶 Agent 參賽 | 未開始 | | 步驟 6 | |
| 9 觀戰、回放、詳情 | 未開始 | | 步驟 6、7 | |
| 10 排名 | 未開始 | | 步驟 7 | |
| 11 硬化 | 未開始 | | 步驟 6–10 | |
| 12 正式網路部署 | 未開始 | | 步驟 11 | |
| 13 收尾 | 未開始 | | 步驟 12 | |

## 壓力測試紀錄

2026-10-01，一個沒參與撰寫的唯讀 subagent 用 `reference/reviewer-prompt.md` 原文審查（前面加了派工邊界與盲測限制）。結果是 13 個發現：高 3、中 8、低 2。12 個照改，1 個部分駁回。

| 發現 | 處理 |
|---|---|
| F1 高：步驟 5 要求 validator 的向量測試失敗，但 validator 到步驟 6 才實作；Aiken 也讀不到 JSON | 已改。步驟 5 加產生器，把向量轉成 `vectors.ak`，只驗鏈下引擎。validator 那一半的測試與 mutation 移到步驟 6 |
| F2 高：步驟 7 的兩個來源在 devnet 上跑不了，用公開 API 又要註冊 | 已改。devnet 改用兩條本機讀取路徑。公開 API 的比對移到 preprod，補上「需要人做的事」。另外寫明索引不能 prune |
| F3 高：步驟 10 的 mutation 抓不到問題，因為 verifier 和網站共用同一個排名模組 | 已改。兩邊都改成對 golden fixture 比對 |
| F4 中：D7 會決定 validator 檢查誰的簽章，卻沒有擋住步驟 6 | 已改。D7 擋住步驟 6，進度表也更新 |
| F5 中：D6 選 B 會改寫 I5；I5 沒寫清楚版本鍵是哪一個 hash | 已改 |
| F6 中：缺少 datum／redeemer 編碼契約的不變量 | 已改。新增 I8（以 blueprint 為唯一來源），步驟 4 加漂移檢查 |
| F7 中：步驟 3 依賴步驟 2 卻沒標出；只量 execution units，沒量交易大小 | 已改 |
| F8 中：步驟 2 的驗收漏了 UTxO 爭用 | 已改。順便加上每局鎖住的最低 ADA |
| F9 中：步驟 11 用 testnet，部署腳本卻到步驟 12 才建；延遲門檻沒有任何一題決定負責；營運手冊沒有驗收 | 已改。部署腳本與 preprod 部署前移到步驟 11；D5 加延遲上限；營運手冊加重建驗收；補上 tADA 的人工項 |
| F10 中：D1 的分支沒有落到步驟上 | 已改。進度表加「不適用」狀態，步驟 4 寫明 D1 選 A 或 C 時要等哪個結論 |
| F11 中：步驟 1 報告的檢查太鬆 | 已改。`check_plan.py --report` 會核對報告涵蓋每個風險，並用一份缺列的報告驗證它會失敗 |
| F12 中：缺配對與登記兩題決定 | 已改。新增 D11、D12，需求 R5、R15 也改指向它們 |
| F13 低：步驟 13 的 `rg` 會誤中別段；spike 產物沒有版本控制 | `rg` 已改成只查不變量表那一段。產物原先延後到步驟 4。已修正前提：repo 已存在，產物就在目標 checkout；初始版本已於 `7d750cf` commit／push |
| 低：D10 選 A 時卡住的局鎖住的 ADA 沒估金額 | 已改。D10 的 A 註明金額，由步驟 2 量 |

修改後重跑 `python3 2026-10-01-agent-arena/check_plan.py`，結果是 `steps=13 decisions=12 errors=0`。檢查器本身也跑過 mutation：拿掉一個停止條件、把需求指到不存在的步驟、報告缺風險列，三種情況都會報錯。

### 2026-10-18：步驟 4.5 與 D13–D15

兩個沒參與撰寫的唯讀 subagent 分頭審查：一個是計畫審查者（`reference/reviewer-prompt.md` 原文），一個是設計審查者（design-review skill 的提示詞原文）。計畫審查 17 個發現（高 2），設計審查 12 個發現。兩題交給 Will 決定（D14 的 Ogmios client、D15），其餘照改；無駁回。

| 發現 | 處理 |
|---|---|
| 高：4.5b 要求刪掉 `cli()`，但 tx builder 到 4.5c 前都還依賴它 | 已改。devnet 與交易建構合併成 4.5b，標「必須在同一批完成」 |
| 高：簽章 mutation 會被 phase-1（缺見證）擋下，打不到 validator | 已改。強行送出的錯簽案例改成「非輪到的玩家把自己列為 signer 並簽章」，並斷言錯誤屬 phase-2、不含 `MissingVKeyWitnesses` |
| D13、D14 引用的 ADR 不存在 | 已改。ADR `docs/adr/2026-10-18-in-process-offchain-and-devnet.md` 與本次修訂一起提交 |
| I9 用「SDK」劃界，無法機械判定，又和 codec 跟隨 SDK 衝突 | 已改。I9 改為允許清單；verifier 拆成獨立 workspace 套件，加 `dependency-cruiser` 規則；4.5a 加測項 (7)（編碼能否單獨 import） |
| 換成官方 Ogmios client 的理由「審查範圍較小」與事實相反 | 交給 Will：選官方 client（D14 結論更新），4.5a 加 client 實測 |
| 參數化 thread policy 讓 verifier 必須做 UPLC 參數套用 | 交給 Will：選固定 policy（新增 D15），在 4.5c 實作 |
| `offchain/generated` 輸出 cardano-cli 的 JSON 形狀，移除 CLI 後就失去理由 | 已改。4.5b 改成 SDK 的型別化 schema；4.5a 加測項 (6)（CIP-57 產生） |
| 選型沒有瀏覽器／CIP-30／外部簽章 | 已改。4.5a 加測項 (4)、(5)，D13 選型規則納入 |
| Yaci 的資金、金鑰、genesis、並行隔離、Kupo prune 設定都沒寫 | 已改。4.5a 加測項；4.5b 寫明短命金鑰、撥款、唯一實例與動態 port、Kupo 設定、fixture 的去留 |
| Kupo 就緒「正常」無法判定 | 已改。改成 checkpoint slot ≥ Ogmios tip slot |
| 自訂 `ChainProvider` 是多餘的轉接層；preprod provider 沒有歸屬步驟 | 已改。直接用 SDK provider；步驟 11 接 Koios（Blockfrost 為 Will 註冊後的選項） |
| 4.5e 的 mutation 指向不存在的「回合數」欄位 | 已改。改成 `result` 寫錯 |
| 4.5c、4.5e 對 E2E 內容互相矛盾 | 已改。4.5d 附現有斷言的去向表 |
| E2E 的 verifier mutation 直接改寫 repo 原始碼，與平行 session 衝突 | 已改。改成竄改重播輸入 fixture |
| 消費端漏了 `generate-blueprint.ts` 的 `ROOT`、README、CI 證據路徑 | 已改。消費端搜尋擴大；證據上傳改為 `if-no-files-found: error` |
| D13 寫「不再回頭問」，停止條件卻寫「停下」；備案 SDK 未定義；依賴數沒說怎麼量 | 已改。devnet 失敗自動改用 compose；備案為排名第二的通過者；依賴數用 `npm ls --all --omit=dev --parseable \| wc -l` |
| codec 版本與 14 天規則 | 已改。編碼函式庫跟著採用版本 |
| Yaci 的事實沒有來源 | 已改。由 4.5a 查證並補進 `external-interfaces.md` |
| 步驟 13 的 `rg -c '預計'` 永遠不會是 0 | 已改。只比對表格資料列 |
| 4.5e 的逾時上限沒有數值 | 已改。30 秒，與 Ogmios RPC 一致 |

修改後重跑 `python3 2026-10-01-agent-arena/check_plan.py`，結果是 `steps=17 decisions=15 errors=0`。步驟編號的正則改成接受 `4.5a` 這種子步驟；mutation 驗證過：拿掉 4.5a 的停止條件、改掉進度表的 4.5d，兩種情況都會報錯。

依 decision-log skill 的規定，這個決策反轉成本高，所以另派兩個沒參與的 subagent 各自起草 ADR，選項不預設。兩份草稿和我的草稿的差異與處理：

| 草稿提出的論點 | 處理 |
|---|---|
| 兩份都選 multi-validator（policy id 等於 match hash），並指出現行 policy 無法 burn（G1）、鏈上可偽造建局（G2） | 採用。D15 改為 C；4.5c 補 mint 的去向與初始 datum 檢查、spend 的 policy 檢查；burn 留在步驟 6 |
| 草稿一不選 Yaci：自建 node＋Ogmios 已在 CI 量測過，只差加一個 Kupo | 駁回。「已量測」是既有程式碼帶來的 SELF-IMPOSED 理由，不是外部約束；D13 已寫明 Yaci 任一條件不成立就自動改用自建 compose，這個論點由選型規則處理 |
| `scriptAddress()` 寫死 `addr_test` 與 header `70` | 採用。併入 4.5c |
| verifier 在 preprod 不能每次從 origin 全量 chain-sync | 採用。寫進 ADR 的 Followup，歸步驟 7 |
| 反方論點：multi-validator 讓建局邏輯的改版也切開 Elo 分組 | 記入 ADR 的代價，以及「一個月內改版超過一次就重評」的觸發條件 |

### 2026-10-18：步驟 4.5b 開工的設計審查

一個沒參與實作的唯讀 subagent 用 design-review skill 的提示詞原文審查 4.5b 的設計與作者的沿用盤點表。結果是 10 個發現：改 6、記 2、提 1、駁回 1。

| 發現 | 處理 |
|---|---|
| ADR 的預期成果寫「`scripts/`、`test/` 沒有任何 `child_process`」，但 4.5b 驗收的 rg 只禁 `cardano-cli`／`docker exec`，harness 仍要起容器、E2E 仍要開獨立行程重播 | 提。Will 2026-10-18 選修正 ADR：子程序只禁於 `offchain/` 與 `verifier/`；harness 的 docker CLI 改成非同步 `execFile` 加 AbortSignal |
| 當機或被殺時會留下整套 Yaci 的孤兒容器 | 記。E2E 攔 SIGINT／SIGTERM 時移除自己的容器（實測中斷後無殘留）；SIGKILL 仍會殘留，README 寫明依 label 清除的指令。觸發條件：本機累積殘留成為常態時改用 reaper |
| `.local/devnet-session.json` 是全域單檔，連續兩次 `devnet-up` 會讓第一個實例變孤兒 | 改。`devnet-up` 遇到既有 session 就拒絕啟動；手動 session 一個 checkout 一個，並行實例只屬於測試 |
| `Devnet.directory` 與 `ROOT` 是 cardano-cli bind mount 時代的殘留，產生器因 `ROOT` 依賴 harness | 改。harness 只回傳容器名與 Ogmios／Kupo endpoint；證據目錄由 E2E 管理；產生器自己算路徑 |
| builder 收 devnet 控制代碼並在內部簽章；collateral 預切、點號 unit 是 cardano-cli 的形狀 | 改。builder 收 provider 與 `Wallet`，回傳未簽交易；簽章送出在呼叫端（I6、CIP-30 同形）；collateral 交給 Blaze 選 |
| 4.5b 在 4.5c 就要丟掉的參數化 policy 上寫 builder，且經 `aiken blueprint apply` 子程序 | 改一半。參數套用改用 Blaze 的程式內 `applyParams`，builder 不再有子程序；E2E 證明它和 verifier 用 aiken 算出的 policy hash 一致。validator 改寫仍留在 4.5c（分段是自己訂的，但拋棄的只剩約 5 行） |
| epoch 邊界的協定參數變動可能打斷 E2E | 記。實測 Yaci Docker 模式 epoch 600 slot（1 秒／slot），啟動時沒有待生效的治理提案，到 slot 355 cost model 未變；E2E 約 1 分鐘。觸發條件：E2E 接近 10 分鐘或換 Yaci 版本時重量 |
| faucet 照搬 spike 的手寫 Ogmios JSON-RPC 與 3997 重試 | 改。改用 provider 既有的 `Unwrapped.Ogmios.queryLedgerStateUtxo`，不帶重試 |
| `Kupmios.awaitTransactionConfirmation` 不等價於 Kupo 輪詢 | 改。讀碼確認它的判斷式用逗號運算子、輪詢間隔 20 秒；改為直接輪詢 Kupo `/matches/*@<txid>`，30 秒逾時 |
| 保留自寫產生器與 spike「(6) 經 bundler 通過」的判讀不一致 | 駁回。Blaze 產生器的輸出 import `@blaze-cardano/tx` 與 `uplc`，codec 由 verifier 共用，I9 不允許 verifier 載入交易建構程式；自寫產生器只輸出 `@blaze-cardano/data` 的 schema。`data` 多帶的 `@sinclair/typebox` 是否在允許清單內，留到 4.5c 量 |

4.5b 收尾時再派一個沒參與的審查者看整份 diff：8 個發現，改 1、記 6、駁回 1。

| 發現 | 處理 |
|---|---|
| 4.5c 的禁止清單寫 `@blaze-cardano/*`，和 I9 允許的編碼函式庫、4.5b 的 codec 衝突 | 改。4.5c 禁止清單改列交易建構子套件，並在 4.5c 量 `data`／`core` 的遞移依賴 |
| `signSubmit` 自己輪詢 Kupo、綁 Kupmios 的 `kupoUrl` | 記。觸發條件：出現第二個 provider（步驟 8 或 11）或 upstream 修好 `awaitTransactionConfirmation` 時，改回 `Provider` 介面或覆寫該方法 |
| 每位玩家仍撥兩筆（100＋10 ADA），是預切 collateral 的殘留形狀 | 記。Blaze 可能用同一筆當 collateral，未實測；4.5d 搬到 Emulator 時以一筆驗證，通過就改 |
| 計畫要求的 slot config 沒做 | 記。目前交易沒有有效期，用不到；觸發條件：步驟 6 開始設 validity interval 時由呼叫端提供（從 Ogmios genesis 讀） |
| `verifier/.mutant-*.ts` 被 SIGKILL 時會殘留，4.5c 要把 `verifier/` 打包 | 記。4.5c 驗收的 `npm pack` 前確認無 `.mutant-*`；4.5d 改成竄改 fixture 後此副本消失 |
| CI 只用 tag 鎖 Yaci image | 記。交給 quality-baseline 的供應鏈強化改用 digest |
| SDK 缺陷的繞法（`void kill()`、自寫 Kupo 輪詢、180 秒 watchdog）沒寫移除條件 | 記。觸發條件：`@blaze-cardano/ogmios` 或 `query` 升版時重驗並移除；watchdog 在 4.5d 換成單次 30 秒、可取消的請求逾時 |
| faucet 手寫 vkey witness 重做了錢包的簽章 | 駁回。`HotSingleWallet` 只收 normal key，faucet 是 BIP32 衍生的 extended key |
