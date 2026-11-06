"""
檢查 data/tax/*.json（慳稅規劃嘅稅率、免稅額、扣除上限）。每次改稅務數字後執行；有錯會列出並以非零狀態結束。

  python scripts/validate_tax.py
"""
import json
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
DIR = Path(__file__).resolve().parent.parent / "data" / "tax"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
YEAR = re.compile(r"^(\d{4})/(\d{2})$")
ALLOW = ("basic", "married", "singleParent", "child", "childNewborn", "parent60", "parent60Live", "parent55", "parent55Live")
DED = ("mpf", "vhisPerInsured", "tvcQdap", "rent", "rentWithChild", "homeLoan", "homeLoanWithChild", "education", "donationPct")


def progressive(nci, bands):
    left, tax = max(0, nci), 0
    for width, rate in bands:
        part = left if width is None else min(left, width)
        tax += part * rate
        left -= part
        if left <= 0:
            break
    return tax


def main():
    errors = []
    err = errors.append
    try:
        idx = json.loads((DIR / "index.json").read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"❌ index.json 讀唔到：{e}")
        sys.exit(1)
    years = [y["year"] for y in idx.get("years", [])]
    if not years:
        err("index.json：years 唔可以係空")
    if idx.get("default") not in years:
        err(f"index.json：default {idx.get('default')} 唔喺 years 入面")
    if years != sorted(years, reverse=True):
        err("index.json：years 要由新到舊排")
    for y in idx.get("years", []):
        f = DIR / y["file"]
        m = YEAR.match(y["year"])
        if not m or int(m.group(2)) != (int(m.group(1)) + 1) % 100:
            err(f"{y['year']}：課稅年度格式要係 YYYY/YY（例如 2026/27）")
        if not m or y["file"] != f"{m.group(1)}-{m.group(2)}.json":
            err(f"{y['year']}：檔名應該係 {y['year'].replace('/', '-')}.json")
        if not f.is_file():
            err(f"{y['year']}：搵唔到 {y['file']}")
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            err(f"{y['file']}：JSON 格式錯誤 {e}")
            continue
        w = y["file"]
        if d.get("year") != y["year"]:
            err(f"{w}：year 欄（{d.get('year')}）同 index.json 唔一致")
        if not DATE.match(d.get("verifiedOn") or ""):
            err(f"{w}：verifiedOn 要係 YYYY-MM-DD（核實日期）")
        for k in ("sourceUrl", "budgetUrl"):
            if not str(d.get(k, "")).startswith("https://"):
                err(f"{w}：{k} 要係官方 https 連結")
        A = d.get("allowances", {})
        for k in ALLOW:
            if not isinstance(A.get(k), (int, float)) or A[k] <= 0:
                err(f"{w}：allowances.{k} 要係正數")
        if A.get("married", 0) < A.get("basic", 0):
            err(f"{w}：已婚人士免稅額唔應該少過基本免稅額")
        if A.get("newbornYears") not in (1, 2, 3):
            err(f"{w}：allowances.newbornYears 要係 1–3")
        D = d.get("deductions", {})
        for k in DED:
            if not isinstance(D.get(k), (int, float)) or D[k] <= 0:
                err(f"{w}：deductions.{k} 要係正數")
        if not 0 < D.get("donationPct", 0) <= 1:
            err(f"{w}：donationPct 要係 0–1（例如 0.35）")
        if not isinstance(d.get("elderlyCare"), (int, float)) or d["elderlyCare"] <= 0:
            err(f"{w}：elderlyCare 要係正數")
        bands = d.get("bands", [])
        if not bands or bands[-1][0] is not None or any(b[0] is None for b in bands[:-1]):
            err(f"{w}：bands 最後一級要係 [null, 稅率]，其他級要有闊度")
        if any(not 0 < b[1] < 1 for b in bands):
            err(f"{w}：bands 稅率要係 0–1 之間")
        if [b[1] for b in bands] != sorted(b[1] for b in bands):
            err(f"{w}：累進稅率要由低到高")
        std = d.get("standard", [])
        if not std or std[-1][0] is not None:
            err(f"{w}：standard 最後一級要係 [null, 稅率]")
        red = d.get("reduction", {})
        if not (0 <= red.get("pct", -1) <= 1) or red.get("cap", -1) < 0:
            err(f"{w}：reduction 要有 pct（0–1）同 cap（≥ 0）")
        # 合理性：單身年入 $360,000、強積金 $18,000 → 應繳稅介乎 $0 至 $40,000
        if bands and not errors:
            nci = max(0, 360000 - D["mpf"] - A["basic"])
            tax = progressive(nci, bands)
            if not 0 <= tax <= 40000:
                err(f"{w}：例子（單身年入 $360,000）算出 ${tax:,.0f}，唔合理，請檢查稅階")
    if errors:
        print("❌ 稅務數據有問題：")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"✅ 稅務數據正常：{', '.join(years)}（預設 {idx.get('default')}）")


if __name__ == "__main__":
    main()
