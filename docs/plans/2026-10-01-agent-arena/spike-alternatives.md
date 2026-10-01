# 替代執行方式 spike：Hydra 與簽章 transcript

## 界線

全部在本機 devnet，不是 mainnet 或正式產品。未實作勝負結算、完整建局安全、防惡意提交舊 prefix 的挑戰機制或 transcript 公開保存。這些資料用來選 D5，不能宣稱整個替代架構已可上線。

## A. 兩個 Hydra nodes

Hydra 2.4.1，Cardano node 11.1.2；官方來源與快照在 `spike-l1.md`。以 `spikes/alt/compose.json` 啟動 Alice、Bob；`--advertise alice:5001`／`bob:5001` 避免 Docker 的 listen 0.0.0.0 造成 cluster ID mismatch。ledger params 將 fee 與 execution prices 設為零，其他上限沿用 devnet；這只是 head 的測試設定。

兩個 nodes 開 head，Alice-funds 從 L1 deposit 100 tADA。最小 L1 validator 原樣在 head 驗證 20 個合法行動。透過 `/transaction` 提交，再輪詢 `/snapshot/utxo` 確認已在雙方簽署的 confirmed snapshot 中；HTTP 回應 `SubmitTxSubmitted` 本身不算完成。

20 步：median **0.344s**、nearest-rank p95 **1.363s**、最大 **2.099s**。此延遲含本機 Docker、HTTP 與輪詢開銷，不是公網數字。

| 步 | 至 confirmed snapshot (s) |
|---|---|
| 0 | 0.369 |
| 1 | 0.139 |
| 2 | 0.067 |
| 3 | 0.131 |
| 4 | 0.269 |
| 5 | 0.432 |
| 6 | 0.175 |
| 7 | 0.055 |
| 8 | 0.491 |
| 9 | 0.202 |
| 10 | 0.263 |
| 11 | 0.526 |
| 12 | 0.319 |
| 13 | 0.300 |
| 14 | 0.400 |
| 15 | 0.670 |
| 16 | 2.099 |
| 17 | 0.988 |
| 18 | 1.363 |
| 19 | 0.633 |

Bob container 停止後，Alice 用最後已確認的 snapshot 執行 Close → 等待 ReadyToFanout → Fanout。3.478s 觀察到 HeadIsClosed、6.878s ReadyToFanout、9.252s HeadIsFinalized。contestation period 為 **3 秒的本機測試參數**，不能用它決定 preprod／mainnet 安全參數。原始紀錄 `spikes/l1/hydra-close.json`。

L1 成本從 Alice fuel wallet 與 script value 的守恆量測（tADA）：

| 階段 | lovelace |
|---|---|
| Init | 518266 |
| Deposit | 183321 |
| Close | 676477 |
| Fanout | 1250127 |
| 合計 | 2628191 |

包含 deposit 的這輪 head 生命週期消耗 **2.628191 tADA**。script 初始鎖定 2538590 lovelace，fanout 後已釋放，不能把它算作 fee。Alice fuel 初始 109745344、最終 107117153 lovelace；Bob fuel 未參與支付。此合計不包含一次性 reference scripts publish、預先轉入測試資金或產品 state token mint 的費用。來源 tx ID 在 `hydra-costs.json`；測試曾先跑一輪只量到 API 接收時間，該輪數據未納入延遲表，但兩輪共用同一 head，所以同一次開關成本涵蓋兩轮測試。

Hydra 2.4.1 已採 Init 直接開空 head，再動態 deposit 的流程；舊的「先兩方 commit 再開 head」流程不適用於本輪版本。前提 P6 的持續在線限制適用於 head 內進展，已確認 snapshot 可在另一方離線時關閉，不是要求離線方配合關閉。

重跑順序：官方 prepare-devnet → 本機 node → `hydra-node publish-scripts`（紀錄 script tx IDs）→ 更新 compose 的 script IDs → 啟動兩 nodes → WebSocket Init → `python3 hydra-deposit.py` → `python3 hydra-moves.py` → 停止 Bob → `node hydra-close.mjs`。reference IDs、已花用的 inputs 與持久化 head 狀態不可跨新 devnet 重用。

## B. 單筆交易驗證簽章行動序列

`transcript_rules.ak` 檢查輪流的玩家 Ed25519 簽章、非負 cell ID、不得重複佔格。簽章訊息包含 match ID、step、cell。`transcript.ak` 在 ledger 中驗證整個 redeemer 序列。

這是預算 benchmark：25 步是 5×5 棋盤可用的具體序列；大於 25 的點故意擴展 cell ID 以量長序列，**不是擴大 D4 的遊戲規則**。唯一性檢查為 list 掃描，預算隨長度增加；N 是這份 fixture 的上限，不是所有演算法／遊戲的普遍上限。它沒有判定正式遊戲勝負或強制 payout。

Aiken 測試（含簽章）的曲線：

| N | memory | CPU steps |
|---|---|---|
| 1 | 32604 | 68644635 |
| 2 | 65274 | 138047356 |
| 4 | 136736 | 278677350 |
| 8 | 317220 | 571060534 |
| 16 | 828428 | 1200319686 |
| 25 | 1641348 | 1978682816 |
| 32 | 2451804 | 2636923790 |
| 64 | 8102396 | 6222245870 |
| 96 | 16958108 | 10756747342 |
| 128 | 29018940 | 16240428206 |
| 160 | 44284892 | 22673288462 |
| 192 | 62755964 | 30055328110 |
| 208 | 73193420 | 34102290206 |
| 224 | 84432156 | 38386547150 |

真實 devnet 交易（包含交易上下文、transcript 與每步簽章）：

| N | bytes | memory | steps | fee (lovelace) |
|---|---|---|---|---|
| 1 | 1067 | 59725 | 77256086 | 220366 Lovelace |
| 2 | 1140 | 99545 | 148993154 | 231048 Lovelace |
| 4 | 1282 | 185507 | 294323842 | 252734 Lovelace |
| 8 | 1566 | 394991 | 596108414 | 299076 Lovelace |
| 16 | 2134 | 964199 | 1244170342 | 403636 Lovelace |
| 25 | 2774 | 1842469 | 2043702595 | 540119 Lovelace |
| 32 | 3278 | 2703575 | 2718379998 | 660625 Lovelace |
| 64 | 5586 | 8586167 | 6378913182 | 1365527 Lovelace |
| 65 | 5658 | 8820109 | 6508137115 | 1391510 Lovelace |
| 81 | 6810 | 13013405 | 8709176907 | 1842847 Lovelace |
| 83 | 6954 | 13593907 | 9000991675 | 1903717 Lovelace |
| 84 | 7026 | 13890387 | 9148751582 | 1934646 Lovelace |

用 binary search 找到 devnet 最大 **N=84**；N+1 的 ledger script 評估失敗。N=84 的真實交易已提交並入塊：`f42e3561b2b27ba7304178502691df796d38c04a786cea10471929f95997355f`。本機上限為 memory **14000000**、steps **10000000000**、size **16384 bytes**；N=84 memory 13890387、steps 9148751582、size 7026 bytes，因此這輪先受 execution budget 限制。

preprod 查得 memory **17500000**、steps **10000000000**、size **16384 bytes**。未在 preprod 找極限 N，也未證明兩個環境的 cost models 完全相同；不能把 84 標為 preprod 或 mainnet 上限。25 步在 devnet 使用 1842469 memory、2043702595 steps、2774 bytes、540119 lovelace，留有很大的預算空間，但完整產品邏輯需重新量測。

Mutation：移除 transcript 的重複佔格檢查時，`correctly_signed_duplicate_rejected` 測試失敗；已恢復原始 source 並 build。另把第二步改成重複的 cell 0，並重新用正確玩家簽章（因此拒絕不是單純壞簽章），devnet script 評估失敗。原始 rejected row 在 `transcript-measurements.json`。19 個 Aiken checks 通過；`signed-fixtures.mjs` 可重建公開 fixture，不輸出 private keys。

重跑：`node signed-fixtures.mjs` → 在 l1-validator 跑 Aiken check/build → `python3 transcript.py`。交易 evaluator 每個測點都使用同一個未花用的 script UTxO，最後才提交最大 N，避免把已花用狀態當成預算失敗。測點失敗錯誤全文另附原始 JSON。

## 尚未涵蓋

- Hydra 公網延遲、正式 contestation period 與惡意離線場景。
- 全局驗證的正式勝負、逾時、舊 prefix／對手拒絕簽章處理與終態資金去向。
- Hydra transcript 的公開可取得性、D5 C transcript 公開編碼與規則版本契約。
- 整局驗證的 preprod 上限 N。
