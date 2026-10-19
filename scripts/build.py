"""
部署時執行：將網站生成到 dist/，令搜尋引擎同 AI 爬蟲唔使行 JavaScript 都讀到內容。

  python scripts/build.py          # 生成 dist/
  SITE_URL=https://example.com python scripts/build.py

做嘅嘢：
  - 每頁加入靜態導覽列、頁尾、免責聲明、預約按鈕
  - 每頁加入 canonical、Open Graph、favicon、結構化資料（JSON-LD）
  - 計算工具頁：將 {{TOKEN}} 換成強積金法定數字同計算例子，並加入常見問題
  - 保障資訊頁：由 data/insurance.json 直接生成 HTML
  - 市場解讀：每篇 PDF 生成獨立頁 /updates/<id>/，列表頁同首頁直接列出文章
  - 生成 sitemap.xml、robots.txt

只用 Python 標準庫，Netlify / Cloudflare Pages 都可以直接執行。
"""
import datetime as dt
import html
import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SITE_URL = (os.environ.get("SITE_URL") or os.environ.get("URL") or "https://codychan813.netlify.app").rstrip("/")
HKT = dt.timezone(dt.timedelta(hours=8))
TODAY = dt.datetime.now(HKT).date().isoformat()

BRAND = "香港地一站式理財資訊通"
SHORT = "理財資訊通"
BYLINE = "By Cody Chan"
IG = "codychan813"
IG_URL = f"https://www.instagram.com/{IG}/"

NAV = [
    ("/", "首頁"), ("/goal/", "目標計算機"), ("/health/", "健康檢查"), ("/salary/", "月薪分配"),
    ("/insurance/", "保障資訊"), ("/updates/", "市場解讀"), ("/market/", "市場快訊"),
    ("/deals/", "優惠回贈"), ("/book/", "預約傾談"),
]
FOOTER_EXTRA = [("/about/", "關於我"), ("/disclaimer/", "免責聲明及私隱政策")]

# 每頁用邊張分享圖、邊組常見問題
PAGE_OG = {"/": "home", "/salary/": "salary", "/goal/": "goal", "/health/": "health",
           "/insurance/": "insurance", "/updates/": "updates", "/market/": "market", "/deals/": "deals"}
PAGE_FAQ = {"/salary/": "salary", "/goal/": "goal", "/health/": "health"}

# 唔會複製到 dist 嘅嘢
EXCLUDE_TOP = {".git", ".github", ".claude", "dist", "scripts", "tests", "netlify.toml", "如何更新內容.md", "__pycache__"}

e = html.escape


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def money(x):
    return f"${round(x):,}"


# ------------------------------------------------------------------
# 計算（同 assets/js/finance.js 一樣嘅公式，用嚟生成靜態例子）
# ------------------------------------------------------------------
def monthly_rate(r):
    return (1 + r) ** (1 / 12) - 1


def months_to_goal(target, savings, monthly, r):
    import math
    if savings >= target:
        return 0
    i = monthly_rate(r)
    if i == 0:
        return math.ceil((target - savings) / monthly) if monthly > 0 else None
    n = math.log((target * i + monthly) / (savings * i + monthly)) / math.log(1 + i)
    return math.ceil(round(n * 1e9) / 1e9)


def ym(months):
    y, m = divmod(months, 12)
    return (f"{y} 年" if y else "") + (" " if y and m else "") + (f"{m} 個月" if m else "")


def tokens():
    mpf = load("statutory.json")["mpf"]
    lo, hi, rate = mpf["minRelevantIncome"], mpf["maxRelevantIncome"], mpf["employeeRate"]
    sal = 18000
    ee = 0 if sal < lo else min(sal, hi) * rate
    take = sal - ee
    t = {
        "MPF_RATE": f"{rate * 100:g}%",
        "MPF_MIN": f"{lo:,}",
        "MPF_MAX": f"{hi:,}",
        "MPF_CAP": f"{hi * rate:,.0f}",
        "EX_SAL": f"{sal:,}",
        "EX_EE": money(ee),
        "EX_TAKE": money(take),
        "EX_NEEDS": money(take * 0.5),
        "EX_WANTS": money(take * 0.3),
        "EX_SAVE": money(take * 0.2),
        "EX_SAVE_YEAR": money(take * 0.2 * 12),
    }
    rows = []
    for r in (0.02, 0.04, 0.06, 0.08):
        n = months_to_goal(500000, 30000, 5000, r)
        rows.append(f"<tr><td>{r * 100:g}%</td><td>{ym(n)}</td><td>{money(30000 + 5000 * n)}</td></tr>")
    t["GOAL_TABLE"] = "".join(rows)
    t["INFL_DEFAULT"] = f'{load("insurance.json")["medicalInflation"]["defaultRate"]:g}'
    return t


# ------------------------------------------------------------------
# 共用版面
# ------------------------------------------------------------------
def header(path):
    current = ' aria-current="page"'
    on = lambda h: h == path or (h != "/" and path.startswith(h))  # 文章頁都標示「市場解讀」
    links = "".join(f'<a href="{h}"{current if on(h) else ""}>{e(lbl)}</a>' for h, lbl in NAV)
    return f"""
<header class="site-header">
  <div class="wrap wide">
    <div class="bar">
      <a class="brand" href="/">
        <span class="brand-mark">理</span>
        <span>{SHORT}<br><small>{BYLINE}</small></span>
      </a>
      <button class="menu-btn" aria-label="開啟選單" aria-expanded="false" aria-controls="site-nav">☰</button>
      <nav class="nav" id="site-nav">{links}</nav>
    </div>
  </div>
</header>"""


def footer():
    links = "".join(f'<a href="{h}">{e(lbl)}</a>' for h, lbl in NAV[1:] + FOOTER_EXTRA)
    return f"""
<footer class="site-footer">
  <div class="wrap wide">
    <h4>{BRAND} – {BYLINE}</h4>
    <div>IG：<a href="{IG_URL}" target="_blank" rel="noopener">@{IG}</a></div>
    <div class="links">{links}</div>
    <div class="legal">
      <p><strong>免責聲明：</strong>本網站所有工具、文章及資料只作一般教育及參考用途，不構成任何投資、保險、稅務或法律建議，亦非任何產品之要約或招攬。
      工具所用回報率均為假設，並非保證；投資涉及風險，過往表現不代表將來。作任何財務決定前，請按個人情況尋求合適專業意見。
      市場數據及優惠資料整理自所列來源，可能有延遲或已有變動，請以官方最新公布為準。</p>
      <p>© {TODAY[:4]} {BRAND}</p>
    </div>
  </div>
</footer>"""


TOOL_DISCLAIMER = """<div class="disclaimer" data-disclaimer="tool">
  <strong>重要提示：</strong>本工具嘅計算結果僅供參考，不構成任何投資、保險或財務建議。
  所用回報率純屬假設，並非保證回報；投資涉及風險，資產價值可升可跌。
  你輸入嘅資料只會喺你部手機／電腦內計算，<strong>唔會儲存、唔會上傳</strong>。</div>"""

CTA = """<div data-cta><div class="cta-soft">
  <p>計完都係有啲唔肯定？</p>
  <a href="/book/">想有人幫你睇清楚？預約免費傾談 →</a>
</div></div>"""


def person_ld():
    return {"@type": "Person", "name": "Cody Chan", "url": f"{SITE_URL}/about/", "sameAs": [IG_URL],
            "jobTitle": "保險理財顧問"}


def head_extra(path, title, desc, og_key, ld, noindex=False):
    url = SITE_URL + path
    img = f"{SITE_URL}/assets/og/{og_key}.png"
    parts = [
        f'<link rel="canonical" href="{url}">',
        '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">',
        '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
        f'<meta property="og:site_name" content="{BRAND}">',
        '<meta property="og:locale" content="zh_HK">',
        f'<meta property="og:type" content="{"article" if path.startswith("/updates/") and path != "/updates/" else "website"}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{img}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if noindex:
        parts.append('<meta name="robots" content="noindex">')
    for block in ld:
        block = {"@context": "https://schema.org", **block}
        parts.append('<script type="application/ld+json">' +
                     json.dumps(block, ensure_ascii=False).replace("</", "<\\/") + "</script>")
    return "\n  ".join(parts)


def fill(text):
    for k, v in TOKENS.items():
        text = text.replace("{{" + k + "}}", v)
    return text


def faq_html_and_ld(key):
    items = json.loads(fill((ROOT / "content" / "faq.json").read_text(encoding="utf-8")))[key]
    body = "".join(
        f'<details class="faq"><summary>{e(q["q"])}</summary><p>{q["a"]}</p></details>' for q in items)
    section = f'<section class="card"><h2>常見問題</h2>{body}</section>'
    ld = {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q["q"],
         "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", q["a"])}} for q in items]}
    return section, ld


def finish_page(src, path, extra_ld=None, noindex=False):
    """將來源 HTML 變成完整靜態頁"""
    title = re.search(r"<title>(.*?)</title>", src, re.S).group(1).strip()
    m = re.search(r'<meta name="description" content="([^"]*)"', src)
    desc = html.unescape(m.group(1)) if m else ""
    ld = list(extra_ld or [])

    src = fill(src)
    if path in PAGE_FAQ and "<!--FAQ-->" in src:
        section, faq_ld = faq_html_and_ld(PAGE_FAQ[path])
        src = src.replace("<!--FAQ-->", section)
        ld.append(faq_ld)

    src = src.replace('<div data-disclaimer="tool"></div>', TOOL_DISCLAIMER)
    src = src.replace("<div data-cta></div>", CTA)
    og_key = PAGE_OG.get(path, "updates" if path.startswith("/updates/") else "home")
    src = src.replace('<link rel="stylesheet" href="/assets/css/style.css">',
                      '<link rel="stylesheet" href="/assets/css/style.css">\n  ' +
                      head_extra(path, title, desc, og_key, ld, noindex), 1)
    src = src.replace("<body>", "<body>" + header(path), 1)
    src = src.replace("</main>", "</main>" + footer(), 1)
    leftover = re.findall(r"\{\{[A-Z_]+\}\}", src)
    if leftover:
        raise SystemExit(f"{path}：未替換嘅 token {leftover}")
    return src


# ------------------------------------------------------------------
# 保障資訊頁
# ------------------------------------------------------------------
def a(url, text):
    return f'<a href="{e(url)}" target="_blank" rel="noopener">{e(text)}</a>'


def stale_badge(review_by, text="資料或已過時，請以官方最新公布為準"):
    # 空白佔位：由瀏覽器按當日日期決定要唔要加入提示文字（insurance.js），
    # 咁爬蟲唔會誤讀一段隱藏嘅「過時」字眼
    return f' <span class="badge stale" data-review-by="{e(review_by or "")}" data-stale-text="{e(text)}" hidden></span>' if review_by else ""


def source_line(it):
    src = a(it["sourceUrl"], it["source"]) if it.get("sourceUrl") else e(it.get("source", ""))
    asof = f"｜資料截至：{e(it['asOf'])}" if it.get("asOf") else ""
    return f'<div class="source">來源：{src}{asof}{stale_badge(it.get("reviewBy"))}</div>'


def stat_cards(items):
    out = []
    for it in items:
        sub = f"<span>{e(it['sub'])}</span>" if it.get("sub") else ""
        src = source_line(it) if it.get("source") else ""
        out.append(f'<div class="stat"><span>{e(it["label"])}</span>'
                   f'<b class="num" style="font-size:1.5rem">{e(it["value"])}</b>{sub}{src}</div>')
    return f'<div class="grid cols-2">{"".join(out)}</div>'


def extra_sources(lst):
    return "、".join(a(s["url"], s["name"]) for s in lst or [])


def policy_item(it):
    pts = "".join(f"<li>{e(p)}</li>" for p in it["points"])
    return (f'<div style="border-left:3px solid var(--green-100);padding-left:12px;margin:14px 0">'
            f'<span class="badge">{e(it["date"])}</span><h3 style="margin:6px 0">{e(it["title"])}</h3>'
            f'<ul style="margin:0;padding-left:1.2em">{pts}</ul>'
            f'<div class="source">來源：{a(it["sourceUrl"], it["source"])}</div></div>')


def insurance_sections():
    D = load("insurance.json")
    s = {}
    mi = D["medicalInflation"]
    s["inflation"] = (f'<h2>📈 {e(mi["title"])}</h2>{stat_cards(mi["items"])}'
                      f'<p class="muted" style="font-size:13px;margin:12px 0 0">{e(mi["note"])}</p>')
    pf = D["publicFees"]
    rows = "".join(f'<tr><td>{e(r[0])}</td><td class="num"><b>{e(r[1])}</b></td>'
                   f'<td style="text-align:left;font-size:13px">{e(r[2])}</td></tr>' for r in pf["rows"])
    s["public-fees"] = (f'<h2>🏥 {e(pf["title"])}</h2><p>{e(pf["intro"])}</p>'
                        f'<div class="table-scroll"><table class="data wrap-cells"><tr><th>項目</th><th>收費</th><th>備註</th></tr>{rows}</table></div>'
                        f'{source_line(pf)}' + (f'<div class="source">另見：{extra_sources(pf.get("extraSources"))}</div>' if pf.get("extraSources") else ""))
    pc = D["privateCosts"]
    filled = [r for r in pc.get("table", []) if r.get("p50") and "【" not in r.get("procedure", "")]
    table = ""
    if filled:
        trs = "".join(f'<tr><td>{a(r["sourceUrl"], r["procedure"]) if r.get("sourceUrl") else e(r["procedure"])}</td>'
                      f'<td>{e(r["hospital"])}</td><td>{e(r["p50"])}</td><td>{e(r.get("p90", ""))}</td><td>{e(r["period"])}</td></tr>' for r in filled)
        table = f'<div class="table-scroll" style="margin-top:12px"><table class="data"><tr><th>手術</th><th>醫院</th><th>P50</th><th>P90</th><th>資料期</th></tr>{trs}</table></div>'
    s["private-costs"] = (f'<h2>🏨 {e(pc["title"])}</h2><p>{e(pc["intro"])}</p>{stat_cards(pc["highlights"])}{table}'
                          '<p class="muted" style="font-size:13px;margin:12px 0 0">小貼士：入院前可以要求醫院提供書面費用預算，亦可以喺醫院網站搵「過往收費統計」比較。</p>')
    ca = D["cancer"]
    s["cancer"] = (f'<h2>🎗️ {e(ca["title"])}</h2>{stat_cards(ca["items"])}{source_line(ca)}' +
                   (f'<div class="source">另見：{extra_sources(ca.get("extraSources"))}</div>' if ca.get("extraSources") else ""))
    po = D["policy"]
    items = sorted(po.get("items", []), key=lambda x: x["date"], reverse=True)
    arch = sorted(po.get("archive", []), key=lambda x: x["date"], reverse=True)
    body = "".join(map(policy_item, items)) if items else '<p class="muted">最近三個月未有新嘅重要醫療政策。</p>'
    if arch:
        body += ('<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">'
                 f'📂 過往政策更新（{len(arch)}）</summary><p class="muted" style="font-size:13px;margin:4px 0 0">以下係較早嘅政策消息，部分內容可能已有變化，請以最新公布為準。</p>'
                 + "".join(map(policy_item, arch)) + "</details>")
    s["policy"] = (f'<h2>🏛️ {e(po["title"])}</h2>{body}'
                   f'<div class="source">本部分最後整理：{e(po["asOf"])}（每月 1 號更新）{stale_badge(po.get("reviewBy"), "資料或已過時")}</div>')
    b = D["basics"]
    cards = "".join(f'<div class="stat"><b>{i["icon"]} {e(i["name"])}</b><span>解決：{e(i["solves"])}<br>{e(i["note"])}</span></div>' for i in b["items"])
    tips = "".join(f"<li>{e(t)}</li>" for t in b["tips"])
    s["basics"] = (f'<h2>📚 {e(b["title"])}</h2><div class="grid cols-2">{cards}</div>'
                   f'<ul style="margin:14px 0 0;padding-left:1.2em">{tips}</ul>{source_line(b)}')
    return s, D


def build_insurance(src):
    sections, _ = insurance_sections()
    for sid, inner in sections.items():
        src = src.replace(f'<section class="card" id="{sid}"></section>', f'<section class="card" id="{sid}">{inner}</section>')
    return src


# ------------------------------------------------------------------
# 市場解讀
# ------------------------------------------------------------------
UPDATE_DISCLAIMER = """<div class="disclaimer"><strong>重要提示：</strong>市場解讀只係一般資訊整理，反映撰寫時嘅公開資料，
  不構成任何投資建議，亦唔係買賣任何資產嘅推介。投資涉及風險，過往表現不代表將來。</div>"""


def post_card(p):
    return (f'<a class="card tool-card" href="/updates/{e(p["id"])}/"><span class="badge">{e(p["date"])}</span>'
            f'<h3>{e(p["title"])}</h3><p>{e(p["summary"])}</p><span class="go">閱讀全文 →</span></a>')


def update_page(p):
    hl = "".join(f"<li>{e(h)}</li>" for h in p.get("highlights", []))
    hl_html = f'<section class="card"><h2>本期重點</h2><ul class="tips">{hl}</ul></section>' if hl else ""
    draft = p.get("status") != "published"
    banner = '<div class="sample-banner">📝 草稿：未經審閱，請勿分享或公開。</div>' if draft else ""
    period = f"回顧期 {e(p['period'])}｜" if p.get("period") else ""
    src = f"""<!doctype html>
<html lang="zh-HK">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(p['title'])}｜{BRAND}</title>
  <meta name="description" content="{e(p['summary'])}">
  <meta name="theme-color" content="#0F5C3F">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<main>
  <div class="wrap stack">
    <a href="/updates/">← 所有市場解讀</a>
    {banner}
    <article class="stack">
      <div><span class="badge">{e(p['date'])}</span> <span class="muted" style="font-size:13px">{period}數據截至 {e(p.get('dataAsOf', p['date']))}</span></div>
      <h1>{e(p['title'])}</h1>
      <p>{e(p['summary'])}</p>
      {hl_html}
      <div class="grid cols-2">
        <a class="btn block" href="{e(p['file'])}" target="_blank" rel="noopener">📄 全螢幕開啟 PDF</a>
        <a class="btn secondary block" href="{e(p['file'])}" download>⬇️ 下載 PDF</a>
      </div>
      <div id="pdf-pages" class="stack" data-pdf="{e(p['file'])}"><div class="card center muted">PDF 載入中……</div></div>
    </article>
    {UPDATE_DISCLAIMER}
    <div data-cta></div>
  </div>
</main>
<script type="module" src="/assets/js/updates.js"></script>
</body>
</html>
"""
    ld = [{"@type": "Article", "headline": p["title"], "description": p["summary"], "datePublished": p["date"],
           "inLanguage": "zh-HK", "author": person_ld(),
           "publisher": {"@type": "Organization", "name": BRAND, "logo": {"@type": "ImageObject", "url": f"{SITE_URL}/assets/apple-touch-icon.png"}},
           "image": f"{SITE_URL}/assets/og/updates.png", "mainEntityOfPage": f"{SITE_URL}/updates/{p['id']}/"}]
    return finish_page(src, f"/updates/{p['id']}/", ld, noindex=draft)


def published_posts():
    posts = load("updates.json")["posts"]
    return sorted([p for p in posts if p.get("status") == "published"], key=lambda p: p["date"], reverse=True), posts


# ------------------------------------------------------------------
def main():
    global TOKENS
    TOKENS = tokens()
    DIST.mkdir(exist_ok=True)
    for old in DIST.iterdir():  # 清空內容（唔刪資料夾本身，本機預覽伺服器開住都得）
        shutil.rmtree(old) if old.is_dir() else old.unlink()
    for item in ROOT.iterdir():
        if item.name in EXCLUDE_TOP:
            continue
        if item.is_dir():
            shutil.copytree(item, DIST / item.name, ignore=shutil.ignore_patterns("*.md", "__pycache__"))
        else:
            shutil.copy2(item, DIST / item.name)

    published, all_posts = published_posts()
    pages = []
    for f in sorted(DIST.rglob("index.html")):
        rel = f.relative_to(DIST).parent.as_posix()
        path = "/" if rel == "." else f"/{rel}/"
        src = f.read_text(encoding="utf-8")
        ld = []
        if path == "/":
            latest = published[0] if published else None
            if latest:
                src = re.sub(r'<div id="latest-update"[^>]*>.*?</div>',
                             f'<div id="latest-update">{post_card(latest).replace("card tool-card", "tool-card")}</div>', src, count=1, flags=re.S)
            ld = [{"@type": "WebSite", "name": BRAND, "url": SITE_URL + "/", "inLanguage": "zh-HK"}, person_ld()]
        elif path == "/insurance/":
            src = build_insurance(src)
        elif path == "/updates/":
            cards = "".join(map(post_card, published)) or '<div class="card center muted">第一篇市場解讀準備緊，遲啲再嚟睇 👀</div>'
            src = src.replace("<!--POSTS-->", cards)
        elif path == "/about/":
            ld = [person_ld()]
        f.write_text(finish_page(src, path, ld), encoding="utf-8")
        pages.append(path)

    for p in all_posts:
        out = DIST / "updates" / p["id"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(update_page(p), encoding="utf-8")

    # 404
    nf = DIST / "404.html"
    if nf.exists():
        nf.write_text(finish_page(nf.read_text(encoding="utf-8"), "/404.html", noindex=True), encoding="utf-8")

    # sitemap + robots
    ins = load("insurance.json")["policy"]["asOf"]
    deals = load("deals.json")["updatedOn"]
    lastmod = {"/insurance/": ins, "/deals/": deals, "/updates/": published[0]["date"] if published else TODAY}
    urls = [(p, lastmod.get(p, TODAY)) for p in pages] + [(f"/updates/{p['id']}/", p["date"]) for p in published]
    sm = "".join(f"<url><loc>{SITE_URL}{u}</loc><lastmod>{d}</lastmod></url>" for u, d in urls)
    (DIST / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n', encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    print(f"✅ 已生成 dist/：{len(pages)} 個頁面、{len(all_posts)} 篇市場解讀，網址 {SITE_URL}")


TOKENS = {}
if __name__ == "__main__":
    main()
