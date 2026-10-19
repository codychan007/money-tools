import { mountLayout, money, ym, readNum, moneyInput } from './layout.js';
import { futureValue, monthsToGoal, monthlyNeeded, delayComparison, delayGapAt } from './finance.js';
import { buildCard, shareCanvas } from './sharecard.js';

mountLayout();

const $ = id => document.getElementById(id);
const els = { target: $('target'), savings: $('savings'), monthly: $('monthly'), years: $('years') };
[els.target, els.savings, els.monthly].forEach(moneyInput);

const COLORS = ['#9DC4B0', '#4E9A76', '#1F7A55', '#0A3D2A'];
const DELAY = '#E0A21B';
const MAX_MONTHS = 50 * 12;

let mode = 'time';
let focusIdx = 1;   // 預設用第 2 個回報率（4%）比較
let chart;
let last;           // 最近一次結果，畀分享卡用

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
    $('res-title').textContent = `每月投入 ${money(P)}，要幾耐先儲到 ${money(T)}？`;
    $('res-table').innerHTML = `<tr><th>假設年回報</th><th>需時</th><th>你投入嘅本金</th><th>回報部分</th></tr>` +
      rs.map((r, i) => {
        const n = ns[i];
        if (!isFinite(n) || n > MAX_MONTHS) return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td colspan="3">50 年內都未達到，試下加多啲每月投入</td></tr>`;
        const principal = S + P * n, fv = futureValue(S, P, r, n);
        return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td>${ym(n)}</td><td>${money(principal)}</td><td>${money(fv - principal)}</td></tr>`;
      }).join('');

    // 遲 5 年
    const n = ns[focusIdx];
    let txt;
    if (!isFinite(n) || n > MAX_MONTHS) txt = '以而家嘅設定，呢個回報率下 50 年內都未達標，所以冇得比較。';
    else if (n === 0) txt = '你已經達標喇 🎉';
    else {
      const gap = delayGapAt(S, P, fr, n, 60);
      const dc = delayComparison(T, S, fr, n, 60);
      txt = `用 ${pctLabel(fr)} 假設回報，今日開始大約 <span class="hl">${ym(n)}</span> 達標。<br>
        如果遲 5 年先開始（每月一樣投入 ${money(P)}，而呢 5 年現有儲蓄冇投資），到同一日你會<span class="hl">少咗約 ${money(gap.gap)}</span>，要等多 5 年先達到。`;
      txt += dc.monthsLeft > 0
        ? `<br>想同一時間達標，遲 5 年先開始嘅話每月要投入 <span class="hl">${money(dc.late)}</span>（多 ${money(dc.extra)}）。`
        : `<br>你嘅目標 5 年內就達到，遲 5 年即係成個目標都要推遲。`;
    }
    $('delay-text').innerHTML = txt;

    const finite = ns.filter(n => isFinite(n) && n <= MAX_MONTHS);
    const horizonY = Math.min(50, Math.max(5, Math.ceil(((finite.length ? Math.max(...finite) : MAX_MONTHS) + 60) / 12)));
    drawChart(rs, horizonY, T, (r, m) => futureValue(S, P, r, m), m => (m > 60 ? futureValue(S, P, fr, m - 60) : S), fr);
    last = { mode, T, S, P, rs, ns, fr, n, gap: isFinite(n) && n > 0 ? delayGapAt(S, P, fr, n, 60) : null };
  } else {
    const months = Y * 12;
    const ps = rs.map(r => monthlyNeeded(T, S, r, months));
    $('res-title').textContent = `${Y} 年內儲到 ${money(T)}，每月要投入幾多？`;
    $('res-table').innerHTML = `<tr><th>假設年回報</th><th>每月要投入</th><th>你投入嘅本金</th><th>回報部分</th></tr>` +
      rs.map((r, i) => {
        const principal = S + ps[i] * months;
        return `<tr class="${i === focusIdx ? 'focus' : ''}"><td>${pctLabel(r)}</td><td>${money(ps[i])}</td><td>${money(principal)}</td><td>${money(Math.max(0, T - principal))}</td></tr>`;
      }).join('');

    const dc = delayComparison(T, S, fr, months, 60);
    $('delay-text').innerHTML = dc.monthsLeft > 0
      ? `用 ${pctLabel(fr)} 假設回報，今日開始每月要投入 <span class="hl">${money(dc.now)}</span>。<br>
         如果遲 5 年先開始（呢 5 年現有儲蓄冇投資），只剩 ${ym(dc.monthsLeft)}，每月就要 <span class="hl">${money(dc.late)}</span>——每月多 ${money(dc.extra)}。`
      : `你嘅目標年期係 ${Y} 年，遲 5 年先開始就連時間都唔夠。試下將年期設長過 5 年再比較。`;

    drawChart(rs, Y, T,
      (r, m) => futureValue(S, monthlyNeeded(T, S, r, months), r, m),
      m => (dc.monthsLeft > 0 ? (m > 60 ? futureValue(S, dc.late, fr, m - 60) : S) : null), fr);
    last = { mode, T, S, Y, rs, ps, fr, dc };
  }
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
    label: `遲 5 年開始（${pctLabel(fr)}）`,
    data: labels.map((_, y) => { const v = lateFn(y * 12); return v == null ? null : Math.round(v); }),
    borderColor: DELAY, backgroundColor: DELAY, borderDash: [6, 5], borderWidth: 2.5, pointRadius: 0, tension: .25,
  });
  datasets.push({
    label: '目標', data: labels.map(() => target), borderColor: '#C2412D', backgroundColor: '#C2412D',
    borderWidth: 1.5, borderDash: [2, 4], pointRadius: 0,
  });
  const cfg = {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { title: it => `第 ${it[0].label} 年`, label: c => `${c.dataset.label}：${money(c.parsed.y)}` } },
      },
      scales: {
        x: { title: { display: true, text: '年' }, ticks: { maxTicksLimit: 8 } },
        y: { ticks: { callback: v => (v >= 1e6 ? (v / 1e6) + 'M' : v >= 1e3 ? (v / 1e3) + 'K' : v) } },
      },
    },
  };
  if (!window.Chart) return;
  if (chart) { chart.data = cfg.data; chart.update(); } else chart = new Chart($('chart'), cfg);
}

document.querySelectorAll('input').forEach(i => i.addEventListener('input', update));
update();

// ---------- 分享卡 ----------
$('share-btn').addEventListener('click', () => {
  if (!last) return;
  const showAmt = $('show-amounts').checked;
  const L = last;
  const title = showAmt ? `目標 ${money(L.T)}（已有 ${money(L.S)}）` : '我嘅儲錢目標計劃';
  let big, bigSub, rows, delayLine;
  if (L.mode === 'time') {
    big = isFinite(L.n) && L.n <= MAX_MONTHS ? ym(L.n) : '50 年+';
    bigSub = `假設年回報 ${pctLabel(L.fr)}・每月投入 ${money(L.P)}`;
    rows = L.rs.map((r, i) => [`假設 ${pctLabel(r)}`, isFinite(L.ns[i]) && L.ns[i] <= MAX_MONTHS ? ym(L.ns[i]) : '50 年+']);
    delayLine = L.gap ? `遲 5 年先開始，到時會少咗約 ${money(L.gap.gap)}` : '';
  } else {
    big = `${money(L.dc.now)}/月`;
    bigSub = `${L.Y} 年計劃・假設年回報 ${pctLabel(L.fr)}`;
    rows = L.rs.map((r, i) => [`假設 ${pctLabel(r)}`, `${money(L.ps[i])}/月`]);
    delayLine = L.dc.monthsLeft > 0 ? `遲 5 年先開始，每月要多供 ${money(L.dc.extra)}` : '';
  }
  const cv = buildCard({
    kicker: '🎯 理財目標計算機', title, big, bigSub,
    draw(ctx, box, { C, FONT }) {
      let y = box.y + 40;
      ctx.font = `600 40px ${FONT}`;
      rows.forEach(([k, v]) => {
        ctx.fillStyle = C.ink2; ctx.textAlign = 'left'; ctx.fillText(k, box.x, y);
        ctx.fillStyle = C.ink; ctx.textAlign = 'right'; ctx.fillText(v, box.x + box.w, y);
        y += 26; ctx.fillStyle = C.g1; ctx.fillRect(box.x, y, box.w, 2); y += 64;
      });
      ctx.textAlign = 'left';
      if (delayLine) {
        ctx.fillStyle = '#FFF6E0'; ctx.fillRect(box.x - 20, y, box.w + 40, 110);
        ctx.fillStyle = '#7A4E00'; ctx.font = `700 38px ${FONT}`; ctx.fillText('⏰ ' + delayLine, box.x, y + 68);
      }
    },
  });
  shareCanvas(cv, 'my-goal.png', $('share-preview'));
});
