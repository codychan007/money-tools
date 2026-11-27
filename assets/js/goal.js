import { mountLayout, money, ym, readNum, moneyInput } from './layout.js';
import { futureValue, monthsToGoal, monthlyNeeded, delayComparison, delayGapAt } from './finance.js';
import { t, locale, P as PREFIX } from './i18n.js';
import { saveStep, readJourney, nextCard } from './journey.js';

mountLayout();

const $ = id => document.getElementById(id);
const els = { target: $('target'), savings: $('savings'), monthly: $('monthly'), years: $('years') };
[els.target, els.savings, els.monthly].forEach(moneyInput);

const COLORS = ['#C9BBA0', '#8C7F6E', '#4F6B3A', '#231F1C'];
const DELAY = '#B98327';
const MAX_MONTHS = 50 * 12;

let mode = 'time';
let focusIdx = 1;   // 預設用第 2 個回報率（4%）比較
let chart;
let last;           // 最近一次結果，畀分享卡用
let touched = false;

// 理財體檢：用第 1、2 步嘅數字預先填好（只係由第 2 步過嚟或者未做過呢步先填）
(function prefill() {
  const j = readJourney();
  const fromCheckup = new URLSearchParams(location.search).get('from') === 'checkup';
  const fmt = v => Math.round(v).toLocaleString(locale);
  if (j.goal && !fromCheckup) {          // 做過第 3 步：填返上次嘅數字
    const g = j.goal;
    if (g.target > 0) els.target.value = fmt(g.target);
    if (g.savings >= 0) els.savings.value = fmt(g.savings || 0);
    if (g.mode === 'amount') {
      mode = 'amount';
      if (g.years) els.years.value = g.years;
      document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.mode === 'amount')));
      $('f-monthly').classList.add('hidden'); $('f-years').classList.remove('hidden');
    } else if (g.monthly > 0) els.monthly.value = fmt(g.monthly);
    const i = [...document.querySelectorAll('.rate')].findIndex(r => Math.abs(parseFloat(r.value) / 100 - g.rate) < 1e-9);
    if (i >= 0) focusIdx = i;
    return;
  }
  if (!(fromCheckup || j.salary)) return;
  const used = [];
  if (j.salary?.save > 0) { els.monthly.value = fmt(j.salary.save); used.push(t('每月可以投入（第 2 步）', 'monthly amount (step 2)')); }
  if (j.health?.cash > 0) { els.savings.value = fmt(j.health.cash); used.push(t('而家已有儲蓄（第 1 步）', 'current savings (step 1)')); }
  if (used.length) {
    $('prefill-note').innerHTML = t(`已經用你喺理財體檢填過嘅數字預先填好：${used.join('、')}。目標金額你可以自己改。`,
      `Pre-filled from your check-up: ${used.join(' and ')}. Change the target to your own goal.`);
    $('prefill-note').classList.remove('hidden');
  }
})();

function saveGoal() {
  if (!last) return;
  const L = last;
  saveStep('goal', L.mode === 'time'
    ? { mode: 'time', target: L.T, savings: L.S, monthly: L.P, rate: L.fr, months: isFinite(L.n) ? L.n : null, gap: L.gap ? L.gap.gap : null }
    : { mode: 'amount', target: L.T, savings: L.S, years: L.Y, rate: L.fr, monthlyNeeded: L.dc.now, extra: L.dc.monthsLeft > 0 ? L.dc.extra : null });
}

function nextStepHtml() {
  return nextCard({
    eyebrow: t('第 3 步・最後一步', 'Step 3 · Last step'),
    title: t('3 步做完！將你嘅結果放埋一齊睇。', 'All 3 steps done! See your results together.'),
    body: t('總結會將健康分數、每月儲蓄同達標時間放喺同一頁，再話你知最值得先處理嘅 1 件事。',
      'The summary puts your health score, monthly savings and time to goal on one page, plus the one thing worth tackling first.'),
    href: `${PREFIX}/checkup/`,
    button: t('睇我嘅理財體檢總結 →', 'See my check-up summary →'),
  });
}

function rates() {
  return [...document.querySelectorAll('.rate')].map(i => {
    const v = parseFloat(i.value);
    return isFinite(v) ? Math.max(-20, Math.min(30, v)) / 100 : 0;
  });
}
const pctLabel = r => `${+(r * 100).toFixed(2)}%`;

/** 「遲 5 年先開始」：3 行對比，重點數字放大；假設條件放最底細字 */
function delayRows(rows, note) {
  return rows.map(([k, v]) => `<div class="delay-row"><span>${k}</span><b>${v}</b></div>`).join('')
    + `<p class="muted" style="font-size:13px;margin:8px 0 0">${note}</p>`;
}

// 手機：本金同回報收喺第二欄下面一行細字（第三、四欄收埋），成張表一眼睇晒
const mSub = (principal, gain) => `<span class="m-sub">${t(`本金 ${money(principal)}・回報 ${money(gain)}`, `Put in ${money(principal)} · returns ${money(gain)}`)}</span>`;

function renderChips(rs) {
  $('focus-chips').innerHTML = rs.map((r, i) =>
    `<button class="chip" data-i="${i}" aria-pressed="${i === focusIdx}">${pctLabel(r)}</button>`).join('');
}
$('focus-chips').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  focusIdx = +b.dataset.i; update();
});

document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
  $('f-monthly').classList.toggle('hidden', mode !== 'time');
  $('f-years').classList.toggle('hidden', mode !== 'amount');
  update();
}));

function update() {
  const T = readNum(els.target), S = readNum(els.savings), P = readNum(els.monthly);
  const Y = Math.max(1, Math.min(50, Math.round(readNum(els.years)) || 1));
  const rs = rates();
  renderChips(rs);
  const fr = rs[focusIdx];

  if (mode === 'time') {
    const ns = rs.map(r => monthsToGoal(T, S, P, r));
    $('res-title').textContent = t(`每月投入 ${money(P)}，要幾耐先儲到 ${money(T)}？`, `Putting in ${money(P)} a month, how long to reach ${money(T)}?`);
    $('res-table').innerHTML = `<tr><th>${t('假設年回報', 'Assumed return')}</th><th>${t('需時', 'Time')}</th><th>${t('你投入嘅本金', 'You put in')}</th><th>${t('回報部分', 'From returns')}</th></tr>` +
      rs.map((r, i) => {
        const n = ns[i];
        if (!isFinite(n) || n > MAX_MONTHS) return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td colspan="3">${t('50 年內都未達到，試下加多啲每月投入', 'Not reached within 50 years. Try putting in more each month')}</td></tr>`;
        const principal = S + P * n, fv = futureValue(S, P, r, n);
        return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td>${ym(n)}${mSub(principal, fv - principal)}</td><td>${money(principal)}</td><td>${money(fv - principal)}</td></tr>`;
      }).join('');

    // 遲 5 年
    const n = ns[focusIdx];
    let txt;
    if (!isFinite(n) || n > MAX_MONTHS) txt = t('以而家嘅設定，呢個回報率下 50 年內都未達標，所以冇得比較。', "With these numbers you don't reach the target within 50 years at this return, so there is nothing to compare.");
    else if (n === 0) txt = t('你已經達標喇！', "You're already there!");
    else {
      const gap = delayGapAt(S, P, fr, n, 60);
      const dc = delayComparison(T, S, fr, n, 60);
      txt = delayRows([
        [t('今日開始', 'Start today'), t(`${ym(n)}達標`, `Reach it in ${ym(n)}`)],
        [t('遲 5 年先開始', 'Start 5 years later'), t(`少咗 <span class="hl">${money(gap.gap)}</span>，要等多 5 年`, `<span class="hl">${money(gap.gap)}</span> less, 5 more years`)],
        dc.monthsLeft > 0
          ? [t('想同樣時間達標', 'To arrive on time'), t(`每月要多放 <span class="hl">${money(dc.extra)}</span>（即係 ${money(dc.late)}）`, `<span class="hl">${money(dc.extra)}</span> more a month (${money(dc.late)} in total)`)]
          : [t('想同樣時間達標', 'To arrive on time'), t('目標 5 年內就達到，遲 5 年即係成個目標推遲', 'Your goal is within 5 years, so a delay pushes the whole goal back')],
      ], t(`假設每月投入 ${money(P)}、年回報 ${pctLabel(fr)}；遲咗嗰 5 年，現有儲蓄冇拎去投資。`,
        `Assumes ${money(P)} a month and a ${pctLabel(fr)} yearly return; current savings are not invested during the 5-year delay.`));
    }
    $('delay-text').innerHTML = txt;

    const finite = ns.filter(n => isFinite(n) && n <= MAX_MONTHS);
    const horizonY = Math.min(50, Math.max(5, Math.ceil(((finite.length ? Math.max(...finite) : MAX_MONTHS) + 60) / 12)));
    drawChart(rs, horizonY, T, (r, m) => futureValue(S, P, r, m), m => (m > 60 ? futureValue(S, P, fr, m - 60) : S), fr);
    last = { mode, T, S, P, rs, ns, fr, n, gap: isFinite(n) && n > 0 ? delayGapAt(S, P, fr, n, 60) : null };
  } else {
    const months = Y * 12;
    const ps = rs.map(r => monthlyNeeded(T, S, r, months));
    $('res-title').textContent = t(`${Y} 年內儲到 ${money(T)}，每月要投入幾多？`, `To reach ${money(T)} in ${Y} years, how much a month?`);
    $('res-table').innerHTML = `<tr><th>${t('假設年回報', 'Assumed return')}</th><th>${t('每月要投入', 'Monthly needed')}</th><th>${t('你投入嘅本金', 'You put in')}</th><th>${t('回報部分', 'From returns')}</th></tr>` +
      rs.map((r, i) => {
        const principal = S + ps[i] * months;
        return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td>${money(ps[i])}${mSub(principal, Math.max(0, T - principal))}</td><td>${money(principal)}</td><td>${money(Math.max(0, T - principal))}</td></tr>`;
      }).join('');

    const dc = delayComparison(T, S, fr, months, 60);
    $('delay-text').innerHTML = dc.monthsLeft > 0
      ? delayRows([
          [t('今日開始', 'Start today'), t(`每月投入 ${money(dc.now)}`, `${money(dc.now)} a month`)],
          [t('遲 5 年先開始', 'Start 5 years later'), t(`只剩 ${ym(dc.monthsLeft)}，每月要 ${money(dc.late)}`, `Only ${ym(dc.monthsLeft)} left, ${money(dc.late)} a month`)],
          [t('每月要多放', 'Extra each month'), `<span class="hl">${money(dc.extra)}</span>`],
        ], t(`假設年回報 ${pctLabel(fr)}；遲咗嗰 5 年，現有儲蓄冇拎去投資。`, `Assumes a ${pctLabel(fr)} yearly return; current savings are not invested during the 5-year delay.`))
      : t(`你嘅目標年期係 ${Y} 年，遲 5 年先開始就連時間都唔夠。試下將年期設長過 5 年再比較。`, `Your timeframe is ${Y} years, so a 5-year delay leaves no time at all. Try a timeframe longer than 5 years.`);

    drawChart(rs, Y, T,
      (r, m) => futureValue(S, monthlyNeeded(T, S, r, months), r, m),
      m => (dc.monthsLeft > 0 ? (m > 60 ? futureValue(S, dc.late, fr, m - 60) : S) : null), fr);
    last = { mode, T, S, Y, rs, ps, fr, dc };
  }
  if (touched) saveGoal();
}

function drawChart(rs, years, target, fn, lateFn, fr) {
  const labels = Array.from({ length: years + 1 }, (_, y) => `${y}`);
  const datasets = rs.map((r, i) => ({
    label: `${pctLabel(r)}`,
    data: labels.map((_, y) => Math.round(fn(r, y * 12))),
    borderColor: COLORS[i], backgroundColor: COLORS[i],
    borderWidth: i === focusIdx ? 3.5 : 2, pointRadius: 0, tension: .25,
  }));
  datasets.push({
    label: t(`遲 5 年開始（${pctLabel(fr)}）`, `Start 5 years later (${pctLabel(fr)})`),
    data: labels.map((_, y) => { const v = lateFn(y * 12); return v == null ? null : Math.round(v); }),
    borderColor: DELAY, backgroundColor: DELAY, borderDash: [6, 5], borderWidth: 2.5, pointRadius: 0, tension: .25,
  });
  datasets.push({
    label: t('目標', 'Target'), data: labels.map(() => target), borderColor: '#B5361F', backgroundColor: '#B5361F',
    borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0,
  });
  const cfg = {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 }, color: '#231F1C' } },
        tooltip: { callbacks: { title: it => t(`第 ${it[0].label} 年`, `Year ${it[0].label}`), label: c => `${c.dataset.label}${t('：', ': ')}${money(c.parsed.y)}` } },
      },
      scales: {
        x: { title: { display: true, text: t('年', 'Years') }, ticks: { maxTicksLimit: 8 } },
        y: { ticks: { callback: v => (v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? (v / 1e3) + 'K' : v) } },
      },
    },
  };
  if (!window.Chart) return;
  if (chart) { chart.data = cfg.data; chart.update(); } else chart = new Chart($('chart'), cfg);
}

document.querySelectorAll('input').forEach(i => i.addEventListener('input', () => { touched = true; update(); }));
update();
$('next-step').innerHTML = nextStepHtml();

// 撳「睇總結」都當完成咗呢步
$('next-step').addEventListener('click', e => { if (e.target.closest('a')) saveGoal(); });
