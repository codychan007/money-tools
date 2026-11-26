// ============================================================
// 共用版面同格式化工具
// 頁首、頁尾、免責聲明、預約按鈕已經由 scripts/build.py 直接寫入 HTML
// （改導覽列：改 build.py 入面嘅 NAV）。呢度只負責手機選單開關同理財體檢進度。
// ============================================================
import { t } from './i18n.js';
import { paintJourney, doneCount } from './journey.js';
import { showPendingUnlock } from './unlock.js';

export function mountLayout() {
  paintJourney();
  showPendingUnlock();
  mountNavGroup();
  mountAvatarEgg();
  keepFocusedFieldVisible();
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '✕' : '☰';
  });
}

/**
 * 手機鍵盤開住時，將聚焦中嘅輸入框留喺可見區入面。
 *
 * 健康檢查撳「下一題」會再聚焦新輸入框。Chrome / Samsung 預設只縮視覺視窗，
 * 再加 body overflow-x:hidden 變成捲動容器，瀏覽器就會將頁面捲返頂欄，
 * 輸入框掉落鍵盤下面。viewport 用 interactive-widget=resizes-content 縮版面視窗，
 * 呢度再跟 visualViewport 補一次，鍵盤動畫同「捲去頁頂」都拉得返。
 */
const NON_TEXT_INPUT = new Set(['hidden', 'checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'image', 'color']);
let keyboardPinReady = false;
let pinGen = 0;
let pinTimers = [];
let pinScrollHandler = null;
let revealing = false;

function editingField(el) {
  if (!(el instanceof HTMLElement) || el.disabled || el.readOnly) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !NON_TEXT_INPUT.has((el.type || 'text').toLowerCase());
}

/** 視覺區喺 client 座標入面嘅頂同底（留少少空隙） */
function visibleFrame() {
  const pad = 12;
  const vv = window.visualViewport;
  if (!vv) return { top: pad, bottom: window.innerHeight - pad };
  // resizes-content 或者鍵盤未開：offset ≈ 0，client rect 同視覺區同一原點。
  if (Math.abs(vv.offsetTop) < 1 && Math.abs(vv.offsetLeft) < 1) return { top: pad, bottom: vv.height - pad };
  // resizes-visual（iOS、舊版）：fixed 頂部嘅 client Y + offsetTop = 視覺區頂。
  // layout 相對嘅 rect：probeTop = 0；visual 相對、fixed 相對 layout：probeTop = -offsetTop。
  let probe = document.getElementById('kb-pin-probe');
  if (!probe) {
    probe = document.createElement('div');
    probe.id = 'kb-pin-probe';
    probe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(probe);
  }
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;visibility:hidden';
  const origin = probe.getBoundingClientRect().top + vv.offsetTop;
  return { top: origin + pad, bottom: origin + vv.height - pad };
}

/** 輸入框下面嘅下一步掣。可見區夠位先一併留出，否則只保住輸入框。 */
function followHeight(el, frame) {
  const root = el.closest('.card, .wizard');
  const nav = root?.querySelector('.q-nav, [data-next]');
  if (!nav) return 0;
  const gap = nav.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
  if (gap < 8) return 0;
  const tail = Math.min(72, gap);
  if (frame.bottom - frame.top - tail < el.getBoundingClientRect().height + 8) return 0;
  return tail;
}

function revealField(el) {
  if (revealing) return;
  const frame = visibleFrame();
  const rect = el.getBoundingClientRect();
  const bottom = frame.bottom - followHeight(el, frame);
  let top = frame.top;
  const header = document.querySelector('.site-header');
  if (header) {
    const hr = header.getBoundingClientRect();
    // 頂欄貼住視覺區頂部，而且欄位連頂欄都放得落，先讓出頂欄。否則優先保住輸入框。
    if (hr.top < frame.top + 1 && hr.bottom > frame.top && bottom - hr.bottom > rect.height + 8) {
      top = Math.max(top, hr.bottom + 8);
    }
  }
  let delta = 0;
  if (rect.bottom > bottom) delta = rect.bottom - bottom;
  else if (rect.top < top) delta = rect.top - top;
  if (Math.abs(delta) < 2) return;
  const before = window.scrollY;
  revealing = true;
  window.scrollBy(0, delta);
  revealing = false;
  if (Math.abs(window.scrollY - before) >= 1 || delta <= 0) return;
  // 頁尾冇位再捲：補一段空白，先至捲到鍵盤上面。已經補過就唔好再捲，避免捲動事件打轉。
  const extra = Math.ceil(delta) + 16;
  const cur = parseInt(document.body.style.paddingBottom, 10) || 0;
  if (extra <= cur) return;
  document.body.style.paddingBottom = `${extra}px`;
  revealing = true;
  window.scrollBy(0, delta);
  revealing = false;
}

function disarmPin() {
  pinTimers.forEach(clearTimeout);
  pinTimers = [];
  if (pinScrollHandler) {
    window.removeEventListener('scroll', pinScrollHandler);
    window.visualViewport?.removeEventListener('scroll', pinScrollHandler);
    pinScrollHandler = null;
  }
}

function armPin() {
  disarmPin();
  const gen = ++pinGen;
  const pin = () => {
    if (gen !== pinGen || revealing) return;
    const el = document.activeElement;
    if (editingField(el)) revealField(el);
  };
  pin();
  pinScrollHandler = () => pin();
  window.addEventListener('scroll', pinScrollHandler, { passive: true });
  window.visualViewport?.addEventListener('scroll', pinScrollHandler, { passive: true });
  pinTimers = [60, 180, 360, 700].map(ms => setTimeout(pin, ms));
  pinTimers.push(setTimeout(() => { if (gen === pinGen) disarmPin(); }, 900));
}

function keepFocusedFieldVisible() {
  if (keyboardPinReady) return;
  keyboardPinReady = true;
  document.addEventListener('focusin', e => { if (editingField(e.target)) armPin(); });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (editingField(document.activeElement)) return;
      disarmPin();
      document.body.style.paddingBottom = '';
    }, 0);
  });
  const onResize = () => { if (editingField(document.activeElement)) armPin(); };
  window.visualViewport?.addEventListener('resize', onResize);
  // resizes-content 會縮版面視窗，window resize 同 visualViewport resize 都會響。兩個都聽。
  window.addEventListener('resize', onResize);
}

/** 「實用資訊欄」：撳開彈出資訊頁；撳外面或者按 Esc 收埋 */
function mountNavGroup() {
  const group = document.querySelector('.nav-group');
  const btn = group?.querySelector('.nav-group-btn');
  if (!btn) return;
  const set = open => { group.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', e => { e.stopPropagation(); set(!group.classList.contains('open')); });
  document.addEventListener('click', e => { if (!group.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && group.classList.contains('open')) { set(false); btn.focus(); } });
}

// ------------------------------------------------------------
// 工具函數
// ------------------------------------------------------------
const nf0 = new Intl.NumberFormat('zh-HK', { maximumFractionDigits: 0 });
export const money = x => (isFinite(x) ? '$' + nf0.format(Math.round(x)) : '—');
export const pct = (x, d = 0) => (isFinite(x) ? (x * 100).toFixed(d) + '%' : '—');

/** 「X 年 Y 個月」 */
export function ym(months) {
  if (!isFinite(months)) return t('達唔到', 'Not reachable');
  if (months === 0) return t('已經達標', 'Already there');
  const y = Math.floor(months / 12), m = months % 12;
  return t(
    (y ? `${y} 年` : '') + (y && m ? ' ' : '') + (m ? `${m} 個月` : ''),
    [y ? `${y} year${y > 1 ? 's' : ''}` : '', m ? `${m} month${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' '));
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
  if (!res.ok) throw new Error(t(`讀取 ${path} 失敗`, `Could not load ${path}`));
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
    ? ` <span class="badge stale">${t('資料或已過時，請以官方最新公布為準', 'May be out of date; the latest official figures prevail')}</span>` : '';
  return `<div class="source">${t('來源：', 'Source: ')}${src}${item.asOf ? `${t('｜資料截至：', ' | Data as of: ')}${item.asOf}` : ''}${stale}</div>`;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 頭像彩蛋：電腦滑鼠擺上去／手機撳一下 → 揮手（CSS）+ 對話泡泡隨機講一句 */
const HELLO = [
  ['Hi！我係 Cody 👋', 'Hi! I’m Cody 👋'],
  ['嗨～有咩理財問題，隨時搵我傾 👋', 'Hey! Any money questions, come and chat 👋'],
  ['俾你發現咗 😆 Hi，我係 Cody！', 'You found me 😆 Hi, I’m Cody!'],
  ['你做晒理財體檢未呀？未就做埋先啦 😉', 'Done the money check-up yet? Give it a go 😉', 'checkup'],
];
let lastHello = -1;
function pickHello() {
  // 做晒 3 步嘅人就唔再叫佢做體檢
  const done = doneCount() >= 3;
  const pool = HELLO.map((h, i) => i).filter(i => i !== lastHello && !(done && HELLO[i][2] === 'checkup'));
  lastHello = pool[Math.floor(Math.random() * pool.length)];
  return t(HELLO[lastHello][0], HELLO[lastHello][1]);
}

function mountAvatarEgg() {
  const canHover = matchMedia('(hover: hover)').matches;
  document.querySelectorAll('.frame[data-egg]').forEach(f => {
    const bubble = document.createElement('span');
    bubble.className = 'hello-bubble'; bubble.setAttribute('role', 'status');
    f.appendChild(bubble);
    let timer;
    const show = () => {
      bubble.textContent = pickHello();
      bubble.style.removeProperty('--shift');
      bubble.classList.add('on');
      // 唔好出咗畫面：太右就向左移返入嚟
      const r = bubble.getBoundingClientRect(), over = r.right - (document.documentElement.clientWidth - 8);
      if (over > 0) bubble.style.setProperty('--shift', `${-over}px`);
    };
    const hide = () => bubble.classList.remove('on');
    if (canHover) {
      f.addEventListener('mouseenter', show);
      f.addEventListener('mouseleave', hide);
    }
    f.addEventListener('click', () => {
      clearTimeout(timer);
      f.classList.add('hi'); show();
      timer = setTimeout(() => { f.classList.remove('hi'); if (!canHover || !f.matches(':hover')) hide(); }, 2000);
    });
  });
}
