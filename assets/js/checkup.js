// 理財體檢總結：將 3 步嘅結果（只喺訪客瀏覽器）放埋一頁
import { mountLayout, money, ym, esc } from './layout.js';
import { t } from './i18n.js';
import { readJourney, clearJourney, STEPS, stepName, stepUrl, doneCount } from './journey.js';

mountLayout();
const $ = id => document.getElementById(id);

const DIM = {
  cashflow: t('現金流', 'Cash flow'), emergency: t('緊急備用金', 'Emergency fund'), debt: t('負債', 'Debt'),
  protection: t('基本保障', 'Protection'), habits: t('增值習慣', 'Money habits'),
};
const GRADE = {
  good: t('好健康', 'In good shape'), ok: t('唔錯，仲有進步空間', 'Not bad, room to improve'),
  warn: t('有改善空間', 'Room for improvement'), bad: t('要留神喇', 'Worth a closer look'),
};
const pct = r => `${+(r * 100).toFixed(2)}%`;
const row = (label, value, note = '') =>
  `<div class="report-row"><span>${label}${note ? `<br><small class="muted">${note}</small>` : ''}</span><b class="num">${value}</b></div>`;

function render() {
  const j = readJourney();
  const n = doneCount(j);
  const missing = STEPS.filter(s => !j[s]);
  const out = [];

  if (!n) {
    $('report').innerHTML = `<div class="card center">
      <p>${t('你未做任何一步。3 步大約 5 分鐘，做完呢度就會見到你嘅總結。', "You haven't done any steps yet. The 3 steps take about 5 minutes, and your summary will appear here.")}</p>
      <a class="btn shu lg" href="${stepUrl('health')}">${t('開始第 1 步：健康檢查 →', 'Start step 1: Health check →')}</a></div>`;
    $('clear-box').classList.add('hidden');
    return;
  }

  if (j.health) {
    const h = j.health;
    const dims = Object.entries(h.dims || {}).sort((a, b) => a[1] - b[1]);
    out.push(`<section class="card"><h2>${t('1. 理財健康', '1. Money health')}</h2>
      ${row(t('總分', 'Overall score'), `${h.total} / 100`, GRADE[h.tone] || '')}
      ${dims.length ? row(t('最弱嘅範疇', 'Weakest area'), esc(DIM[dims[0][0]] || ''), t(`${Math.round(dims[0][1])} 分`, `${Math.round(dims[0][1])} points`)) : ''}
      ${row(t('緊急備用金', 'Emergency fund'), t(`${(h.efMonths || 0).toFixed(1)} 個月`, `${(h.efMonths || 0).toFixed(1)} months`), t('一般建議 3–6 個月', 'Common guideline: 3–6 months'))}
      ${row(t('儲蓄率', 'Savings rate'), `${Math.round((h.saveRate || 0) * 100)}%`, t('一般建議 20%', 'Common guideline: 20%'))}
    </section>`);
  }
  if (j.salary) {
    const s = j.salary;
    const actual = j.health?.saving;
    out.push(`<section class="card"><h2>${t('2. 月薪分配', '2. Salary split')}</h2>
      ${row(t('扣強積金後到手', 'Take-home after MPF'), money(s.takeHome))}
      ${row(t(`儲蓄（${s.pct}%）`, `Savings (${s.pct}%)`), t(`${money(s.save)}／月`, `${money(s.save)}/month`), t(`一年 ${money(s.save * 12)}`, `${money(s.save * 12)} a year`))}
      ${actual != null ? row(t('你而家實際每月儲', 'What you actually save now'), money(actual),
        actual < s.save ? t(`差 ${money(s.save - actual)}／月`, `${money(s.save - actual)}/month short`) : t('已經做到', 'On track')) : ''}
    </section>`);
  }
  if (j.goal) {
    const g = j.goal;
    const lines = g.mode === 'time'
      ? row(t('目標', 'Goal'), money(g.target), t(`已有 ${money(g.savings)}，每月 ${money(g.monthly)}`, `Have ${money(g.savings)}, ${money(g.monthly)} a month`)) +
        row(t('幾時達標', 'Time to goal'), g.months != null ? ym(g.months) : t('50 年內未達到', 'Over 50 years'), t(`假設年回報 ${pct(g.rate)}`, `Assumed return ${pct(g.rate)}`)) +
        (g.gap ? row(t('遲 5 年先開始', 'Starting 5 years later'), t(`少約 ${money(g.gap)}`, `About ${money(g.gap)} less`)) : '')
      : row(t('目標', 'Goal'), money(g.target), t(`${g.years} 年內`, `Within ${g.years} years`)) +
        row(t('每月要投入', 'Needed each month'), money(g.monthlyNeeded), t(`假設年回報 ${pct(g.rate)}`, `Assumed return ${pct(g.rate)}`)) +
        (g.extra ? row(t('遲 5 年先開始', 'Starting 5 years later'), t(`每月多 ${money(g.extra)}`, `${money(g.extra)} more a month`)) : '');
    out.push(`<section class="card"><h2>${t('3. 目標計算', '3. Goal planner')}</h2>${lines}</section>`);
  }

  if (j.health?.weakestTip) {
    out.push(`<section class="card tint"><h2>${t('最值得先處理嘅 1 件事', 'The one thing worth tackling first')}</h2>
      <p class="mt0"><b>${esc(DIM[j.health.weakest] || '')}${t('：', ': ')}</b>${esc(j.health.weakestTip)}</p>
      <p class="muted" style="font-size:13px;margin:0">${t('以上係一般性建議，冇考慮你嘅全部個人情況，亦唔涉及任何產品。', 'This is general guidance. It does not consider your full personal situation and does not involve any product.')}</p></section>`);
  }

  if (missing.length) {
    out.push(`<section class="next-step"><div class="eyebrow">${t(`仲差 ${missing.length} 步`, `${missing.length} step${missing.length > 1 ? 's' : ''} to go`)}</div>
      <h2>${t('做埋先睇到完整總結', 'Finish them to see the full picture')}</h2>
      <div class="grid">${missing.map(s => `<a class="btn secondary block" href="${stepUrl(s)}">${t(`去做：${stepName(s)} →`, `Do it now: ${stepName(s)} →`)}</a>`).join('')}</div></section>`);
  }

  $('report').innerHTML = out.join('');
  $('clear-box').classList.remove('hidden');
}

$('clear').addEventListener('click', () => {
  clearJourney();
  render();
  $('cleared').classList.remove('hidden');
});
render();
