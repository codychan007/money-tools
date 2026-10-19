# 每兩星期優惠更新：自動程序指示

> 呢份係俾 Claude 定時任務（每兩星期一次）用嘅工作指示。人手更新都可以照住做。

## 目標

更新 `data/deals.json`，為香港打工仔整理**目前有效、回贈較高**嘅信用卡及消費平台優惠，涵蓋五個類別：餐飲（dining）、網購（online）、交通（transport）、旅遊（travel）、超市（supermarket）。

## 步驟

1. 讀取現有 `data/deals.json`。
2. 逐項重新核實現有優惠：打開 `url`（官方條款／官方網頁），確認回贈率、條件、上限、推廣期仍然正確。已過期、已取消或無法核實嘅項目要刪除；有改動就更新內容。
3. 搵新優惠（**五個類別每個都要搜尋**，唔可以因為現有優惠仍然有效就跳過）：可以用比較網站（例如 MoneyHero、MoneySmart、HKCashRebate）做線索，但**每一項最後都必須喺發卡機構或平台嘅官方網頁／條款 PDF 核實**，`url` 一定要填官方連結。
4. 每個類別盡量保留 1–3 項回贈最高、條件合理嘅優惠；全部合共約 8–15 項。消費平台（例如 yuu、MoneyBack、易賞錢等積分計劃）如有明確、可核實嘅高回贈推廣亦可加入，`type` 填「儲分平台」。
5. 每項填寫：`title`、`type`、`categories`、`rate`（標題回贈率）、`highlight`、`conditions`（最低簽賬、上限、登記要求、主要除外交易，每點一句）、`start`、`expiry`（推廣完結日，官方冇列明就填 `null`）、`url`、`verifiedOn`（今日日期）。
6. 更新頂層 `updatedOn`（今日）同 `reviewBy`（今日 + 18 日）。
7. 執行 `python scripts/validate_deals.py`，必須見到 ✅ 先可以儲存／提交。
8. Commit 訊息：`chore: refresh deals YYYY-MM-DD`。推送前先 `git pull --rebase origin main`（每月 1 號會同醫療政策任務同時運行），然後 `git push origin HEAD:main`；如果被拒絕，再 pull --rebase 重試最多 3 次，唔好 force push。

## 必須遵守

- **絕對唔可以編造**任何優惠、數字或日期。核實唔到就唔好放。
- 唔可以有示例或假資料。
- 只用官方資料作準；比較網站只作線索。
- 用繁體中文、簡潔貼地。
- 唔好寫任何「推薦申請」、「最抵」之類嘅推銷字眼，只陳述事實同條件。
- 唔好改動 `data/deals.json` 以外嘅檔案。
- 完成後簡短匯報：新增、更新、刪除咗邊幾項，同埋任何未能核實嘅情況。
