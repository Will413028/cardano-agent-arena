# L1 spike：量測結果與適用界線

## 範圍與限制

2026-10-01，在 macOS arm64 的 Docker devnet 實測。這是最小 5×5 佔格與狀態延續 validator，未實作玩家身分簽章、thread token、建局與結算。交易以官方公開 faucet 測試金鑰簽署。數字不能直接當成正式產品每局成本，也不能以 devnet 延遲代替 preprod。

## 環境與來源

- Aiken v1.1.24+bacbeb3；stdlib v4.0.0。
- @lucid-evolution/lucid 0.6.5，已安裝；本次交易由 cardano-cli 建構。
- Cardano node image：11.1.2，內附 CLI 11.2.3.0。
- Hydra 官方範例 commit：`0c395c2b795053db2f5881d949ab05fefcac9f95`。
- [官方 devnet 操作說明](https://hydra.family/head-protocol/docs/getting-started)。

## 合法行動的完整交易

| 行動 | bytes | memory | steps | fee (lovelace) | 送出至首次觀察到 UTxO (s) |
|---|---|---|---|---|---|
| 0 | 1006 | 64566 | 26287646 | 214286 Lovelace | 0.230 |
| 1 | 1009 | 70024 | 28021525 | 214858 Lovelace | 0.272 |

原始交易資訊與 tx ID：`spikes/l1/measurements.json`。最低 ADA：空棋盤 datum、無 thread token 的輸出為 **909410 lovelace**（CLI calculate-min-required-utxo）；實測鎖定 3000000 lovelace。此值不是最終戰局所需金額。

## 非法行動與 mutation

- 相同格子走兩次：節點 transaction build 的腳本評估拒絕，見 `spikes/l1/l1-illegal.log`。未提交 invalid transaction，避免消耗 collateral。
- 移除 `!list.has(board.occupied, cell)` 後：`occupied_cell_rejected` 測試失敗；同樣的重複佔格序列能建立、提交並入塊。見 `mutation-check.log`、`mutation-run.log`。
- mutation 後原始 source 已恢復，重新 build 成功；再跑合法交易成功。

## UTxO contention

兩筆交易使用不同的 funding inputs，同時花用相同狀態 UTxO。一方成功，另一方遭 `BadInputsUTxO` 拒絕；重新讀取勝方狀態、重建交易並重試一次後成功。總耗時約 0.920 秒；錯誤全文與原始 inputs 在 `spikes/l1/contention.json`。這是兩個並行提交程序，不是已驗證的雙玩家身分模型。

## 重跑

工具版本鎖在 package-lock.json 與 aiken.lock。從 `spikes/alt/hydra/demo` 執行官方 `prepare-devnet.sh`（會清除該範例的既有 devnet，重跑前先確認資料可丟棄），再用 `docker compose -p arena-spike -f docker-compose.yaml up -d cardano-node` 啟動。

在 `spikes/l1/l1-validator` 用 `../node_modules/.bin/aiken check` 與 `build`；回到 `spikes/l1` 執行 `python3 run.py` 產生交易與數據，再執行 `python3 contention.py`。非法序列使用 `ARENA_DUPLICATE=1 python3 run.py`，預期非零退出。mutation 重跑需暫時移除上述佔格檢查、build，再跑非法序列，最後恢復與 rebuild。

## 雙玩家簽章與 one-shot state token

使用 `authenticated.ak`：datum 記錄 Alice、Bob 的 payment key hash 與 thread policy，validator 檢查目前玩家的 extra signatory，以及輸入／輸出都保留唯一 token。minting policy 綁定被消耗的 seed input、固定 asset name 與數量 1。這是成本 fixture，未實作結算、burn 與正式建局安全邊界。

| 玩家 | bytes | memory | steps | fee (lovelace) |
|---|---|---|---|---|
| alice | 1681 | 142643 | 50151968 | 254656 Lovelace |
| bob | 1682 | 155663 | 55483571 | 255836 Lovelace |

這個 datum 與 token 輸出的最低 ADA 為 **1495570 lovelace**；測試實際鎖定 3000000 lovelace。Bob 的回合若宣告 Alice 為 required signer，節點拒絕；原始紀錄在 `wrong-player.log`。重跑：`python3 authenticated.py`。

## preprod 20 筆行動

水龍頭入帳：`9ade405286789263acf1bd313d20952a54aad2bbc548a85be5099a22ebba6792`，10000000000 lovelace（10000 tADA）。使用新建的本機 signing key；不使用官方公開金鑰接收測試網資金。

此處使用 `latency.ak` 的最小佔格規則，20 步後允許收尾以取回鎖定測試幣。**測量的是送出至 Koios 索引器首次確認，包含網路與索引延遲，不能等同精確入塊延遲或不可回滾時間**。原始資料另附鏈上 block timestamp；本輪未保存每筆送出的絕對 timestamp，因此不能從它回推純入塊秒數。

| 行動 | bytes | memory | steps | fee (lovelace) | 至索引確認 (s) |
|---|---|---|---|---|---|
| move-0 | 1064 | 65668 | 26592028 | 208080 | 28.105 |
| move-1 | 1065 | 71126 | 28325907 | 208564 | 21.586 |
| move-2 | 1066 | 76584 | 30059786 | 209048 | 26.415 |
| move-3 | 1067 | 82042 | 31793665 | 209532 | 5.950 |
| move-4 | 1068 | 87500 | 33527544 | 210016 | 11.368 |
| move-5 | 1069 | 92958 | 35261423 | 210500 | 21.858 |
| move-6 | 1070 | 98416 | 36995302 | 210983 | 11.799 |
| move-7 | 1071 | 103874 | 38729181 | 211467 | 6.256 |
| move-8 | 1072 | 109332 | 40463060 | 211951 | 36.732 |
| move-9 | 1073 | 114790 | 42196939 | 212435 | 42.421 |
| move-10 | 1074 | 120248 | 43930818 | 212919 | 49.482 |
| move-11 | 1075 | 125706 | 45664697 | 213403 | 44.294 |
| move-12 | 1076 | 131164 | 47398576 | 213887 | 6.119 |
| move-13 | 1077 | 136622 | 49132455 | 214371 | 6.100 |
| move-14 | 1078 | 142080 | 50866334 | 214855 | 38.162 |
| move-15 | 1079 | 147538 | 52600213 | 215339 | 6.134 |
| move-16 | 1081 | 152996 | 54334092 | 215867 | 11.399 |
| move-17 | 1082 | 158454 | 56067971 | 216351 | 11.707 |
| move-18 | 1083 | 163912 | 57801850 | 216835 | 23.034 |
| move-19 | 1084 | 169370 | 59535729 | 217319 | 6.987 |

20 筆：median 16.692s、nearest-rank p95 44.294s、最大 49.482s。收尾交易：`2bbc0df01651a799b37e7b0525f40078eff565b2a9bbd2ddb80458553069a3aa`，已確認。

SDK Koios provider 的 `tx_info` schema 與實際資料不相容。spike 將空 inline datum 正規化，必要時由 Plutus JSON 重建 datum CBOR、將字串 asset_list 轉為陣列；改從 address UTxO 查戰局狀態、從 tx_status 判斷確認，未偽造 script 資料。重跑入口：`node preprod.mjs`；程式尚使用本輪建局 checkpoint，新一輪需新建局與新的紀錄檔，不可重用已花用的 state input。

## 精確補測：保存送出時間與鏈上 block timestamp

另跑一輪完整 20 筆行動，保存 `submitted_at_ms`、`observed_at_ms` 與 Koios 鏈上 `tx_timestamp`。所有 20 筆的 plutus_contracts 都標示 valid_contract=true、redeemer purpose=spend，確認不是只有向 script address 付款。入塊延遲以 block timestamp 減去送出 HTTP request 前的本機時間；block timestamp 只有整秒精度，另受本機與鏈上時間差影響。這是首次入塊，不代表最終性。

| 行動 | bytes | memory | steps | fee (lovelace) | 至入塊 (s) | 至索引確認 (s) |
|---|---|---|---|---|---|---|
| move-0 | 1064 | 65668 | 26592028 | 208080 | 35.585 | 36.502 |
| move-1 | 1065 | 71126 | 28325907 | 208564 | 25.422 | 29.539 |
| move-2 | 1066 | 76584 | 30059786 | 209048 | 46.088 | 48.453 |
| move-3 | 1067 | 82042 | 31793665 | 209532 | 18.986 | 21.313 |
| move-4 | 1068 | 87500 | 33527544 | 210016 | 47.113 | 54.309 |
| move-5 | 1069 | 92958 | 35261423 | 210500 | 31.474 | 32.272 |
| move-6 | 1070 | 98416 | 36995302 | 210983 | 6.606 | 12.238 |
| move-7 | 1071 | 103874 | 38729181 | 211467 | 6.133 | 11.197 |
| move-8 | 1072 | 109332 | 40463060 | 211951 | 29.357 | 31.760 |
| move-9 | 1073 | 114790 | 42196939 | 212435 | 22.373 | 23.044 |
| move-10 | 1074 | 120248 | 43930818 | 212919 | 24.190 | 26.964 |
| move-11 | 1075 | 125706 | 45664697 | 213403 | 38.836 | 41.056 |
| move-12 | 1076 | 131164 | 47398576 | 213887 | 25.461 | 26.323 |
| move-13 | 1077 | 136622 | 49132455 | 214371 | 33.205 | 37.248 |
| move-14 | 1078 | 142080 | 50866334 | 214855 | 14.077 | 16.353 |
| move-15 | 1079 | 147538 | 52600213 | 215339 | 6.908 | 12.063 |
| move-16 | 1081 | 152996 | 54334092 | 215867 | 8.625 | 11.600 |
| move-17 | 1082 | 158454 | 56067971 | 216351 | 12.069 | 17.433 |
| move-18 | 1083 | 163912 | 57801850 | 216835 | 29.082 | 32.178 |
| move-19 | 1084 | 169370 | 59535729 | 217319 | 105.181 | 108.313 |

入塊：median **25.441s**、nearest-rank p95 **47.113s**、max **105.181s**。

索引確認：median **28.252s**、nearest-rank p95 **54.309s**、max **108.313s**。

原始送出紀錄：`preprod-precise.json`；鏈上 raw data：`preprod-precise-chain-data.json`；合併欄位：`preprod-precise-enriched.json`。補測收尾交易：`621429a07b4bfa50f409f93b67098dc12c24b0db6d6e676e7bd9bfe7661c290f`，已確認。

`preprod.mjs` 現在可在新紀錄檔不存在時建立新局；已完成 close 的紀錄會直接退出。重跑新一輪需指定新的紀錄檔名稱，避免覆蓋證據。私鑰只讀本機 ignored devnet 目錄；不輸出值。

## 尚未驗收／不涵蓋

- 正式遊戲的完整建局、勝負、逾時與 state token burn。
- mainnet、正式安全參數與獨立安全審查。

## 測試幣歸還與本機收尾

剩餘 **9990.579795 tADA** 已送回 Will 提供的 Preprod faucet address，交易 `367a9d84e397c31c2cccc9727eff8284bbc2aa9757a0f570bbb3b69e68578786` 已確認；手續費 170737 lovelace。詳細資料：`spikes/l1/faucet-return.json`。本機 Alice、Bob Hydra nodes 與 Cardano devnet containers 已停止；保留原始資料與可重跑程式碼，未 commit／push。
