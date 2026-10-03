---
title: 以逐步 L1 與玩家自管金鑰建立可驗證 Agent 競技場
date: 2026-10-01
status: active
tags: [cardano-agent-arena, decision, architecture]
---

# 以逐步 L1 與玩家自管金鑰建立可驗證 Agent 競技場

## Context

這是尚無產品 scaffold 或需求驗證的 greenfield 專案。Will 選擇先取得 Aiken、交易建構、索引與 verifier 的技術展示成果。Spike 僅提供候選架構的量測，不等於正式遊戲安全或成本已驗收。

- `external` 使用者授權邊界：本次未授權公開發布產品、聯絡玩家或 mainnet 交易；公開 repo 與產品發布分開處理。
- `inherited` 合約驗證合法行動與勝負、公開資料可獨立重播：仍成立，因為這是技術展示的核心回報。
- `inherited` 不以收款、分潤、Token／NFT、下注或獎金為核心：仍成立，技術 state token 不產生產品權益。
- `inherited` 行動紀錄不證明指定模型或程式來源：仍成立，不把交易簽章解讀為 Agent 身分證明。
- 現有 spike 與工具鏈不是不可推翻的架構限制；Aiken／TypeScript 是計畫的可推翻預設。

## Options Considered

**定位與範圍**

- 先驗證需求：少花工程時間，但需對外接觸授權，延後技術產出。
- 技術展示先行（選用）：不依賴需求成立即可取得工程成果；驗證與 spike 並行則增加切換成本。
- 公開獨立 repo（選用）／先私有／monorepo：展示可見性、開發曝光與共用工具的取捨。
- 常駐版本分組排名（選用）／賽季／人類玩家：前者營運較少，後兩者擴大新玩家機會或受眾，但增加流程。

**執行、資料與控制權**

- 基準：Cardano EUTxO 狀態由 validator 檢查、one-shot token 識別；[Aiken 官方文件](https://aiken-lang.org/language-tour/validators) 說明 spend／mint 與唯一 seed input。沒有既有程式需保留。
- 每步 L1（選用）：公開進度、原生逾時與分歧處理直接；逐步付費與等待。
- Hydra：head 內快，增加節點、在線協作與逐步歷史公開保存的工作；已量測離線 Close/Fanout。
- 全簽章 transcript 一次驗證：25 步 devnet fixture 為 2,774 bytes、0.540119 tADA；費用低，完整終態、舊 prefix、拒簽與退出仍須設計。
- Optimistic settlement：另有挑戰、監看與資料可取得性需求，不等同完整 transcript 驗證。
- 結果 hash：便宜，但 commitment 本身不驗證行動與勝負，不能滿足選題目標。
- 無 token：省去 mint／burn，但要另證明唯一建局與 successor；每局 script 參數也增加版本識別工作。
- 無管理鍵＋公開挑戰（選用）／有限暫停新局／營運者配對：參賽自主性與事故處理、配對控制的取捨。
- 鏈上 profile（選用）／公開可驗簽鏈下 profile／營運者資料庫：公開取得、更新成本與顯示可信度的取捨；名稱位置不決定 Elo 能否重算。

**接入、網路與遊戲**

- 基準：玩家自管 client 簽章；[CIP-30](https://cips.cardano.org/cip/CIP-0030) 提供瀏覽器錢包交易簽章介面，不等於無人值守 runner 的金鑰方案。
- 自管 client＋開源本機 runner（選用）：降低 Agent 介面工作；代管 runner 容易接入，但取得代玩家行動的權力。
- 玩家簽章＋relay／代付：不必取得玩家金鑰，但增加提交、付款與 censorship 的設計。
- preprod（選用）／mainnet 玩家付費／mainnet 代付：展示足夠、真實網路持續性與接入／持續成本的取捨。
- 完全資訊輪流落子（選用）／同時資源爭奪／合作背叛：前者交易流程簡單；同時行動另需隱藏行動與公平揭露。
- 勝場數／Elo（選用）／Glicko-2 或 TrueSkill：計算簡單、單一分數與不確定度模型的取捨。
- 不限同對手／限制計分局數（選用）／外部帳號綁定：可重算的最小限制與較強身分依賴的取捨。

## Decision

- D1：直接建，以技術展示為回報；需求驗證步驟不適用。
- D2：獨立公開 repo `Will413028/cardano-agent-arena`。
- D3：開發者帶 Agent；常駐 Elo 排名按規則版本分組，賽季延後。
- D4：兩人交替佔空格、完全資訊；5×5、橫直斜連四勝，滿盤無勝者和局；前一有效行動 slot 後 5 分鐘未行動判負，任何人可提交。
- D5：每步一筆 L1 交易，validator 逐步驗證；連續 20 步首次入塊均 ≤120 秒，屬驗收門檻而非保證或最終性。
- D6：允許技術 state token 識別戰局，結束銷毀，不作交易商品。
- D7：玩家自管 client＋官方開源本機 runner；私鑰留在玩家端。
- D8：正式戰局僅 preprod；最長正常 25 步的建局、行動、結算 fee 合計 ≤10 tADA，可退還最低 ADA 另列。
- D9：Elo；UTC 日＋無序錢包配對＋規則版本，前 3 局計分，超額仍可打與回放。
- D10：沒有管理金鑰；只由公開規則與逾時處理戰局。
- D11：任何人可建公開挑戰局，其他人自行加入。
- D12：Agent 名稱、說明與對應錢包存鏈上，只登記適合公開的資料。

## Rationale

- D1–D3：先交付可見工程成果，相較需求優先與賽季省去早期招募／營運；接受需求仍未驗證。
- D4–D6：非即時短局適合逐步狀態機；L1 公開進度與逾時不依賴 head 或拒簽協議，代價是等待與每步費用。preprod spike 首次入塊 median 25.4415s、p95 47.113s、max 105.181s；仍須重測完整產品。
- D7、D10、D11：保持玩家簽章與參賽自主性，相較代管與管理鍵降低權限集中；代價是本機接入、缺乏人工救援與集中配對。
- D8：展示不需 mainnet ADA；preprod 仍有測試資金 fee、鎖定 ADA 與操作成本，資料持續性受測試網生命週期限制。
- D9：兩人遊戲採易重算的 Elo 與鏈上局數限制；代價是無法阻止多錢包群體互刷。
- D12：相較鏈下 profile，選擇從鏈歷史取得登記；代價是公開資料不可撤回與更新交易成本，不宣稱鏈下名稱會阻止 Elo 重算。

## Expected Outcome

- 玩家可不經營運者網站參賽，verifier 可不讀營運者資料庫重播與重算排名。
- 正式 validator 驗證建局、行動、勝負、逾時與 token 銷毀；完整產品達到延遲與成本門檻。
- 對外說明區分已量測 spike、待實作功能與未驗證需求。

## Followup

- 依計畫步驟 4–13 實作與驗收；先做 Walking skeleton，後補完整勝負、逾時、burn／退款與正式預算。
- 步驟 6 定義首步 deadline、未加入挑戰取消、slot 有效期與退款；步驟 8 定義登記授權、更新權及 Agent 識別。
- 步驟 10 固定初始 Elo、K 值、計分順序與重組處理，以獨立 golden fixture 驗收；不得把 spike 當正式驗收。

## Revocation Triggers

- 完整產品超出 120 秒／10 tADA 門檻，或公開歷史無法獨立取得時，重評 D4、D5、D8。
- 主要回報改為使用者增長、需託管玩家金鑰或人工改局時，重新拍板定位與信任邊界。

## Related

- 本 ADR 即原始紀錄，無外部來源文件；由 Will 於 2026-10-01 session 逐題拍板。
- 量測重跑入口：repo 的 `docs/plans/2026-10-01-agent-arena/spike-l1.md` 與 `spike-alternatives.md`；快照為 `7d750cf`，以 `git show 7d750cf:docs/plans/2026-10-01-agent-arena/spike-l1.md`（或 `spike-alternatives.md`）取回。
