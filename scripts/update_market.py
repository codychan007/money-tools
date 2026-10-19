"""
每日自動更新 data/market.json（由 GitHub Actions 每日執行兩次）。

  python scripts/update_market.py                 # 更新 data/market.json
  python scripts/update_market.py --file x.json   # 更新指定檔案（測試用）

數據來源：
  - 股市指數：Yahoo Finance 公開圖表介面（非官方介面，可能延遲約 15 分鐘或以上）
  - 基本利率、HIBOR：金管局 Open API（每日）
  - 港元定存平均息率、最優惠利率：金管局 Open API（每月）
  - 美元兌港元：Frankfurter（歐洲央行參考匯率，每個工作日）

任何一個來源失敗，只會保留該項上次嘅真實數據（唔會改更新時間），
網站會因應「最後更新時間」自動顯示「可能未更新」提示，唔會用示例數據頂替。
"""
import argparse
import datetime as dt
import json
import sys
import time
import urllib.request
from pathlib import Path

HKT = dt.timezone(dt.timedelta(hours=8))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range=1d&interval=1d"
INDICES = {"hsi": "%5EHSI", "spx": "%5EGSPC", "ndx": "%5EIXIC", "dji": "%5EDJI"}
HKMA_DAILY = ("https://api.hkma.gov.hk/public/market-data-and-statistics/"
              "daily-monetary-statistics/daily-figures-interbank-liquidity?pagesize=1")
HKMA_MONTHLY = ("https://api.hkma.gov.hk/public/market-data-and-statistics/"
                "monthly-statistical-bulletin/er-ir/hkd-ir-periodaverage?pagesize=1")
FX_URL = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=HKD"


def get_json(url, tries=1, wait=20):
    last = None
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            last = e
            if n < tries - 1:
                time.sleep(wait)
    raise last


def put(items, item_id, **fields):
    for it in items:
        if it["id"] == item_id:
            it.update(fields)
            it.pop("sample", None)
            return True
    return False


def fmt_change(p, prev):
    if not prev:
        return "", ""
    c = (p / prev - 1) * 100
    return f"{c:+.2f}%", ("up" if c > 0 else "down" if c < 0 else "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=str(Path(__file__).resolve().parent.parent / "data" / "market.json"))
    path = Path(ap.parse_args().file)
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data["items"]
    ok, failed = [], []

    # 1. 股市指數
    for item_id, sym in INDICES.items():
        try:
            m = get_json(YAHOO.format(sym=sym), tries=2, wait=5)["chart"]["result"][0]["meta"]
            p, prev = m["regularMarketPrice"], m.get("chartPreviousClose")
            change, direction = fmt_change(p, prev)
            when = dt.datetime.fromtimestamp(m["regularMarketTime"], HKT).strftime("%Y-%m-%d %H:%M")
            put(items, item_id, value=f"{p:,.2f}", change=change, direction=direction, updatedAt=when)
            ok.append(item_id)
        except Exception as e:  # noqa: BLE001
            failed.append(f"{item_id}: {e}")

    # 2. 金管局每日：基本利率、HIBOR
    try:
        rec = get_json(HKMA_DAILY, tries=3)["result"]["records"][0]
        d = rec["end_of_date"]
        for item_id, key, fmt in [("base_rate", "disc_win_base_rate", "{:.2f}%"),
                                  ("hibor_on", "hibor_overnight", "{:.2f}%"),
                                  ("hibor_1m", "hibor_fixing_1m", "{:.4f}%")]:
            if rec.get(key) is not None:
                put(items, item_id, value=fmt.format(rec[key]), updatedAt=d)
                ok.append(item_id)
    except Exception as e:  # noqa: BLE001
        failed.append(f"hkma daily: {e}")

    # 3. 金管局每月：定存平均息率、最優惠利率
    try:
        rec = get_json(HKMA_MONTHLY, tries=3)["result"]["records"][0]
        m = rec["end_of_month"]
        if rec.get("dr_3m") is not None:
            put(items, "td_3m", value=f'{rec["dr_3m"]:.2f}%', updatedAt=m); ok.append("td_3m")
        if rec.get("best_lending_rate") is not None:
            put(items, "prime", value=f'{rec["best_lending_rate"]:.2f}%', updatedAt=m); ok.append("prime")
    except Exception as e:  # noqa: BLE001
        failed.append(f"hkma monthly: {e}")

    # 4. 美元兌港元
    try:
        fx = get_json(FX_URL, tries=2, wait=5)
        put(items, "usdhkd", value=f'{fx["rates"]["HKD"]:.4f}', updatedAt=fx["date"])
        ok.append("usdhkd")
    except Exception as e:  # noqa: BLE001
        failed.append(f"usdhkd: {e}")

    data["lastRun"] = dt.datetime.now(HKT).strftime("%Y-%m-%d %H:%M")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("已更新：", ", ".join(ok) or "冇")
    for f in failed:
        print("[略過]", f, file=sys.stderr)


if __name__ == "__main__":
    main()
