# 外部介面、既有先例

查詢日期：2026-10-01（web search；未登入、未註冊、未呼叫付費 API）。會變動的參數各附重查方法。

## 外部介面

| 介面 | 內容與限制 | 費用 | 來源 | 重查方法 |
|---|---|---|---|---|
| Cardano L1 手續費 | `fee = minFeeA × txSize + minFeeB`；minFeeA 44 lovelace/byte，minFeeB 155,381 lovelace；Plutus 另計 priceSteps 0.0000721、priceMemory 0.0577 lovelace/單位 | 以 1 KB 的非腳本交易估約 0.2 ADA；帶 validator 的交易**未量測**，由步驟 2 量 | [Cardano protocol parameters reference guide](https://docs.cardano.org/about-cardano/explore-more/parameter-guide) | `cardano-cli conway query protocol-parameters`（本機節點或 devnet），或 Blockfrost `/epochs/latest/parameters` |
| Cardano L1 上限 | maxTxSize 16,384 bytes；maxTxExecutionUnits memory 17,500,000（steps 上限未在本次查到，步驟 2 用 devnet 的 protocol-parameters 讀實值） | — | 同上；[Intersect：smart contract capacity increases](https://intersectmbo.org/news/lowering-minpoolcost-and-completing-smart-contract-capacity-increases) | 同上 |
| Cardano L1 時間 | slot 1 秒、active slot coefficient 0.05，平均約 20 秒一個區塊；交易通常約 20 秒入塊，實務上的「難以回滾」需數分鐘，依 Ouroboros 設計的最終性約一天 | — | [Time handling on Cardano](https://docs.cardano.org/about-cardano/explore-more/time)；[Wikipedia：Cardano](https://en.wikipedia.org/wiki/Cardano_(blockchain_platform)) | 步驟 2 在 preprod 實測入塊時間 |
| UTxO 鎖定的最低 ADA | 每個帶 datum 的狀態 UTxO 需鎖最低 ADA，結束後可取回；數值依 datum 大小 | 鎖定、不消耗 | 參數表同上（coinsPerUTxOByte） | 同上 |
| Hydra Head | 少數參與者之間的鏈下 state channel，同構於 L1（同樣的 validator 可在 head 內跑）；所有參與者都要執行 hydra-node 並保持在線，有人不配合時要上 L1 關閉 head；官方範例有兩人猜拳遊戲 | head 內交易可設零手續費；開關 head 要 L1 交易 | [Hydra（docs.cardano.org）](https://docs.cardano.org/developer-resources/scalability-solutions/hydra)；[Hydra protocol overview](https://hydra.family/head-protocol/docs/protocol-overview)；[Open a head on testnet](https://hydra.family/head-protocol/docs/tutorial) | 步驟 3 在本機 devnet 實測 |
| Aiken | 以 validator 判斷交易是否符合規則；有本機 `aiken check` 測試與 property test | 開源 | [Aiken validators](https://aiken-lang.org/language-tour/validators) | — |
| Blockfrost（鏈資料 API，選用） | 免費方案每日 50,000 次請求、每秒 10 次（可突發 500）；需要註冊取得 project key | 免費方案；超量付費 | [Blockfrost Start Building](https://blockfrost.dev/start-building)；[developers.cardano.org：Blockfrost](https://developers.cardano.org/docs/developers/curriculum/production/api-providers/blockfrost/) | 官網 pricing 頁 |
| 本機 devnet、自建索引（Ogmios／Kupo、Yaci DevKit 等） | 不需註冊；可讀實際 protocol parameters | 免費 | 未在本次逐一查證官方文件；步驟 2 開工時查並補來源 | — |
| 測試網水龍頭（preprod tADA） | 取得測試幣，可能需 captcha 或 API key | 免費 | 未查證；步驟 2 開工時查 | — |

## 既有先例

| 先例 | 證明了什麼 | 不證明什麼 | 來源 |
|---|---|---|---|
| ScreepsPlus BotArena | 「程式控制策略遊戲的定期競賽」已有參與場景 | 不證明玩家需要 Cardano 版本或可驗證戰局 | [screepspl.us/events](https://screepspl.us/events/)（來源 A 所列） |
| ArenaBot | Agent 提供 HTTP endpoint、接收狀態回傳行動的接入流程可行 | 網站存在不等於持續採用 | [arenabot.io](https://arenabot.io/)（來源 A 所列） |
| Asteria by TxPipe | Cardano 上以 UTxO 與 validator 約束 bot 移動的遊戲可行；玩家自己送交易（自帶客戶端）；有 starter kit；移動速度由 space-time validator 依 slot 限制 | 用燃料 Token 與獎勵，不符合「Token／NFT 不作核心」；不證明本題的成本或留存；也不能宣稱 Cardano bot 遊戲沒人做過 | [Asteria](https://asteria.txpipe.io/)；[txpipe/asteria-starter-kit](https://github.com/txpipe/asteria-starter-kit)；[Catalyst 提案](https://projectcatalyst.io/funds/11/cardano-open-developers/asteria-by-txpipe-a-bot-challenge-to-showcase-the-capabilities-of-the-utxo-model) |
| Hydra 猜拳範例 | 兩人遊戲可在 Hydra head 內以 validator 進行 | 不證明多人、Agent 不在線時的可用性 | [Hydra（docs.cardano.org）](https://docs.cardano.org/developer-resources/scalability-solutions/hydra) |
| Aiken validators | 技術原理 | 未驗證本題的合約、成本或完整可行性 | [Aiken validators](https://aiken-lang.org/language-tour/validators) |
