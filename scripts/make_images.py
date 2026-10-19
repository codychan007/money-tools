"""
生成社交分享圖（1200×630）同網站圖示。只需要喺本機執行一次，生成嘅圖片會一齊上載。
需要 Pillow：pip install pillow
  python scripts/make_images.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OG = ROOT / "assets" / "og"
FONT_BOLD = "C:/Windows/Fonts/msjhbd.ttc"
FONT_REG = "C:/Windows/Fonts/msjh.ttc"
G9, G8, ACCENT, WHITE = (10, 61, 42), (15, 92, 63), (244, 185, 66), (255, 255, 255)

CARDS = {
    "home": ("🧰", "香港打工仔嘅|免費理財工具箱", "月薪分配・儲錢目標・理財健康檢查"),
    "salary": ("💰", "月薪扣強積金，|實際到手幾多？", "月薪分配計算器：50/30/20 即刻分好"),
    "goal": ("🎯", "想儲 50 萬要幾耐？", "理財目標計算機：唔同回報率一次過比較"),
    "health": ("🩺", "2 分鐘幫荷包做身體檢查", "理財健康檢查：10 條問題睇清楚"),
    "insurance": ("🛡️", "睇病要幾錢？|醫療費升緊幾多？", "公立醫院收費・醫療通脹・癌症數字"),
    "updates": ("🗞️", "雙週市場速遞", "每兩星期講清楚市場發生緊咩事"),
    "market": ("📊", "今日市場點？", "恒指・美股・HIBOR・匯率 每日更新"),
    "deals": ("🎁", "邊張卡著數啲？", "餐飲・網購・交通・旅遊・超市 回贈整理"),
}


def font(path, size):
    return ImageFont.truetype(path, size)


def og(key, title, sub):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), G8)
    d = ImageDraw.Draw(im)
    for y in range(H):  # 由深綠漸變
        t = y / H
        d.line([(0, y), (W, y)], fill=tuple(int(G8[i] * (1 - t) + G9[i] * t) for i in range(3)))
    d.ellipse([W - 330, -200, W + 170, 300], fill=(56, 108, 66))
    # 品牌
    d.rounded_rectangle([70, 64, 150, 144], radius=20, fill=ACCENT)
    d.text((110, 104), "理", font=font(FONT_BOLD, 50), fill=G9, anchor="mm")
    d.text((172, 74), "香港地一站式理財資訊通", font=font(FONT_BOLD, 38), fill=WHITE)
    d.text((172, 122), "By Cody Chan", font=font(FONT_REG, 26), fill=(205, 225, 214))
    # 標題：長標題用 | 手動斷行，避免標點單獨一行
    f = font(FONT_BOLD, 76)
    lines = title.split("|")
    assert all(d.textlength(ln, font=f) <= W - 140 for ln in lines), title
    y = 250 if len(lines) == 1 else 210
    for ln in lines:
        d.text((70, y), ln, font=f, fill=WHITE); y += 96
    d.text((70, y + 20), sub, font=font(FONT_REG, 38), fill=ACCENT)
    d.text((70, H - 70), "免費・資料只喺你部手機計・IG @codychan813", font=font(FONT_REG, 26), fill=(205, 225, 214))
    im.save(OG / f"{key}.png", optimize=True)


def icon(size, path):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=G8)
    d.text((size / 2, size / 2), "理", font=font(FONT_BOLD, int(size * 0.62)), fill=ACCENT, anchor="mm")
    im.save(path)


def main():
    OG.mkdir(parents=True, exist_ok=True)
    for k, (_, t, s) in CARDS.items():
        og(k, t, s)
    icon(32, ROOT / "assets" / "favicon-32.png")
    icon(180, ROOT / "assets" / "apple-touch-icon.png")
    (ROOT / "assets" / "favicon.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<rect width="64" height="64" rx="14" fill="#0F5C3F"/>'
        '<text x="32" y="45" font-size="40" text-anchor="middle" fill="#F4B942" '
        'font-family="PingFang HK,Microsoft JhengHei,Noto Sans TC,sans-serif" font-weight="700">理</text></svg>\n',
        encoding="utf-8")
    print("✅ 已生成分享圖同網站圖示")


if __name__ == "__main__":
    main()
