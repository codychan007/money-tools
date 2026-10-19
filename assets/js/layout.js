// ============================================================
// 共用版面同格式化工具
// 頁首、頁尾、免責聲明、預約按鈕已經由 scripts/build.py 直接寫入 HTML
// （改導覽列：改 build.py 入面嘅 NAV）。呢度只負責手機選單開關。
// ============================================================

export function mountLayout() {
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
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
