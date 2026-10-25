// 首頁：按訪客嘅理財體檢進度，改主按鈕（開始／繼續／睇總結）
import { mountLayout } from './layout.js';
import { t, P } from './i18n.js';
import { readJourney, doneCount, nextStep, stepName, stepUrl } from './journey.js';

mountLayout();
const j = readJourney();
const n = doneCount(j);
const btn = document.getElementById('start-btn');
const note = document.getElementById('start-note');
if (btn && n > 0) {
  const s = nextStep(j);
  if (s) {
    btn.textContent = t(`繼續第 ${n + 1} 步：${stepName(s)} →`, `Continue with step ${n + 1}: ${stepName(s)} →`);
    btn.href = stepUrl(s);
    if (note) note.textContent = t(`你已完成 ${n} / 3 步，上次嘅結果仲喺你部機度。`, `You've done ${n} of 3 steps. Your earlier results are still on this device.`);
  } else {
    btn.textContent = t('睇我嘅理財體檢總結 →', 'See my check-up summary →');
    btn.href = `${P}/checkup/`;
    if (note) note.textContent = t('3 步已經做晒。可以隨時返嚟睇總結，或者重新做一次。', "You've finished all 3 steps. Come back to the summary any time, or redo a step.");
  }
}
