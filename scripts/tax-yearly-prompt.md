# 每年稅務數字更新：自動程序指示

> 每年 **3 月 1 日**（財政預算案之後）同 **6 月 1 日**（條例刊憲之後）早上 10:00（香港時間）由 Claude 雲端定時任務執行。人手更新都可以照住做。

## 目標

更新「慳稅規劃」（`/tax/`）用嘅薪俸稅數字：`data/tax/YYYY-YY.json` 同 `data/tax/index.json`。
稅務數字錯咗影響好大，所以**永遠唔可以直接推上 main**：改動推去一條新 branch，等 Cody 喺 GitHub 睇完、自己撳 Merge 先上網。

## 背景（點樣讀財政預算案）

- 課稅年度 = 4 月 1 日至翌年 3 月 31 日，例如 2027/28 = 2027-04-01 至 2028-03-31。
- 每年 2 月底嘅財政預算案通常會：
  1. 公布**啱啱完結嗰個年度**嘅一次性寬減（例如 2027 年 2 月預算案 → 2026/27 年度寬減 X%，上限 $Y）；
  2. 建議**下一個年度起**嘅免稅額、扣除上限、稅階改動（例如由 2027/28 起）。
- 建議要經立法會通過、刊憲先生效（通常 5 月前後）。稅務局網頁「財政預算案－稅務措施」（https://www.ird.gov.hk/eng/tax/budget.htm）會寫明幾時刊憲。

## 3 月 1 日（草擬）

1. 讀 `data/tax/index.json` 同最新年度嘅 JSON，睇清楚每個欄位。
2. 打開稅務局「財政預算案－稅務措施」頁同 GovHK 薪俸稅稅率／免稅額頁（https://www.gov.hk/en/residents/taxes/taxfiling/taxrates/salariesrates.htm），搵今年預算案嘅薪俸稅措施。
3. **一次性寬減**：如果預算案公布咗啱啱完結年度嘅寬減，改嗰個年度檔案嘅 `reduction`（`pct` 例如 1.0 = 100%，`cap` 例如 3000）。
4. **新年度**：建立 `data/tax/(新年度).json`：
   - 由最新一個年度檔案複製，再按預算案改有變動嘅數字（`allowances`、`deductions`、`elderlyCare`、`bands`、`standard`）；冇提及嘅照抄。
   - `year` 改新年度；`reduction` 設 `{"pct": 0, "cap": 0}`（新年度嘅寬減要等下年預算案先知）。
   - `_說明` 寫明「草擬：YYYY-MM-DD 財政預算案建議，未刊憲」同改咗邊幾項。
   - `verifiedOn` 填今日；`budgetUrl`、`sourceUrl` 用官方連結。
5. `index.json`：將新年度加喺 `years` **最前面**；`default` **暫時唔好改**（等刊憲先轉）；`years` 最多保留 3 個年度，多出嘅刪走最舊嗰個（連同佢嘅 JSON 檔）。
6. 執行 `python3 scripts/validate_tax.py`（必須見到 ✅）同 `python3 scripts/build.py`（必須成功）。

## 6 月 1 日（核實刊憲）

1. 打開稅務局「財政預算案－稅務措施」頁：睇今年嘅薪俸稅措施係咪已經「passed by the Legislative Council and gazetted」。
2. **已刊憲**：逐個數字對 GovHK 稅率／免稅額頁同稅務局頁面，改正任何同 3 月草擬唔同嘅數字；`_說明` 改為「已核實：YYYY-MM-DD 刊憲」；`verifiedOn` 填今日；`index.json` 嘅 `default` 改做新年度。
3. **未刊憲**：唔好改 `default`，只喺匯報寫明「未刊憲，7 月再睇」。
4. 執行 `python3 scripts/validate_tax.py` 同 `python3 scripts/build.py`。

## 提交（兩次都一樣）

- 冇任何改動（例如預算案冇薪俸稅措施）→ 唔使提交，只匯報。
- 有改動 → `git checkout -b tax-update-YYYY-MM-DD`，只加 `data/tax/` 入面嘅檔案，commit 訊息 `data: tax figures YYYY/YY (draft|gazetted) YYYY-MM-DD`，`git push origin tax-update-YYYY-MM-DD`。**唔好推 main，唔好 force push。**
- 匯報入面附上：`https://github.com/codychan007/money-tools/compare/main...tax-update-YYYY-MM-DD`（Cody 撳入去 → Create pull request → Merge）。

## 必須遵守

- **絕對唔可以編造**任何稅率、金額或日期；只用稅務局、GovHK、財政預算案官方網頁（budget.gov.hk）。核實唔到嘅數字保持原狀，喺匯報講明。
- 只改 `data/tax/`，唔好改程式或其他檔案。
- 完成後用繁體中文（廣東話）簡短匯報：改咗咩（舊 → 新）、新年度係咪已刊憲、`default` 有冇轉、branch 連結。
