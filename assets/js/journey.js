// ============================================================
// 理財體檢 3 步：健康檢查 → 月薪分配 → 目標計算 → 總結
// 結果只儲存喺訪客自己嘅瀏覽器（localStorage），唔會上傳；總結頁可以一鍵清除。
// 瀏覽器唔俾儲存（私隱模式等）都照用得，只係唔會記住進度。
// ============================================================
import { t, P } from './i18n.js';

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
}

export function clearJourney() {
  try { localStorage.removeItem(KEY); } catch { /* 冇嘢要清 */ }
  paintJourney();
}

export const doneCount = (j = readJourney()) => STEPS.filter(s => j[s]).length;
export const nextStep = (j = readJourney()) => STEPS.find(s => !j[s]);

/** 更新頁面上所有進度印章；justDone = 啱啱完成嘅一步（蓋印動畫） */
export function paintJourney(justDone) {
  const j = readJourney();
  document.querySelectorAll('.journey .step').forEach(a => {
    const s = a.dataset.step, seal = a.querySelector('.seal');
    if (!seal) return;
    seal.classList.toggle('empty', !j[s]);
    if (j[s] && s === justDone) { seal.classList.remove('stamped'); void seal.offsetWidth; seal.classList.add('stamped'); }
  });
  const n = doneCount(j);
  document.querySelectorAll('[data-journey-count]').forEach(el => { el.textContent = t(`完成 ${n} / 3`, `${n} of 3 done`); });
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
