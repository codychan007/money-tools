// ============================================================
// 理財體檢「過關」動畫：每一關第一次完成，畫面中間彈出開鎖卡，2.5 秒後自己消失
// 3 關全部完成：加彩紙。只係裝飾，唔會擋住任何嘢；撳一下即刻收埋。
// 同一個瀏覽器每關只播一次（hkmc-unlock-seen）。
// 未播得切就轉咗頁（例如撳咗「下一步」）：留低 pending，下一頁再播。
// ============================================================
import { t } from './i18n.js';
import { esc } from './esc.js';

const SEEN = 'hkmc-unlock-seen', PENDING = 'hkmc-unlock-pending';
const ORDER = ['health', 'salary', 'goal'];
const NAMES = { salary: ['月薪分配', 'Salary split'], goal: ['目標計算', 'Goal planner'] };
const IDLE_MS = 1000, SHOW_MS = 2500;

const get = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 唔俾儲存就算 */ } };

let timer = null, lastInput = 0;
document.addEventListener('input', () => { lastInput = Date.now(); }, true);

/** saveStep 第一次完成某關時叫：記低，等訪客停手先播（免得打字途中彈出嚟） */
export function queueUnlock(step) {
  if (get(SEEN).includes(step)) return;
  const p = get(PENDING); if (!p.includes(step)) set(PENDING, [...p, step]);
  schedule();
}

/** 頁面載入時叫：上一頁未播嘅補返 */
export function showPendingUnlock() { if (get(PENDING).length) schedule(600); }

function schedule(delay = IDLE_MS) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const idle = Date.now() - lastInput;
    if (idle < IDLE_MS) return schedule(IDLE_MS - idle);
    play();
  }, delay);
}

function play() {
  const p = get(PENDING); if (!p.length) return;
  // 一次過完成幾關都只播最後嗰關
  const step = ORDER.filter(s => p.includes(s)).pop();
  const n = ORDER.indexOf(step) + 1, last = n === 3;
  const title = last ? t('3 關全部過關！', 'All 3 levels cleared!') : t(`第 ${n} 關過關！`, `Level ${n} cleared!`);
  const sub = last
    ? t('已解鎖：你嘅理財體檢總結', 'Unlocked: your check-up summary')
    : t(`已解鎖：第 ${n + 1} 關・${NAMES[ORDER[n]][0]}`, `Unlocked: Level ${n + 1} · ${NAMES[ORDER[n]][1]}`);

  document.querySelector('.unlock-pop')?.remove();
  const el = document.createElement('div');
  el.className = 'unlock-pop' + (last ? ' final' : '');
  el.setAttribute('role', 'status');
  // 彈出內容組好先記「睇過」。組 HTML 途中出錯就留低 pending，下一頁可以再播。
  el.innerHTML = `<div class="unlock-card">
      <svg class="unlock-lock" viewBox="0 0 64 72" aria-hidden="true">
        <path class="shackle" d="M18 32 V22 a14 14 0 0 1 28 0 V32" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
        <rect x="8" y="30" width="48" height="38" rx="7" fill="currentColor"/>
        <circle cx="32" cy="46" r="5" fill="var(--card)"/><rect x="29.5" y="48" width="5" height="10" rx="2" fill="var(--card)"/>
      </svg>
      <div class="unlock-title">${esc(title)}</div>
      <div class="unlock-sub">${esc(sub)}</div>
    </div>`;
  set(PENDING, []);
  set(SEEN, [...new Set([...get(SEEN), ...p])]);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (last) confetti(el);
  chime(last);

  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); document.removeEventListener('keydown', onEsc); };
  // 唔好命名做 esc：會覆蓋頂部 import 嘅 HTML 跳脫函數，彈出卡一組就 ReferenceError。
  const onEsc = e => { if (e.key === 'Escape') close(); };
  el.addEventListener('click', close);
  document.addEventListener('keydown', onEsc);
  setTimeout(close, SHOW_MS);
}

function confetti(host) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'unlock-confetti';
  host.appendChild(c);
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#B5361F', '#B98327', '#4F6B3A', '#231F1C', '#F4E6C6'];
  const bits = Array.from({ length: 110 }, () => ({
    x: W / 2 + (Math.random() - .5) * 60, y: H * .42,
    vx: (Math.random() - .5) * 12, vy: -Math.random() * 13 - 4,
    w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
    r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: cols[Math.random() * cols.length | 0],
  }));
  const t0 = performance.now();
  (function frame(now) {
    const k = (now - t0) / 1000; if (k > 2.5 || !c.isConnected) return;
    g.clearRect(0, 0, W, H); g.globalAlpha = Math.min(1, (2.5 - k) * 2);
    for (const b of bits) {
      b.vy += .38; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.col; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
    }
    requestAnimationFrame(frame);
  })(t0);
}

// ------------------------------------------------------------
// 聲效：用瀏覽器即時合成（唔使聲效檔，唔佔容量），細聲、短。
// 第 1、2 關：「叮叮」兩聲；第 3 關：四個音嘅過關小調。
// 訪客未同頁面互動過（例如補播上一頁嘅動畫）瀏覽器唔俾出聲，就靜靜雞略過。
// ------------------------------------------------------------
let ac = null;
function chime(final) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state !== 'running') ac.resume();
    // resume 要少少時間；唔得就算
    setTimeout(() => { if (ac.state === 'running') notes(final); }, 30);
  } catch { /* 唔支援就算 */ }
}

function notes(final) {
  const t0 = ac.currentTime + .02;
  // C 大調：E6 G6；最後一關 C5 E5 G5 C6
  const seq = final ? [[523.25, 0], [659.25, .11], [783.99, .22], [1046.5, .34, .7]]
                    : [[1318.5, 0], [1568.0, .12, .5]];
  const master = ac.createGain(); master.gain.value = .12; master.connect(ac.destination);
  for (const [f, at, len = .28] of seq) {
    for (const [mult, vol, type] of [[1, 1, 'triangle'], [2, .25, 'sine']]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f * mult;
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(vol, t0 + at + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + at + len);
      o.connect(g).connect(master);
      o.start(t0 + at); o.stop(t0 + at + len + .05);
    }
  }
}
