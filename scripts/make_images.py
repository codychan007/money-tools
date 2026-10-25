"""
生成社交分享圖（1200×630，中英各一套）同網站圖示。只需要喺本機（Windows）執行一次，生成嘅圖片會一齊上載。
需要 Pillow：pip install pillow
  python scripts/make_images.py
風格同網站一樣：和紙底、墨色字、朱紅印章。
"""
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OG = ROOT / "assets" / "og"
FONT_SERIF = "C:/Windows/Fonts/NotoSerifHK-VF.ttf"
FONT_SANS = "C:/Windows/Fonts/NotoSansHK-VF.ttf"
PAPER, INK, INK2, SHU, CREAM = (243, 236, 221), (35, 31, 28), (86, 78, 70), (181, 54, 31), (251, 243, 228)

# key: (印章字, 中文標題, 中文副題, 英文標題, 英文副題)；長標題用 | 手動斷行
CARDS = {
    "home": ("理", "香港打工仔嘅|理財工具箱", "3 步理財體檢・月薪分配・儲錢目標",
             "A money toolkit for|Hong Kong employees", "3-step check-up · salary split · savings goals"),
    "salary": ("薪", "月薪扣強積金，|實際到手幾多？", "月薪分配計算器：50/30/20 即刻分好",
               "After MPF, what do|you actually take home?", "Salary split calculator: 50/30/20 in seconds"),
    "goal": ("標", "想儲 50 萬要幾耐？", "理財目標計算機：唔同回報率一次過比較",
             "How long to save|$500,000?", "Goal planner: compare returns side by side"),
    "health": ("健", "2 分鐘幫荷包做身體檢查", "理財健康檢查：10 條問題睇清楚",
               "A 2-minute check-up|for your finances", "Money health check: 10 quick questions"),
    "insurance": ("保", "睇病要幾錢？|醫療費升緊幾多？", "公立醫院收費・醫療通脹・癌症數字",
                  "What does getting|sick cost in Hong Kong?", "Hospital fees · medical inflation · cancer facts"),
    "updates": ("讀", "雙週市場速遞", "每兩星期講清楚市場發生緊咩事",
                "Fortnightly market notes", "What moved markets, in plain language"),
    "market": ("市", "今日市場點？", "恒指・美股・HIBOR・匯率 每日更新",
               "How are markets today?", "Hang Seng · US stocks · HIBOR · FX, daily"),
    "deals": ("惠", "邊張卡著數啲？", "餐飲・網購・交通・旅遊・超市 回贈整理",
              "Which card pays|you more?", "Dining · online · transport · travel · supermarket"),
}


def font(path, size, weight=700):
    f = ImageFont.truetype(path, size)
    try:
        f.set_variation_by_axes([weight])
    except (OSError, ValueError):
        pass
    return f


def paper(W, H):
    im = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    rnd = random.Random(7)   # 固定紙紋，每次生成一樣
    for _ in range(W * H // 90):
        x, y = rnd.randrange(W), rnd.randrange(H)
        c = rnd.randint(205, 230)
        d.point((x, y), fill=(c, c - 8, c - 22))
    return im, d


def seal(d, x, y, size, ch):
    d.rounded_rectangle([x, y, x + size, y + size], radius=int(size * 0.1), fill=SHU)
    m = int(size * 0.08)
    d.rounded_rectangle([x + m, y + m, x + size - m, y + size - m], radius=int(size * 0.06), outline=CREAM, width=max(2, size // 30))
    d.text((x + size / 2, y + size / 2 + size * 0.02), ch, font=font(FONT_SERIF, int(size * 0.58)), fill=CREAM, anchor="mm")


def brush(d, x, y, w):
    """毛筆線：兩頭幼、中間粗"""
    for i in range(w):
        t = i / w
        th = 3 + 7 * max(0.0, 1 - abs(t - 0.45) * 1.8) ** 0.6
        d.line([(x + i, y - th / 2 + 2 * (t - .5) ** 2), (x + i, y + th / 2)], fill=INK)


def og(key, lang, ch, title, sub):
    W, H = 1200, 630
    im, d = paper(W, H)
    d.rectangle([0, 0, W - 1, H - 1], outline=INK, width=6)
    # 品牌
    seal(d, 70, 60, 84, "理")
    brand = "香港地一站式理財資訊通" if lang == "zh" else "HK Money Compass"
    d.text((176, 68), brand, font=font(FONT_SERIF, 36), fill=INK)
    d.text((176, 116), "By Cody Chan", font=font(FONT_SANS, 26, 400), fill=INK2)
    # 右上大印章
    seal(d, W - 230, 52, 150, ch)
    # 標題
    f = font(FONT_SERIF, 72 if lang == "zh" else 64)
    lines = title.split("|")
    assert all(d.textlength(ln, font=f) <= W - 140 for ln in lines), title
    y = 250 if len(lines) == 1 else 212
    for ln in lines:
        d.text((70, y), ln, font=f, fill=INK); y += 92
    brush(d, 72, y + 32, 260)
    d.text((70, y + 58), sub, font=font(FONT_SANS, 34, 500), fill=SHU)
    foot = "資料只喺你部機計・IG @codychan813" if lang == "zh" else "Calculated on your device · IG @codychan813"
    d.text((70, H - 66), foot, font=font(FONT_SANS, 24, 400), fill=INK2)
    im.save(OG / f"{key}{'' if lang == 'zh' else '-en'}.png", optimize=True)


def icon(size, path):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    seal(d, 0, 0, size - 1, "理")
    im.save(path)


def main():
    OG.mkdir(parents=True, exist_ok=True)
    for k, (ch, tz, sz, te, se) in CARDS.items():
        og(k, "zh", ch, tz, sz)
        og(k, "en", ch, te, se)
    icon(32, ROOT / "assets" / "favicon-32.png")
    icon(180, ROOT / "assets" / "apple-touch-icon.png")
    (ROOT / "assets" / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="7" fill="#B5361F"/>'
        '<rect x="5" y="5" width="54" height="54" rx="4" fill="none" stroke="#FBF3E4" stroke-width="2"/>'
        '<text x="32" y="44" font-size="36" text-anchor="middle" fill="#FBF3E4" '
        'font-family="Noto Serif HK,Songti TC,PMingLiU,serif" font-weight="700">理</text></svg>\n',
        encoding="utf-8")
    print("✅ 已生成分享圖（中英）同網站圖示")


if __name__ == "__main__":
    main()
