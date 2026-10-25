"""
檢查 data/deals.json 格式。每次更新優惠後執行；有錯會列出並以非零狀態結束。

  python scripts/validate_deals.py
"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "deals.json"
CATS = {"dining", "online", "transport", "travel", "supermarket"}
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
REQUIRED = ["title", "type", "categories", "rate", "highlight", "conditions", "expiry", "url", "verifiedOn"]
REQUIRED_EN = ["title_en", "type_en", "highlight_en", "conditions_en"]   # 英文版網站用
CJK = re.compile(r"[\u3400-\u9fff]")


def main():
    errors = []
    try:
        d = json.loads(PATH.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"❌ JSON 格式錯誤：{e}")
        sys.exit(1)

    for k in ["updatedOn", "reviewBy"]:
        if not DATE.match(str(d.get(k, ""))):
            errors.append(f"{k} 要係 YYYY-MM-DD")
    if set((d.get("categories_en") or {}).keys()) != CATS:
        errors.append(f"categories_en 要有晒 {sorted(CATS)} 嘅英文名")
    today = dt.date.today().isoformat()
    live = 0
    for n, it in enumerate(d.get("items", []), 1):
        name = it.get("title", f"第 {n} 項")
        for k in REQUIRED:
            if k not in it:
                errors.append(f"{name}：缺少 {k}")
        for k in REQUIRED_EN:
            if not it.get(k):
                errors.append(f"{name}：缺少英文 {k}")
            elif CJK.search(str(it[k])):
                errors.append(f"{name}：{k} 入面有中文字，要寫英文")
        if it.get("conditions_en") and len(it["conditions_en"]) != len(it.get("conditions", [])):
            errors.append(f"{name}：conditions_en 要同 conditions 一樣多項")
        if CJK.search(str(it.get("rate", ""))) and not it.get("rate_en"):
            errors.append(f"{name}：rate 有中文字，要加 rate_en")
        if not set(it.get("categories", [])) <= CATS or not it.get("categories"):
            errors.append(f"{name}：categories 只可用 {sorted(CATS)}")
        if it.get("expiry") is not None and not DATE.match(str(it["expiry"])):
            errors.append(f"{name}：expiry 要係 YYYY-MM-DD 或 null")
        if not str(it.get("url", "")).startswith("https://"):
            errors.append(f"{name}：url 必須係 https 官方連結")
        if not DATE.match(str(it.get("verifiedOn", ""))):
            errors.append(f"{name}：verifiedOn 要係 YYYY-MM-DD")
        if it.get("sample"):
            errors.append(f"{name}：唔可以有示例數據（sample）")
        if it.get("expiry") is None or it["expiry"] >= today:
            live += 1
    if live == 0:
        errors.append("冇任何未過期優惠")

    if errors:
        print("❌ 發現問題：")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"✅ deals.json 正常：共 {len(d['items'])} 項，其中 {live} 項未過期")


if __name__ == "__main__":
    main()
