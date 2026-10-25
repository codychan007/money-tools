"""
部署時執行：將網站生成到 dist/，令搜尋引擎同 AI 爬蟲唔使行 JavaScript 都讀到內容。

  python scripts/build.py          # 生成 dist/
  SITE_URL=https://example.com python scripts/build.py

做嘅嘢：
  - 中文頁喺根目錄，英文頁喺 en/（同一個結構），頁首有語言切換
  - 每頁加入靜態導覽列、頁尾、免責聲明、預約按鈕、理財體檢進度
  - 每頁加入 canonical、hreflang、Open Graph、favicon、結構化資料（JSON-LD）
  - 計算工具頁：將 {{TOKEN}} 換成強積金法定數字同計算例子，並加入常見問題
  - 保障資訊頁：由 data/insurance.json 直接生成 HTML（英文用 *_en 欄位）
  - 市場解讀：每篇 PDF 生成獨立頁 /updates/<id>/ 同 /en/updates/<id>/
  - 生成 sitemap.xml、robots.txt

只用 Python 標準庫，Cloudflare Pages 可以直接執行。
"""
import datetime as dt
import html
import json
import math
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SITE_URL = (os.environ.get("SITE_URL") or "https://codychan813.pages.dev").rstrip("/")
HKT = dt.timezone(dt.timedelta(hours=8))
TODAY = dt.datetime.now(HKT).date().isoformat()

BYLINE = "By Cody Chan"
IG = "codychan813"
IG_URL = f"https://www.instagram.com/{IG}/"

# 兩種語言嘅網站設定
SITE = {
    "zh": {"prefix": "", "html": "zh-HK", "locale": "zh_HK", "brand": "香港地一站式理財資訊通", "short": "理財資訊通",
           "switch": "EN", "switch_label": "English version", "menu": "開啟選單", "job": "保險理財顧問"},
    "en": {"prefix": "/en", "html": "en", "locale": "en_HK", "brand": "HK Money Compass", "short": "HK Money Compass",
           "switch": "中文", "switch_label": "中文版", "menu": "Open menu", "job": "Insurance and financial planning consultant"},
}
BRAND = SITE["zh"]["brand"]

# 導覽列（路徑唔包括 /en 前綴）。次序同「理財體檢」3 步一樣。
NAV = [
    ("/health/", "健康檢查", "Health check"), ("/salary/", "月薪分配", "Salary"), ("/goal/", "目標計算機", "Goals"),
    ("/insurance/", "保障資訊", "Protection"), ("/updates/", "市場解讀", "Market notes"), ("/market/", "市場快訊", "Markets"),
    ("/deals/", "優惠回贈", "Rebates"), ("/book/", "預約傾談", "Book a chat"),
]
FOOTER_EXTRA = [("/about/", "關於我", "About me"), ("/disclaimer/", "免責聲明及私隱政策", "Disclaimer & privacy")]

# 理財體檢 3 步
JOURNEY = [("health", "健", "健康檢查", "Health check"), ("salary", "薪", "月薪分配", "Salary split"), ("goal", "標", "目標計算", "Goal planner")]

# 每頁用邊張分享圖、邊組常見問題
PAGE_OG = {"/": "home", "/salary/": "salary", "/goal/": "goal", "/health/": "health",
           "/insurance/": "insurance", "/updates/": "updates", "/market/": "market", "/deals/": "deals"}
PAGE_FAQ = {"/salary/": "salary", "/goal/": "goal", "/health/": "health"}
NOINDEX = {"/checkup/"}  # 個人總結頁，冇內容俾搜尋引擎

# 唔會複製到 dist 嘅嘢
EXCLUDE_TOP = {".git", ".github", ".claude", "dist", "scripts", "tests", "netlify.toml", "如何更新內容.md", "__pycache__"}

e = html.escape


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


def money(x):
    return f"${round(x):,}"


def lang_of(path):
    return "en" if path == "/en/" or path.startswith("/en/") else "zh"


def base_path(path):
    """/en/goal/ → /goal/；中文路徑不變"""
    return path[3:] if lang_of(path) == "en" else path


def url_for(base, lang):
    return SITE[lang]["prefix"] + base


def L(obj, key, lang):
    """英文頁用 key_en，冇就用中文"""
    if lang == "en" and obj.get(f"{key}_en") not in (None, "", []):
        return obj[f"{key}_en"]
    return obj.get(key)


# ------------------------------------------------------------------
# 計算（同 assets/js/finance.js 一樣嘅公式，用嚟生成靜態例子）
# ------------------------------------------------------------------
def monthly_rate(r):
    return (1 + r) ** (1 / 12) - 1


def months_to_goal(target, savings, monthly, r):
    if savings >= target:
        return 0
    i = monthly_rate(r)
    if i == 0:
        return math.ceil((target - savings) / monthly) if monthly > 0 else None
    n = math.log((target * i + monthly) / (savings * i + monthly)) / math.log(1 + i)
    return math.ceil(round(n * 1e9) / 1e9)


def ym(months, lang="zh"):
    y, m = divmod(months, 12)
    if lang == "en":
        parts = ([f"{y} year{'s' if y > 1 else ''}"] if y else []) + ([f"{m} month{'s' if m > 1 else ''}"] if m else [])
        return " ".join(parts)
    return (f"{y} 年" if y else "") + (" " if y and m else "") + (f"{m} 個月" if m else "")


def tokens(lang):
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
        rows.append(f"<tr><td>{r * 100:g}%</td><td>{ym(n, lang)}</td><td>{money(30000 + 5000 * n)}</td></tr>")
    t["GOAL_TABLE"] = "".join(rows)
    t["INFL_DEFAULT"] = f'{load("insurance.json")["medicalInflation"]["defaultRate"]:g}'
    return t


# ------------------------------------------------------------------
# 共用版面
# ------------------------------------------------------------------
def seal(ch, cls=""):
    return f'<span class="seal{(" " + cls) if cls else ""}" aria-hidden="true">{e(ch)}</span>'


def header(path):
    lang = lang_of(path)
    S, base = SITE[lang], base_path(path)
    other = "en" if lang == "zh" else "zh"
    current = ' aria-current="page"'
    on = lambda h: h == base or (h != "/" and base.startswith(h))  # 文章頁都標示「市場解讀」
    links = "".join(
        f'<a href="{url_for(h, lang)}"{current if on(h) else ""}{" class=\"nav-book\"" if h == "/book/" else ""}>'
        f'{e(zh if lang == "zh" else en)}</a>' for h, zh, en in NAV)
    return f"""
<header class="site-header">
  <div class="wrap wide">
    <div class="bar">
      <a class="brand" href="{url_for('/', lang)}">
        {seal("理", "sm brand-mark")}
        <span>{e(S["short"])}<br><small>{BYLINE}</small></span>
      </a>
      <nav class="nav" id="site-nav">{links}</nav>
      <div class="head-tools">
        <a class="lang-switch" href="{url_for(base, other)}" hreflang="{SITE[other]['html']}" lang="{SITE[other]['html']}" aria-label="{e(S['switch_label'])}">{e(S["switch"])}</a>
        <button class="menu-btn" aria-label="{e(S['menu'])}" aria-expanded="false" aria-controls="site-nav">☰</button>
      </div>
    </div>
  </div>
</header>"""


FOOTER_LEGAL = {
    "zh": """<p><strong>免責聲明：</strong>本網站所有工具、文章及資料只作一般教育及參考用途，不構成任何投資、保險、稅務或法律建議，亦非任何產品之要約或招攬。
      工具所用回報率均為假設，並非保證；投資涉及風險，過往表現不代表將來。作任何財務決定前，請按個人情況尋求合適專業意見。
      市場數據及優惠資料整理自所列來源，可能有延遲或已有變動，請以官方最新公布為準。</p>""",
    "en": """<p><strong>Disclaimer:</strong> All tools, articles and information on this website are for general education and reference only.
      They are not investment, insurance, tax or legal advice, and are not an offer or solicitation for any product.
      Rates of return used in the tools are assumptions, not guarantees; investment involves risk and past performance is not indicative of future results.
      Please get suitable professional advice for your own situation before making any financial decision. Market data and card offers are compiled from the sources listed,
      may be delayed or out of date, and the latest official announcements prevail. Where the English and Chinese versions differ, the Chinese version prevails.</p>""",
}


def footer(lang):
    S = SITE[lang]
    links = "".join(f'<a href="{url_for(h, lang)}">{e(zh if lang == "zh" else en)}</a>' for h, zh, en in NAV + FOOTER_EXTRA)
    return f"""
<footer class="site-footer">
  <div class="wrap wide">
    <h4>{seal("理", "sm")} {e(S["brand"])} – {BYLINE}</h4>
    <div>IG: <a href="{IG_URL}" target="_blank" rel="noopener">@{IG}</a></div>
    <div class="links">{links}</div>
    <div class="legal">
      {FOOTER_LEGAL[lang]}
      <p>© {TODAY[:4]} {e(S["brand"])}</p>
    </div>
  </div>
</footer>"""


TOOL_DISCLAIMER = {
    "zh": """<div class="disclaimer" data-disclaimer="tool">
  <strong>重要提示：</strong>本工具嘅計算結果僅供參考，不構成任何投資、保險或財務建議。
  所用回報率純屬假設，並非保證回報；投資涉及風險，資產價值可升可跌。
  你輸入嘅資料只會喺你部手機／電腦內計算，<strong>唔會上傳</strong>。為咗「理財體檢」可以接住上一步，部分結果只會儲存喺你自己嘅瀏覽器，隨時可以喺<a href="/checkup/">總結頁</a>清除。</div>""",
    "en": """<div class="disclaimer" data-disclaimer="tool">
  <strong>Important:</strong> Results from this tool are for reference only and are not investment, insurance or financial advice.
  Rates of return are assumptions, not guarantees; investment involves risk and values can go down as well as up.
  What you enter is calculated on your own phone or computer and is <strong>never uploaded</strong>. So the check-up can carry on from the last step,
  some results are saved in your own browser only, and you can erase them any time on the <a href="/en/checkup/">summary page</a>.</div>""",
}

CTA = {
    "zh": """<div data-cta><div class="cta-seal">
  <p class="cta-lead">計完，想有人同你一齊睇清楚？</p>
  <p class="cta-sub">傾下你嘅目標同疑問，冇購買責任。</p>
  <a class="cta-btn" href="/book/">預約 1 對 1 理財傾談 <span class="arrow">→</span></a>
  <p class="cta-fine">WhatsApp・電話・Google 日曆，揀你方便嘅</p>
</div></div>""",
    "en": """<div data-cta><div class="cta-seal">
  <p class="cta-lead">Want someone to go through the numbers with you?</p>
  <p class="cta-sub">Talk through your goals and questions. No obligation to buy anything.</p>
  <a class="cta-btn" href="/en/book/">Book a 1-on-1 money chat <span class="arrow">→</span></a>
  <p class="cta-fine">WhatsApp, phone or Google Calendar, whichever suits you</p>
</div></div>""",
}


def journey_bar(current, lang):
    head = {"zh": ("理財體檢 3 步", "完成 0 / 3"), "en": ("3-step money check-up", "0 of 3 done")}[lang]
    steps = []
    for n, (key, ch, zh, en) in enumerate(JOURNEY, 1):
        cur = ' aria-current="step"' if key == current else ""
        steps.append(f'<a class="step" href="{url_for(f"/{key}/", lang)}" data-step="{key}"{cur}>'
                     f'{seal(ch, "empty")}<span>{n}. {e(zh if lang == "zh" else en)}</span></a>')
    return (f'<nav class="journey-wrap" aria-label="{e(head[0])}"><div class="journey-head"><b>{e(head[0])}</b>'
            f'<span data-journey-count>{e(head[1])}</span></div><div class="journey">{"".join(steps)}</div></nav>')


def person_ld(lang="zh"):
    return {"@type": "Person", "name": "Cody Chan", "url": f"{SITE_URL}{url_for('/about/', lang)}", "sameAs": [IG_URL],
            "jobTitle": SITE[lang]["job"]}


FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+HK:wght@400;700&family=Noto+Serif+HK:wght@600;700&display=swap">')


def head_extra(path, title, desc, og_key, ld, noindex=False):
    lang = lang_of(path)
    base = base_path(path)
    url = SITE_URL + path
    img = f"{SITE_URL}/assets/og/{og_key}{'-en' if lang == 'en' else ''}.png"
    parts = [
        FONTS,
        f'<link rel="canonical" href="{url}">',
        f'<link rel="alternate" hreflang="zh-HK" href="{SITE_URL}{url_for(base, "zh")}">',
        f'<link rel="alternate" hreflang="en" href="{SITE_URL}{url_for(base, "en")}">',
        f'<link rel="alternate" hreflang="x-default" href="{SITE_URL}{url_for(base, "zh")}">',
        '<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">',
        '<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">',
        f'<meta property="og:site_name" content="{e(SITE[lang]["brand"])}">',
        f'<meta property="og:locale" content="{SITE[lang]["locale"]}">',
        f'<meta property="og:type" content="{"article" if base.startswith("/updates/") and base != "/updates/" else "website"}">',
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


def fill(text, lang):
    for k, v in TOKENS[lang].items():
        text = text.replace("{{" + k + "}}", v)
    return text


def faq_html_and_ld(key, lang):
    name = "faq.json" if lang == "zh" else "faq.en.json"
    items = json.loads(fill((ROOT / "content" / name).read_text(encoding="utf-8"), lang))[key]
    body = "".join(
        f'<details class="faq"><summary>{e(q["q"])}</summary><p>{q["a"]}</p></details>' for q in items)
    title = "常見問題" if lang == "zh" else "Frequently asked questions"
    section = f'<section class="card"><h2>{title}</h2>{body}</section>'
    ld = {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q["q"],
         "acceptedAnswer": {"@type": "Answer", "text": re.sub(r"<[^>]+>", "", q["a"])}} for q in items]}
    return section, ld


def finish_page(src, path, extra_ld=None, noindex=False):
    """將來源 HTML 變成完整靜態頁"""
    lang = lang_of(path)
    base = base_path(path)
    title = re.search(r"<title>(.*?)</title>", src, re.S).group(1).strip()
    m = re.search(r'<meta name="description" content="([^"]*)"', src)
    desc = html.unescape(m.group(1)) if m else ""
    ld = list(extra_ld or [])

    src = fill(src, lang)
    if base in PAGE_FAQ and "<!--FAQ-->" in src:
        section, faq_ld = faq_html_and_ld(PAGE_FAQ[base], lang)
        src = src.replace("<!--FAQ-->", section)
        ld.append(faq_ld)

    src = src.replace('<div data-disclaimer="tool"></div>', TOOL_DISCLAIMER[lang])
    src = src.replace("<div data-cta></div>", CTA[lang])
    src = re.sub(r'<div data-journey="(\w*)"></div>', lambda mm: journey_bar(mm.group(1), lang), src)
    src = re.sub(r'<span data-seal="(.)"></span>', lambda mm: seal(mm.group(1), "sm"), src)
    src = re.sub(r'<meta name="theme-color" content="[^"]*">', '<meta name="theme-color" content="#F3ECDD">', src)
    og_key = PAGE_OG.get(base, "updates" if base.startswith("/updates/") else "home")
    src = src.replace('<link rel="stylesheet" href="/assets/css/style.css">',
                      '<link rel="stylesheet" href="/assets/css/style.css">\n  ' +
                      head_extra(path, title, desc, og_key, ld, noindex or base in NOINDEX), 1)
    src = src.replace("<body>", "<body>" + header(path), 1)
    src = src.replace("</main>", "</main>" + footer(lang), 1)
    leftover = re.findall(r"\{\{[A-Z_]+\}\}", src)
    if leftover:
        raise SystemExit(f"{path}：未替換嘅 token {leftover}")
    return src


# ------------------------------------------------------------------
# 保障資訊頁
# ------------------------------------------------------------------
TXT = {
    "zh": {"source": "來源：", "asof": "｜資料截至：", "stale": "資料或已過時，請以官方最新公布為準", "stale_short": "資料或已過時",
           "see_also": "另見：", "fees_head": ("項目", "收費", "備註"), "costs_head": ("手術", "醫院", "P50", "P90", "資料期"),
           "tip_private": "小貼士：入院前可以要求醫院提供書面費用預算，亦可以喺醫院網站搵「過往收費統計」比較。",
           "no_policy": "最近三個月未有新嘅重要醫療政策。", "archive": "過往政策更新",
           "archive_note": "以下係較早嘅政策消息，部分內容可能已有變化，請以最新公布為準。",
           "policy_asof": "本部分最後整理：{d}（每月 1 號更新）", "solves": "解決："},
    "en": {"source": "Source: ", "asof": " | Data as of: ", "stale": "May be out of date; the latest official figures prevail", "stale_short": "May be out of date",
           "see_also": "See also: ", "fees_head": ("Item", "Fee", "Notes"), "costs_head": ("Procedure", "Hospital", "P50", "P90", "Period"),
           "tip_private": "Tip: before admission you can ask the hospital for a written fee estimate, and compare the “historical bill statistics” on hospital websites.",
           "no_policy": "No major new healthcare policy in the last three months.", "archive": "Earlier policy updates",
           "archive_note": "These are older policy updates; some details may have changed since. The latest announcements prevail.",
           "policy_asof": "This section last reviewed: {d} (updated on the 1st of each month)", "solves": "Covers: "},
}


def a(url, text):
    return f'<a href="{e(url)}" target="_blank" rel="noopener">{e(text)}</a>'


def stale_badge(review_by, text):
    # 空白佔位：由瀏覽器按當日日期決定要唔要加入提示文字（insurance.js），
    # 咁爬蟲唔會誤讀一段隱藏嘅「過時」字眼
    return f' <span class="badge stale" data-review-by="{e(review_by or "")}" data-stale-text="{e(text)}" hidden></span>' if review_by else ""


def source_line(it, lang):
    T = TXT[lang]
    src_name = L(it, "source", lang)
    src = a(L(it, "sourceUrl", lang), src_name) if it.get("sourceUrl") else e(src_name or "")
    asof = f"{T['asof']}{e(L(it, 'asOf', lang))}" if it.get("asOf") else ""
    return f'<div class="source">{T["source"]}{src}{asof}{stale_badge(it.get("reviewBy"), T["stale"])}</div>'


def stat_cards(items, lang):
    out = []
    for it in items:
        sub = f"<span>{e(L(it, 'sub', lang))}</span>" if it.get("sub") else ""
        src = source_line(it, lang) if it.get("source") else ""
        out.append(f'<div class="stat"><span>{e(L(it, "label", lang))}</span>'
                   f'<b class="num" style="font-size:1.5rem">{e(L(it, "value", lang))}</b>{sub}{src}</div>')
    return f'<div class="grid cols-2">{"".join(out)}</div>'


def extra_sources(lst, lang):
    sep = "、" if lang == "zh" else ", "
    return sep.join(a(L(s, "url", lang), L(s, "name", lang)) for s in lst or [])


def policy_item(it, lang):
    pts = "".join(f"<li>{e(p)}</li>" for p in L(it, "points", lang))
    return (f'<div class="policy-item"><span class="badge">{e(it["date"])}</span><h3>{e(L(it, "title", lang))}</h3>'
            f'<ul>{pts}</ul><div class="source">{TXT[lang]["source"]}{a(L(it, "sourceUrl", lang), L(it, "source", lang))}</div></div>')


def insurance_sections(lang):
    D = load("insurance.json")
    T = TXT[lang]
    s = {}
    mi = D["medicalInflation"]
    s["inflation"] = (f'<h2>{e(L(mi, "title", lang))}</h2>{stat_cards(mi["items"], lang)}'
                      f'<p class="muted" style="font-size:13px;margin:12px 0 0">{e(L(mi, "note", lang))}</p>')
    pf = D["publicFees"]
    rows = "".join(f'<tr><td>{e(r[0])}</td><td class="num"><b>{e(r[1])}</b></td>'
                   f'<td style="text-align:left;font-size:13px">{e(r[2])}</td></tr>' for r in L(pf, "rows", lang))
    h = T["fees_head"]
    s["public-fees"] = (f'<h2>{e(L(pf, "title", lang))}</h2><p>{e(L(pf, "intro", lang))}</p>'
                        f'<div class="table-scroll"><table class="data wrap-cells"><tr><th>{h[0]}</th><th>{h[1]}</th><th>{h[2]}</th></tr>{rows}</table></div>'
                        f'{source_line(pf, lang)}' + (f'<div class="source">{T["see_also"]}{extra_sources(pf.get("extraSources"), lang)}</div>' if pf.get("extraSources") else ""))
    pc = D["privateCosts"]
    filled = [r for r in pc.get("table", []) if r.get("p50") and "【" not in r.get("procedure", "")]
    table = ""
    if filled:
        h = T["costs_head"]
        trs = "".join(f'<tr><td>{a(r["sourceUrl"], L(r, "procedure", lang)) if r.get("sourceUrl") else e(L(r, "procedure", lang))}</td>'
                      f'<td>{e(L(r, "hospital", lang))}</td><td>{e(r["p50"])}</td><td>{e(r.get("p90", ""))}</td><td>{e(r["period"])}</td></tr>' for r in filled)
        table = (f'<div class="table-scroll" style="margin-top:12px"><table class="data"><tr><th>{h[0]}</th><th>{h[1]}</th><th>{h[2]}</th>'
                 f'<th>{h[3]}</th><th>{h[4]}</th></tr>{trs}</table></div>')
    s["private-costs"] = (f'<h2>{e(L(pc, "title", lang))}</h2><p>{e(L(pc, "intro", lang))}</p>{stat_cards(pc["highlights"], lang)}{table}'
                          f'<p class="muted" style="font-size:13px;margin:12px 0 0">{T["tip_private"]}</p>')
    ca = D["cancer"]
    s["cancer"] = (f'<h2>{e(L(ca, "title", lang))}</h2>{stat_cards(ca["items"], lang)}{source_line(ca, lang)}' +
                   (f'<div class="source">{T["see_also"]}{extra_sources(ca.get("extraSources"), lang)}</div>' if ca.get("extraSources") else ""))
    po = D["policy"]
    items = sorted(po.get("items", []), key=lambda x: x["date"], reverse=True)
    arch = sorted(po.get("archive", []), key=lambda x: x["date"], reverse=True)
    body = "".join(policy_item(i, lang) for i in items) if items else f'<p class="muted">{T["no_policy"]}</p>'
    if arch:
        body += ('<details style="margin-top:8px"><summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">'
                 f'{T["archive"]} ({len(arch)})</summary><p class="muted" style="font-size:13px;margin:4px 0 0">{T["archive_note"]}</p>'
                 + "".join(policy_item(i, lang) for i in arch) + "</details>")
    s["policy"] = (f'<h2>{e(L(po, "title", lang))}</h2>{body}'
                   f'<div class="source">{T["policy_asof"].format(d=e(po["asOf"]))}{stale_badge(po.get("reviewBy"), T["stale_short"])}</div>')
    b = D["basics"]
    cards = "".join(f'<div class="stat"><b>{e(L(i, "name", lang))}</b><span>{T["solves"]}{e(L(i, "solves", lang))}<br>{e(L(i, "note", lang))}</span></div>'
                    for i in b["items"])
    tips = "".join(f"<li>{e(t)}</li>" for t in L(b, "tips", lang))
    s["basics"] = (f'<h2>{e(L(b, "title", lang))}</h2><div class="grid cols-2">{cards}</div>'
                   f'<ul style="margin:14px 0 0;padding-left:1.2em">{tips}</ul>{source_line(b, lang)}')
    return s


def build_insurance(src, lang):
    for sid, inner in insurance_sections(lang).items():
        src = src.replace(f'<section class="card" id="{sid}"></section>', f'<section class="card" id="{sid}">{inner}</section>')
    return src


# ------------------------------------------------------------------
# 市場解讀
# ------------------------------------------------------------------
UPD = {
    "zh": {"disclaimer": """<div class="disclaimer"><strong>重要提示：</strong>市場解讀只係一般資訊整理，反映撰寫時嘅公開資料，
  不構成任何投資建議，亦唔係買賣任何資產嘅推介。投資涉及風險，過往表現不代表將來。</div>""",
           "read": "閱讀全文 →", "back": "← 所有市場解讀", "draft": "草稿：未經審閱，請勿分享或公開。", "period": "回顧期 {p}｜",
           "asof": "數據截至 {d}", "highlights": "本期重點", "open": "全螢幕開啟 PDF", "download": "下載 PDF", "loading": "PDF 載入中……",
           "pdf_note": "", "empty": "第一篇市場解讀準備緊，遲啲再嚟睇。"},
    "en": {"disclaimer": """<div class="disclaimer"><strong>Important:</strong> Market notes are a general summary of public information at the time of writing.
  They are not investment advice or a recommendation to buy or sell any asset. Investment involves risk; past performance is not indicative of future results.</div>""",
           "read": "Read more →", "back": "← All market notes", "draft": "Draft: not yet reviewed. Please don't share.", "period": "Covering {p} | ",
           "asof": "Data as of {d}", "highlights": "Key points", "open": "Open the PDF", "download": "Download the PDF", "loading": "Loading the PDF…",
           "pdf_note": '<div class="lang-note">The full report (PDF) is written in Chinese. The key points above are in English.</div>',
           "empty": "The first market note is on its way. Check back soon."},
}


def post_card(p, lang):
    href = url_for(f"/updates/{p['id']}/", lang)
    return (f'<a class="card tool-card" href="{href}"><span class="badge">{e(p["date"])}</span>'
            f'<h3>{e(L(p, "title", lang))}</h3><p>{e(L(p, "summary", lang))}</p><span class="go">{UPD[lang]["read"]}</span></a>')


def update_page(p, lang):
    U = UPD[lang]
    S = SITE[lang]
    hl = "".join(f"<li>{e(h)}</li>" for h in (L(p, "highlights", lang) or []))
    hl_html = f'<section class="card"><h2>{U["highlights"]}</h2><ul class="tips">{hl}</ul></section>' if hl else ""
    draft = p.get("status") != "published"
    banner = f'<div class="sample-banner">{U["draft"]}</div>' if draft else ""
    period_txt = L(p, "period", lang) or ""
    if lang == "en" and not p.get("period_en"):
        period_txt = period_txt.replace(" 至 ", " to ")
    period = U["period"].format(p=e(period_txt)) if period_txt else ""
    title = L(p, "title", lang)
    summary = L(p, "summary", lang)
    sep = "｜" if lang == "zh" else " | "
    src = f"""<!doctype html>
<html lang="{S['html']}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(title)}{sep}{e(S['brand'])}</title>
  <meta name="description" content="{e(summary)}">
  <meta name="theme-color" content="#F3ECDD">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<main>
  <div class="wrap stack">
    <a href="{url_for('/updates/', lang)}">{U['back']}</a>
    {banner}
    <article class="stack">
      <div><span class="badge">{e(p['date'])}</span> <span class="muted" style="font-size:13px">{period}{U['asof'].format(d=e(p.get('dataAsOf', p['date'])))}</span></div>
      <h1>{e(title)}</h1>
      <p>{e(summary)}</p>
      {hl_html}
      {U['pdf_note']}
      <div class="grid cols-2">
        <a class="btn block" href="{e(p['file'])}" target="_blank" rel="noopener">{U['open']}</a>
        <a class="btn secondary block" href="{e(p['file'])}" download>{U['download']}</a>
      </div>
      <div id="pdf-pages" class="stack" data-pdf="{e(p['file'])}"><div class="card center muted">{U['loading']}</div></div>
    </article>
    {U['disclaimer']}
    <div data-cta></div>
  </div>
</main>
<script type="module" src="/assets/js/updates.js"></script>
</body>
</html>
"""
    path = url_for(f"/updates/{p['id']}/", lang)
    ld = [{"@type": "Article", "headline": title, "description": summary, "datePublished": p["date"],
           "inLanguage": S["html"], "author": person_ld(lang),
           "publisher": {"@type": "Organization", "name": S["brand"], "logo": {"@type": "ImageObject", "url": f"{SITE_URL}/assets/apple-touch-icon.png"}},
           "image": f"{SITE_URL}/assets/og/updates{'-en' if lang == 'en' else ''}.png", "mainEntityOfPage": f"{SITE_URL}{path}"}]
    return finish_page(src, path, ld, noindex=draft)


def published_posts():
    posts = load("updates.json")["posts"]
    for p in posts:
        if p.get("status") == "published" and not (p.get("title_en") and p.get("summary_en")):
            print(f"⚠️ 市場解讀 {p['id']} 未有英文 title_en／summary_en，英文頁會暫時用中文")
    return sorted([p for p in posts if p.get("status") == "published"], key=lambda p: p["date"], reverse=True), posts


# ------------------------------------------------------------------
def main():
    global TOKENS
    TOKENS = {lang: tokens(lang) for lang in SITE}
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
        lang, base = lang_of(path), base_path(path)
        src = f.read_text(encoding="utf-8")
        ld = []
        if base == "/":
            latest = published[0] if published else None
            if latest:
                src = re.sub(r'<div id="latest-update"[^>]*>.*?</div>',
                             f'<div id="latest-update">{post_card(latest, lang)}</div>', src, count=1, flags=re.S)
            ld = [{"@type": "WebSite", "name": SITE[lang]["brand"], "url": SITE_URL + url_for("/", lang), "inLanguage": SITE[lang]["html"]},
                  person_ld(lang)]
        elif base == "/insurance/":
            src = build_insurance(src, lang)
        elif base == "/updates/":
            cards = "".join(post_card(p, lang) for p in published) or f'<div class="card center muted">{UPD[lang]["empty"]}</div>'
            src = src.replace("<!--POSTS-->", cards)
        elif base == "/about/":
            ld = [person_ld(lang)]
        f.write_text(finish_page(src, path, ld), encoding="utf-8")
        if base not in NOINDEX:
            pages.append(path)

    for p in all_posts:
        for lang in SITE:
            out = DIST / url_for(f"/updates/{p['id']}/", lang).strip("/") / "index.html"
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(update_page(p, lang), encoding="utf-8")

    # 404（中英對照）
    nf = DIST / "404.html"
    if nf.exists():
        nf.write_text(finish_page(nf.read_text(encoding="utf-8"), "/404.html", noindex=True), encoding="utf-8")

    # sitemap + robots
    ins = load("insurance.json")["policy"]["asOf"]
    deals = load("deals.json")["updatedOn"]
    lastmod = {"/insurance/": ins, "/deals/": deals, "/updates/": published[0]["date"] if published else TODAY}
    urls = [(p, lastmod.get(base_path(p), TODAY)) for p in pages]
    urls += [(url_for(f"/updates/{p['id']}/", lang), p["date"]) for p in published for lang in SITE]
    sm = "".join(f"<url><loc>{SITE_URL}{u}</loc><lastmod>{d}</lastmod></url>" for u, d in urls)
    (DIST / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>\n', encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    print(f"✅ 已生成 dist/：{len(pages)} 個頁面（中英）、{len(all_posts)} 篇市場解讀，網址 {SITE_URL}")


TOKENS = {}
if __name__ == "__main__":
    main()
