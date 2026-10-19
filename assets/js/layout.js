// ============================================================
// 共用版面：頁首、頁尾、免責聲明、預約按鈕、格式化工具
// 加新頁面：喺 NAV 加一行即可。
// ============================================================
import { SITE, igUrl } from './config.js';

export const NAV = [
  { href: '/', label: '首頁' },
  { href: '/goal/', label: '目標計算機' },
  { href: '/health/', label: '健康檢查' },
  { href: '/salary/', label: '月薪分配' },
  { href: '/insurance/', label: '保障資訊' },
  { href: '/updates/', label: '市場解讀' },
  { href: '/market/', label: '市場快訊' },
  { href: '/deals/', label: '優惠回贈' },
  { href: '/book/', label: '預約傾談' },
];

const TOOL_DISCLAIMER = `
  <strong>重要提示：</strong>本工具嘅計算結果僅供參考，不構成任何投資、保險或財務建議。
  所用回報率純屬假設，並非保證回報；投資涉及風險，資產價值可升可跌。
  你輸入嘅資料只會喺你部手機／電腦內計算，<strong>唔會儲存、唔會上傳</strong>。`;

function header() {
  const path = location.pathname.replace(/index\.html$/, '');
  const links = NAV.map(n =>
    `<a href="${n.href}"${path === n.href ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  return `
  <header class="site-header">
    <div class="wrap wide">
      <div class="bar">
        <a class="brand" href="/">
          <span class="brand-mark">理</span>
          <span>${SITE.shortName}<br><small>${SITE.byline}</small></span>
        </a>
        <button class="menu-btn" aria-label="開啟選單" aria-expanded="false" aria-controls="site-nav">☰</button>
        <nav class="nav" id="site-nav">${links}</nav>
      </div>
    </div>
  </header>`;
}

function footer() {
  return `
  <footer class="site-footer">
    <div class="wrap wide">
      <h4>${SITE.name} – ${SITE.byline}</h4>
      <div>IG：<a href="${igUrl}" target="_blank" rel="noopener">@${SITE.ig}</a></div>
      <div class="links">
        ${NAV.slice(1).map(n => `<a href="${n.href}">${n.label}</a>`).join('')}
        <a href="/disclaimer/">免責聲明及私隱政策</a>
      </div>
      <div class="legal">
        <p><strong>免責聲明：</strong>本網站所有工具、文章及資料只作一般教育及參考用途，不構成任何投資、保險、稅務或法律建議，亦非任何產品之要約或招攬。
        工具所用回報率均為假設，並非保證；投資涉及風險，過往表現不代表將來。作任何財務決定前，請按個人情況尋求合適專業意見。
        市場數據及優惠資料整理自所列來源，可能有延遲或已有變動，請以官方最新公布為準。</p>
        <p>© ${new Date().getFullYear()} ${SITE.name}</p>
      </div>
    </div>
  </footer>`;
}

function cta() {
  return `<div class="cta-soft">
    <p>計完都係有啲唔肯定？</p>
    <a href="/book/">想有人幫你睇清楚？預約免費傾談 →</a>
  </div>`;
}

export function mountLayout() {
  document.body.insertAdjacentHTML('afterbegin', header());
  document.body.insertAdjacentHTML('beforeend', footer());
  document.querySelectorAll('[data-disclaimer="tool"]').forEach(el => { el.classList.add('disclaimer'); el.innerHTML = TOOL_DISCLAIMER; });
  document.querySelectorAll('[data-cta]').forEach(el => { el.innerHTML = cta(); });
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '✕' : '☰';
  });
}

// ------------------------------------------------------------
// 工具函數
// ------------------------------------------------------------
const nf0 = new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 0 });
export const money = x => (isFinite(x) ? '$' + nf0.format(Math.round(x)) : '—');
export const pct = (x, d = 0) => (isFinite(x) ? (x * 100).toFixed(d) + '%' : '—');

/** 「X 年 Y 個月」 */
export function ym(months) {
  if (!isFinite(months)) return '達唔到';
  if (months === 0) return '已經達標 🎉';
  const y = Math.floor(months / 12), m = months % 12;
  return (y ? `${y} 年` : '') + (y && m ? ' ' : '') + (m ? `${m} 個月` : '');
}

/** 讀取輸入框數字（容許逗號） */
export function readNum(el) {
  const v = parseFloat(String(el.value).replace(/[,\s$]/g, ''));
  return isFinite(v) ? v : 0;
}

/** 金額輸入框：輸入時自動加千位逗號 */
export function moneyInput(el) {
  el.setAttribute('inputmode', 'numeric');
  el.addEventListener('input', () => {
    const raw = el.value.replace(/[^\d]/g, '');
    el.value = raw ? nf0.format(Number(raw)) : '';
  });
}

export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`讀取 ${path} 失敗`);
  return res.json();
}

/** 今日日期（香港時間）YYYY-MM-DD */
export function todayHK() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong' }).format(new Date());
}

/** 資料係咪過咗「下次檢視日期」 */
export function isStale(reviewBy) {
  return reviewBy && /^\d{4}-\d{2}-\d{2}$/.test(reviewBy) && todayHK() > reviewBy;
}

/** 來源 + 資料日期 + 過期提示 */
export function sourceLine(item) {
  const src = item.sourceUrl
    ? `<a href="${item.sourceUrl}" target="_blank" rel="noopener">${item.source}</a>`
    : (item.source || '');
  const stale = isStale(item.reviewBy)
    ? ' <span class="badge stale">資料或已過時，請以官方最新公布為準</span>' : '';
  return `<div class="source">來源：${src}${item.asOf ? `｜資料截至：${item.asOf}` : ''}${stale}</div>`;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
