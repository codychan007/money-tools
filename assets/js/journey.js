// ============================================================
// 理財體檢 3 步：健康檢查 → 月薪分配 → 目標計算 → 總結
// 結果只儲存喺訪客自己嘅瀏覽器（localStorage），唔會上傳；總結頁可以一鍵清除。
// 瀏覽器唔俾儲存（私隱模式等）都照用得，只係唔會記住進度。
// ============================================================
import { t, P } from './i18n.js';
import { SITE } from './config.js';
import { queueUnlock } from './unlock.js';

const KEY = 'hkmc-checkup-v1';
export const STEPS = ['health', 'salary', 'goal'];
const NAMES = { health: ['健康檢查', 'Health check'], salary: ['月薪分配', 'Salary split'], goal: ['目標計算', 'Goal planner'] };
export const stepName = s => t(...NAMES[s]);
export const stepUrl = s => `${P}/${s}/`;

export function readJourney() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function saveStep(step, data) {
  const j = readJourney();
  const first = !j[step];
  j[step] = { ...data, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(j)); } catch { /* 唔俾儲存就算 */ }
  paintJourney(first ? step : null);
  if (first) queueUnlock(step);   // 第一次完成：彈「過關」動畫
}

export function clearJourney() {
  try {
    localStorage.removeItem(KEY);
    // 過關動畫記錄（unlock.js）都一併清
    localStorage.removeItem('hkmc-unlock-seen'); localStorage.removeItem('hkmc-unlock-pending');
  } catch { /* 冇嘢要清 */ }
  paintJourney();
}

export const doneCount = (j = readJourney()) => STEPS.filter(s => j[s]).length;
export const nextStep = (j = readJourney()) => STEPS.find(s => !j[s]);

/** 更新頁面上所有進度印章；justDone = 啱啱完成嘅一步（蓋印動畫） */
export function paintJourney(justDone) {
  const j = readJourney();
  document.querySelectorAll('.journey .step').forEach(a => {
    const s = a.dataset.step, seal = a.querySelector('.seal');
    // 上一步未完成就唔俾撳，免得跳步：冇 href 嘅 <a> 唔會撳得到
    const i = STEPS.indexOf(s), open = STEPS.slice(0, i).every(p => j[p]);
    const href = a.getAttribute('href') || a.dataset.href;
    if (href) a.dataset.href = href;
    a.classList.toggle('locked', !open);
    if (open) { a.setAttribute('href', href); a.removeAttribute('aria-disabled'); a.removeAttribute('title'); }
    else {
      a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true');
      a.title = t(`完成第 ${i} 步先可以做呢步`, `Finish step ${i} first`);
    }
    if (!seal) return;
    seal.classList.toggle('empty', !j[s]);
    if (j[s] && s === justDone) { seal.classList.remove('stamped'); void seal.offsetWidth; seal.classList.add('stamped'); }
  });
  const n = doneCount(j);
  // 三步都解鎖咗就唔使再提「逐步完成」
  const allOpen = STEPS.every((s, i) => STEPS.slice(0, i).every(p => j[p]));
  document.querySelectorAll('[data-journey-hint]').forEach(el => { el.hidden = allOpen; });
  document.querySelectorAll('[data-journey-count]').forEach(el => { el.textContent = t(`完成 ${n} / 3`, `${n} of 3 done`); });
  personaliseCta(j);
}

/**
 * 「下一步」卡：用今步結果帶出下一步嘅好奇位
 * opts: { eyebrow, title, body, unlock, href, button }
 */
export function nextCard({ eyebrow, title, body, unlock, href, button }) {
  return `<section class="next-step">
    <div class="eyebrow">${eyebrow}</div>
    <h2>${title}</h2>
    ${body ? `<p>${body}</p>` : ''}
    ${unlock ? `<div class="teaser-line">${unlock}</div>` : ''}
    <a class="btn shu lg block" href="${href}">${button}</a>
  </section>`;
}

// ------------------------------------------------------------
// 計完即刻搵 Cody：跟最弱範疇講嘢，WhatsApp 預先寫好分數
// 訊息只係預先填喺 WhatsApp，訪客自己撳「傳送」先會發出；網站唔會上傳任何嘢。
// ------------------------------------------------------------
const DIM_NAMES = {
  cashflow: ['現金流', 'Cash flow'], emergency: ['緊急備用金', 'Emergency fund'], debt: ['負債', 'Debt'],
  protection: ['基本保障', 'Protection'], habits: ['增值習慣', 'Money habits'],
};
const waWith = text => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;

export function weakest(h) {
  const [k, v] = Object.entries(h?.dims || {}).sort((a, b) => a[1] - b[1])[0] || [];
  return k ? { k, name: t(...DIM_NAMES[k]), score: Math.round(v) } : null;
}

/** 預先寫好嘅 WhatsApp 訊息；detail = 連儲蓄率同備用金一齊講（總結頁用） */
export function scoreMessage(h, detail = false) {
  const w = weakest(h);
  if (!h || !w) return null;
  const extra = detail
    ? t(`儲蓄率大約 ${Math.round((h.saveRate || 0) * 100)}%，備用金夠大約 ${(h.efMonths || 0).toFixed(1)} 個月。`,
      ` I save about ${Math.round((h.saveRate || 0) * 100)}% and my emergency fund covers about ${(h.efMonths || 0).toFixed(1)} months.`)
    : '';
  return t(
    `你好 Cody，我啱啱喺網站做咗理財體檢：總分 ${h.total}/100，最弱係「${w.name}」（${w.score} 分）。${extra}想你幫我睇下。`,
    `Hi Cody, I just did the money check-up on your website: ${h.total}/100 overall, weakest area "${w.name}" (${w.score} points).${extra} Could you take a look with me?`);
}

const HOOK = {
  protection: s => t(`你「基本保障」得 ${s} 分。萬一有事，你知唔知自己而家保咗咩、漏咗咩？`,
    `Your protection score is ${s}. If something happened, do you know what you're covered for, and what you're not?`),
  cashflow: s => t(`你「現金流」得 ${s} 分。人工唔少，但錢就係留唔低？`,
    `Your cash flow score is ${s}. Decent pay, but the money never seems to stay?`),
  emergency: s => t(`你「緊急備用金」得 ${s} 分。冇咗人工嗰陣，撐唔撐得住？`,
    `Your emergency fund score is ${s}. Could you get by if your pay stopped?`),
  debt: s => t(`你「負債」得 ${s} 分。還款食咗幾多人工，有冇方法鬆啲？`,
    `Your debt score is ${s}. How much of your pay goes on repayments, and can that ease up?`),
  habits: s => t(`你「增值習慣」得 ${s} 分。除咗強積金，你啲錢有冇幫你做嘢？`,
    `Your money habits score is ${s}. Apart from MPF, is your money working for you?`),
};

/** 結果頁「WhatsApp 我」卡：比「預約見面」低壓好多嘅中間步 */
export function chatCard(h, { detail = false } = {}) {
  const w = weakest(h);
  if (!w) return '';
  const strong = h.total >= 80;
  const title = strong
    ? t(`你 ${h.total} 分，底子唔錯。想知點樣再推高啲？`, `You scored ${h.total}. A solid base. Want to push it higher?`)
    : HOOK[w.k](w.score);
  const btn = strong
    ? t('WhatsApp 我，幫我睇下一步', 'WhatsApp me about the next step')
    : t(`WhatsApp 我，幫我睇「${w.name}」`, `WhatsApp me about "${w.name}"`);
  const GAIN = {
    emergency: t('備用金要儲幾多先夠、每月放幾多、放喺邊度先隨時攞得返。', 'how much emergency fund is enough, how much to put aside each month, and where to keep it so it stays easy to reach.'),
    protection: t('你而家有咩保障、有冇缺口、要補嘅話大約要幾錢。', "what cover you have now, whether there are gaps, and roughly what filling them would cost."),
    cashflow: t('你啲錢流咗去邊、點樣每月穩定儲多啲。', 'where your money goes and how to save more every month, steadily.'),
    debt: t('先還邊筆最慳利息、大約幾耐可以還清。', 'which debt to pay off first to save the most interest, and roughly how long until you are clear.'),
    habits: t('除咗強積金，點樣開始為長遠目標定期儲錢。', 'how to start saving regularly for long-term goals, beyond MPF.'),
  };
  const gain = strong ? t('你下一步可以點樣再推高。', 'what your next step could be to push it higher.') : GAIN[w.k];
  return `<section class="card tint chat-card">
    <h2>${title}</h2>
    <p class="mt0">${t(`免費 30 分鐘，同你一齊計清楚：${gain}`, `In a free 30-minute chat, we work out together ${gain}`)}</p>
    <a class="btn block" href="${waWith(scoreMessage(h, detail))}" target="_blank" rel="noopener">${btn}</a>
    <p class="muted" style="font-size:13px;margin:10px 0 0">${t(
      `訊息會預先寫好你嘅分數，你撳「傳送」先會發出，唔想講可以刪走。撳即表示同意<a href="${P}/book/#pics">個人資料收集聲明</a>。想直接約時間？<a href="${P}/book/">預約 30 分鐘傾談 →</a>`,
      `The message is pre-filled with your score and only goes out when you press send; delete anything you'd rather not share. Tapping means you agree to the <a href="${P}/book/#pics">personal information collection statement</a>. Prefer to pick a time? <a href="${P}/book/">Book a 30-minute chat →</a>`)}</p>
  </section>`;
}

/** 頁面已經有「WhatsApp 我」卡（入面有預約連結）就收埋頁底預約掣，免得重複叫人預約 */
export function hideBottomCta(hide = true) {
  document.querySelectorAll('[data-cta]').forEach(el => { el.hidden = hide; });
}

/** 頁底預約掣：做咗健康檢查就跟住分數講，唔再係一句通用嘢 */
export function personaliseCta(j = readJourney()) {
  const w = weakest(j.health);
  if (!w || j.health.total >= 80) return;
  // 有自己主題嘅頁（慳稅、優惠）唔講體檢分數
  document.querySelectorAll('[data-cta]:not([data-cta-topic]) .cta-lead').forEach(el => {
    // 講正面啲、唔出分數（唔好似老師打分）
    el.textContent = t(`你最值得先改善嘅係「${w.name}」，想有人同你一齊諗下點做？`,
      `The area most worth improving first: "${w.name}". Want someone to work it out with you?`);
  });
}
