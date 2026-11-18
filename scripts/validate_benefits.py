"""
檢查 data/benefits.json 格式。每次更新福利資料後執行；有錯會列出並以非零狀態結束。

  python scripts/validate_benefits.py
"""
import json
import re
import sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "data" / "benefits.json"
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CJK = re.compile(r"[㐀-鿿]")
GROUPS = {"work", "housing", "living", "family", "parents"}
# assets/js/benefits.js 有判斷規則嘅福利；加新項目要同時加規則
RULE_IDS = {"cef", "erb", "yes", "gbayes", "loan", "prh", "lph", "hos", "greenform", "youthHostel",
            "wfa", "ptfss", "cssa", "carer", "newborn", "textbook", "fare2", "hcv", "oaa", "oala",
            "postsec", "wsm", "familyPriority", "haWaiver", "kcfrs", "seniorCard", "colonscreen"}
TEXT = ["name", "summary", "amount", "apply", "source"]


def main():
    errors = []
    try:
        d = json.loads(PATH.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"❌ JSON 格式錯誤：{e}")
        sys.exit(1)

    for k in ("reviewedOn", "reviewBy"):
        if not DATE.match(str(d.get(k, ""))):
            errors.append(f"{k} 要係 YYYY-MM-DD")

    def bi(obj, where):
        if not isinstance(obj, dict) or not obj.get("zh") or not obj.get("en"):
            errors.append(f"{where}：要有 zh 同 en")
        elif CJK.search(obj["en"]):
            errors.append(f"{where}：en 入面有中文字")

    ids = set()
    for n, it in enumerate(d.get("items", []), 1):
        w = it.get("id", f"第 {n} 項")
        ids.add(it.get("id"))
        if it.get("group") not in GROUPS:
            errors.append(f"{w}：group 只可用 {sorted(GROUPS)}")
        for k in TEXT:
            bi(it.get(k), f"{w}.{k}")
        if it.get("notes") is not None:
            bi(it["notes"], f"{w}.notes")
        for lang in ("zh", "en"):
            if not str((it.get("url") or {}).get(lang, "")).startswith("https://"):
                errors.append(f"{w}：url.{lang} 要係 https 官方連結")
        if not DATE.match(str(it.get("asOf", ""))):
            errors.append(f"{w}：asOf 要係 YYYY-MM-DD")
    if ids != RULE_IDS:
        errors.append(f"items 嘅 id 要同 benefits.js 規則一致：多咗 {sorted(ids - RULE_IDS)}，少咗 {sorted(RULE_IDS - ids)}")

    T = d.get("tables", {})
    need = {"prh": ["income", "assets"], "wfa": ["full", "threeQuarter", "half", "assets", "basic", "medium", "high", "child"],
            "hosWhite": ["income1", "income2", "assets1", "assets2"], "youthHostel": ["ageMin", "ageMax", "income1", "assets1"],
            "carer": ["income"], "cssa": ["singleAbleBodied", "familyAbleBodied", "perPersonIncomeHint"],
            "textbook": ["fullAFI", "halfAFI"], "kcfrs": ["fullAFI", "threeQuarterAFI", "halfAFI"],
            "haWaiver": ["income", "fullIncome", "elderlyAssetAdd"], "ptfss": ["threshold", "cap", "rate"], "oala": ["incomeSingle", "assetsSingle", "incomeCouple", "assetsCouple"]}
    for tab, keys in need.items():
        x = T.get(tab)
        if not x:
            errors.append(f"tables 缺少 {tab}")
            continue
        for k in keys:
            v = x.get(k)
            nums = v if isinstance(v, list) else [v]
            if not nums or not all(isinstance(n, (int, float)) and n > 0 for n in nums):
                errors.append(f"tables.{tab}.{k} 要係正數（或正數列表）")
        if not str(x.get("sourceUrl", "")).startswith("https://"):
            errors.append(f"tables.{tab}：sourceUrl 要係 https")
    if len(T.get("prh", {}).get("income", [])) != 10 or len(T.get("prh", {}).get("assets", [])) != 10:
        errors.append("tables.prh：income 同 assets 要有 10 個（1 至 10 人或以上）")
    for k in ("full", "threeQuarter", "half"):
        if len(T.get("wfa", {}).get(k, [])) != 6:
            errors.append(f"tables.wfa.{k}：要有 6 個（1 至 6 人或以上）")
    for k in ("income", "fullIncome"):
        if len(T.get("haWaiver", {}).get(k, [])) != 5:
            errors.append(f"tables.haWaiver.{k}：要有 5 個（1 至 5 人或以上）")
    for k in ("basic", "medium", "high", "child"):
        if len(T.get("wfa", {}).get(k, [])) != 3:
            errors.append(f"tables.wfa.{k}：要有 3 個（全額、3/4 額、半額）")

    visible = json.dumps({k: v for k, v in d.items() if not k.startswith("_")}, ensure_ascii=False)
    if "【" in visible or "示例" in visible:
        errors.append("唔可以有【】佔位或示例數據")

    if errors:
        print("❌ 發現問題：")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print(f"✅ benefits.json 正常：共 {len(d['items'])} 項福利，最後核對 {d['reviewedOn']}")


if __name__ == "__main__":
    main()
