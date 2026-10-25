import { mountLayout, money, ym, readNum, moneyInput } from './layout.js';
import { futureValue, monthsToGoal, monthlyNeeded, delayComparison, delayGapAt } from './finance.js';
import { buildCard, shareCanvas } from './sharecard.js';
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
  if (!(fromCheckup || (j.salary && !j.goal))) return;
  const fmt = v => Math.round(v).toLocaleString(locale);
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
    unlock: t('總結只喺你部機度生成，唔會上傳。', 'The summary is created on your device only and never uploaded.'),
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
        return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td>${ym(n)}</td><td>${money(principal)}</td><td>${money(fv - principal)}</td></tr>`;
      }).join('');

    // 遲 5 年
    const n = ns[focusIdx];
    let txt;
    if (!isFinite(n) || n > MAX_MONTHS) txt = t('以而家嘅設定，呢個回報率下 50 年內都未達標，所以冇得比較。', "With these numbers you don't reach the target within 50 years at this return, so there is nothing to compare.");
    else if (n === 0) txt = t('你已經達標喇！', "You're already there!");
    else {
      const gap = delayGapAt(S, P, fr, n, 60);
      const dc = delayComparison(T, S, fr, n, 60);
      txt = t(`用 ${pctLabel(fr)} 假設回報，今日開始大約 <span class="hl">${ym(n)}</span> 達標。<br>
        如果遲 5 年先開始（每月一樣投入 ${money(P)}，而呢 5 年現有儲蓄冇投資），到同一日你會<span class="hl">少咗約 ${money(gap.gap)}</span>，要等多 5 年先達到。`,
        `At an assumed ${pctLabel(fr)} return, starting today you get there in about <span class="hl">${ym(n)}</span>.<br>
        If you started 5 years later (same ${money(P)} a month, and your current savings not invested for those 5 years), on the same date you would have <span class="hl">about ${money(gap.gap)} less</span> and need 5 more years.`);
      txt += dc.monthsLeft > 0
        ? t(`<br>想同一時間達標，遲 5 年先開始嘅話每月要投入 <span class="hl">${money(dc.late)}</span>（多 ${money(dc.extra)}）。`,
          `<br>To still arrive on time after a 5-year delay, you would need <span class="hl">${money(dc.late)}</span> a month (${money(dc.extra)} more).`)
        : t(`<br>你嘅目標 5 年內就達到，遲 5 年即係成個目標都要推遲。`, `<br>You reach this goal within 5 years, so a 5-year delay pushes back the whole goal.`);
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
        return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td>${money(ps[i])}</td><td>${money(principal)}</td><td>${money(Math.max(0, T - principal))}</td></tr>`;
      }).join('');

    const dc = delayComparison(T, S, fr, months, 60);
    $('delay-text').innerHTML = dc.monthsLeft > 0
      ? t(`用 ${pctLabel(fr)} 假設回報，今日開始每月要投入 <span class="hl">${money(dc.now)}</span>。<br>
         如果遲 5 年先開始（呢 5 年現有儲蓄冇投資），只剩 ${ym(dc.monthsLeft)}，每月就要 <span class="hl">${money(dc.late)}</span>——每月多 ${money(dc.extra)}。`,
        `At an assumed ${pctLabel(fr)} return, starting today you need <span class="hl">${money(dc.now)}</span> a month.<br>
         Start 5 years later (current savings not invested meanwhile) and only ${ym(dc.monthsLeft)} remain, so you would need <span class="hl">${money(dc.late)}</span> a month: ${money(dc.extra)} more.`)
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

// ---------- 分享卡 ----------
$('share-btn').addEventListener('click', () => {
  if (!last) return;
  const showAmt = $('show-amounts').checked;
  const L = last;
  const title = showAmt ? t(`目標 ${money(L.T)}（已有 ${money(L.S)}）`, `Goal ${money(L.T)} (have ${money(L.S)})`) : t('我嘅儲錢目標計劃', 'My savings goal plan');
  let big, bigSub, rows, delayLine;
  if (L.mode === 'time') {
    big = isFinite(L.n) && L.n <= MAX_MONTHS ? ym(L.n) : t('50 年+', '50 yrs+');
    bigSub = t(`假設年回報 ${pctLabel(L.fr)}・每月投入 ${money(L.P)}`, `Assumed return ${pctLabel(L.fr)} · ${money(L.P)} a month`);
    rows = L.rs.map((r, i) => [t(`假設 ${pctLabel(r)}`, `At ${pctLabel(r)}`), isFinite(L.ns[i]) && L.ns[i] <= MAX_MONTHS ? ym(L.ns[i]) : t('50 年+', '50 yrs+')]);
    delayLine = L.gap ? t(`遲 5 年先開始，到時會少咗約 ${money(L.gap.gap)}`, `Start 5 years later: about ${money(L.gap.gap)} less`) : '';
  } else {
    big = t(`${money(L.dc.now)}/月`, `${money(L.dc.now)}/mo`);
    bigSub = t(`${L.Y} 年計劃・假設年回報 ${pctLabel(L.fr)}`, `${L.Y}-year plan · assumed return ${pctLabel(L.fr)}`);
    rows = L.rs.map((r, i) => [t(`假設 ${pctLabel(r)}`, `At ${pctLabel(r)}`), t(`${money(L.ps[i])}/月`, `${money(L.ps[i])}/mo`)]);
    delayLine = L.dc.monthsLeft > 0 ? t(`遲 5 年先開始，每月要多供 ${money(L.dc.extra)}`, `Start 5 years later: ${money(L.dc.extra)} more a month`) : '';
  }
  const cv = buildCard({
    kicker: t('理財目標計算機', 'Goal planner'), title, big, bigSub,
    draw(ctx, box, { C, FONT }) {
      let y = box.y + 40;
      ctx.font = `600 40px ${FONT}`;
      rows.forEach(([k, v]) => {
        ctx.fillStyle = C.ink2; ctx.textAlign = 'left'; ctx.fillText(k, box.x, y);
        ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(v, box.x + box.w, y);
        y += 26; ctx.fillStyle = C.line; ctx.fillRect(box.x, y, box.w, 2); y += 64;
      });
      ctx.textAlign = 'left';
      if (delayLine) {
        ctx.fillStyle = C.ochre50; ctx.fillRect(box.x - 20, y, box.w + 40, 110);
        ctx.fillStyle = '#6B4A0E'; ctx.font = `700 36px ${FONT}`; ctx.fillText(delayLine, box.x, y + 68);
      }
    },
  });
  shareCanvas(cv, 'my-goal.png', $('share-preview'));
});
