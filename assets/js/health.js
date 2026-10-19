import { mountLayout, money, readNum, moneyInput } from './layout.js';
import { healthScores, healthGrade } from './finance.js';
import { buildCard, shareCanvas } from './sharecard.js';

mountLayout();
const $ = id => document.getElementById(id);

// 問題清單：type 'money' = 輸入金額；'choice' = 選擇題
const QUESTIONS = [
  { key: 'income', type: 'money', title: '每月收入大約幾多？', hint: '扣完強積金、實際入到銀行嗰個數。' },
  { key: 'expenses', type: 'money', title: '每月生活開支大約幾多？', hint: '租金、家用、食飯、交通、娛樂……唔計還債。' },
  { key: 'cash', type: 'money', title: '而家手上有幾多現金存款？', hint: '即係隨時攞得出嚟嘅錢，唔計股票、基金。' },
  { key: 'debt', type: 'money', title: '每月要還幾多債？', hint: '卡數、私人貸款、學債、分期……冇就填 0。' },
  { key: 'revolving', type: 'choice', title: '你有冇卡數未還清、要「碌落去」？', hint: '即係唔係每月全數還清。',
    options: [['no', '冇，每月都全數還清'], ['sometimes', '間中有'], ['yes', '有，經常都有']] },
  { key: 'saving', type: 'money', title: '每月實際儲到幾多？', hint: '包括轉去儲蓄戶口、定期投資嘅錢。' },
  { key: 'medical', type: 'choice', title: '你有冇醫療保障？',
    options: [[0, '完全冇'], [1, '只有公司醫療'], [2, '有自己嘅醫療保障']] },
  { key: 'lifeCI', type: 'choice', title: '有冇危疾或人壽保障？', hint: '萬一有事，有冇錢頂住收入損失或者照顧屋企人。',
    options: [[0, '冇'], [1, '有，但唔肯定夠唔夠'], [2, '有，近兩年檢視過']] },
  { key: 'invest', type: 'choice', title: '除咗強積金，有冇定期投資或者為退休儲錢？',
    options: [[0, '冇'], [1, '間中，唔固定'], [2, '有，每月定期']] },
  { key: 'budget', type: 'choice', title: '你有冇記帳或者做預算嘅習慣？',
    options: [[0, '冇'], [1, '間中有'], [2, '有，每月都會睇']] },
];

const answers = {};
const PLACEHOLDER = { income: '例如 20,000', expenses: '例如 12,000', cash: '例如 30,000', debt: '冇就填 0', saving: '例如 3,000' };
let idx = 0;

function renderQ() {
  const q = QUESTIONS[idx];
  $('prog').style.width = `${(idx / QUESTIONS.length) * 100}%`;
  $('q-count').textContent = `第 ${idx + 1} / ${QUESTIONS.length} 題`;
  $('q-title').textContent = q.title;
  $('q-hint').textContent = q.hint || '';
  $('prev').disabled = idx === 0;
  $('prev').classList.toggle('disabled', idx === 0);
  $('next').textContent = idx === QUESTIONS.length - 1 ? '睇結果' : '下一題';

  if (q.type === 'money') {
    const v = answers[q.key] ?? '';
    $('q-body').innerHTML = `<div class="input-money"><input type="text" id="q-input" aria-label="${q.title}"
      placeholder="${PLACEHOLDER[q.key] || ''}" value="${v === '' ? '' : Number(v).toLocaleString('zh-HK')}"></div>`;
    const inp = $('q-input'); moneyInput(inp);
    inp.addEventListener('input', () => { answers[q.key] = readNum(inp); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') next(); });
    answers[q.key] = readNum(inp);
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  } else {
    $('q-body').innerHTML = `<div class="options">${q.options.map(([v, t]) =>
      `<button class="option" data-v="${v}" aria-pressed="${String(answers[q.key]) === String(v)}">${t}</button>`).join('')}</div>`;
    $('q-body').querySelectorAll('.option').forEach(b => b.addEventListener('click', () => {
      const raw = b.dataset.v;
      answers[q.key] = /^\d+$/.test(raw) ? Number(raw) : raw;
      $('q-body').querySelectorAll('.option').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      setTimeout(next, 180);   // 揀完自動去下一題
    }));
  }
}

function next() {
  const q = QUESTIONS[idx];
  if (q.type === 'choice' && answers[q.key] === undefined) { $('q-hint').textContent = '揀一個答案先 🙏'; return; }
  if (idx < QUESTIONS.length - 1) { idx++; renderQ(); } else showResult();
}
$('next').addEventListener('click', next);
$('prev').addEventListener('click', () => { if (idx > 0) { idx--; renderQ(); } });
$('restart').addEventListener('click', () => {
  idx = 0; $('result').classList.add('hidden'); $('quiz').classList.remove('hidden'); renderQ();
  $('quiz').scrollIntoView({ behavior: 'smooth' });
});

const DIM_LABELS = { cashflow: '現金流', emergency: '緊急備用金', debt: '負債', protection: '基本保障', habits: '增值習慣' };
let lastResult;

function tipsFor(r, a) {
  const outflow = (a.expenses || 0) + (a.debt || 0);
  const T = {
    cashflow: r.saveRate < 0.1
      ? `你而家儲蓄率大約 ${(r.saveRate * 100).toFixed(0)}%。試下出糧當日先自動轉走收入嘅 10%（約 ${money(a.income * 0.1)}）去另一個戶口，剩低先使——「先儲後使」比「使剩先儲」易得多。`
      : r.saveRate < 0.2
        ? `儲蓄率約 ${(r.saveRate * 100).toFixed(0)}%，唔錯！下一步可以試下每次加人工，將加幅一半自動撥去儲蓄，慢慢推到 20%。`
        : `儲蓄率約 ${(r.saveRate * 100).toFixed(0)}%，已經達到一般建議嘅 20%，做得好！繼續保持，並定期檢視儲落嚟嘅錢係咪用喺你嘅目標上。`,
    emergency: r.efMonths >= 6
      ? `你嘅備用金大約夠 ${r.efMonths.toFixed(1)} 個月開支，已經達到一般建議嘅 6 個月，做得好！記得收入或開支有變時再檢視一次。`
      : `你嘅備用金大約夠 ${r.efMonths.toFixed(1)} 個月開支。一般建議儲到 3–6 個月（約 ${money(outflow * 3)}–${money(outflow * 6)}），放喺隨時攞得到嘅地方，先再諗投資。`,
    debt: a.revolving === 'yes' || a.revolving === 'sometimes'
      ? '卡數利息通常好高，只還最低還款額會越滾越大。先集中還清循環卡數，係最穩陣嘅「回報」。'
      : (a.debt || 0) > 0
        ? `每月還款佔收入約 ${(r.dti * 100).toFixed(0)}%。可以列出所有債務，優先還利息最高嗰筆，同時避免再開新分期。`
        : '冇債務、卡數又每月清還，做得好！繼續保持，借錢前先諗清楚還款能力。',
    protection: r.dims.protection >= 100
      ? '你已經有醫療同危疾／人壽保障。建議每一兩年，或者人生有大轉變（例如結婚、生仔、轉工）時，檢視一次保障範圍同金額。'
      : a.medical === 1
        ? '只靠公司醫療嘅話，轉工、失業或者退休後就可能出現保障空檔。可以先了解下自己而家嘅保障範圍同上限，睇下有冇缺口。'
        : '萬一生病或者意外，醫療開支同收入損失可以好快食晒積蓄。值得花少少時間了解下自己需要邊類基本保障、預算大約幾多。',
    habits: a.budget < 2
      ? '試下用一個月時間記低每筆開支（用手機 app 或者 Excel 都得），好多人記完先發現錢原來係咁走甩。'
      : a.invest < 2
        ? '除咗強積金，可以了解下點樣為長遠目標定期儲蓄或投資，例如用「目標計算機」計下要每月放幾多。'
        : '你有記帳又有定期為長遠目標儲錢，習慣好好！可以用「目標計算機」睇下而家嘅步速，幾時可以達到目標。',
  };
  return Object.entries(r.dims).sort((x, y) => x[1] - y[1]).slice(0, 3).map(([k]) => ({ k, text: T[k] }));
}

let radar;
function showResult() {
  const r = healthScores(answers);
  const g = healthGrade(r.total);
  lastResult = { r, g };
  $('prog').style.width = '100%';
  $('quiz').classList.add('hidden');
  $('result').classList.remove('hidden');
  $('total').textContent = `${r.total} / 100`;
  $('grade').textContent = g.label;
  $('bars').innerHTML = Object.entries(r.dims).map(([k, v]) =>
    `<div class="bar-row"><span>${DIM_LABELS[k]}</span><div class="progress"><i style="width:${v}%"></i></div><b class="num">${Math.round(v)}</b></div>`).join('');
  $('tips').innerHTML = tipsFor(r, answers).map(t => `<li><b>${DIM_LABELS[t.k]}：</b>${t.text}</li>`).join('');

  if (window.Chart) {
    const data = {
      labels: Object.keys(r.dims).map(k => DIM_LABELS[k]),
      datasets: [{ data: Object.values(r.dims).map(Math.round), backgroundColor: 'rgba(31,122,85,.25)', borderColor: '#0F5C3F', pointBackgroundColor: '#0F5C3F', borderWidth: 2 }],
    };
    if (radar) { radar.data = data; radar.update(); }
    else radar = new Chart($('radar'), {
      type: 'radar', data,
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, display: false }, pointLabels: { font: { size: 13 } } } },
      },
    });
  }
  $('result').scrollIntoView({ behavior: 'smooth' });
}

// ---------- 分享卡（只顯示分數）----------
$('share-btn').addEventListener('click', () => {
  if (!lastResult) return;
  const { r, g } = lastResult;
  const cv = buildCard({
    kicker: '🩺 理財健康檢查', title: '我嘅理財健康分數係……', big: `${r.total}`, bigSub: `滿分 100・${g.label}`,
    draw(ctx, box, { C, FONT }) {
      // 雷達圖
      const keys = Object.keys(r.dims), N = keys.length;
      const cx = box.x + box.w / 2, cy = box.y + 230, R = 190;
      const pt = (i, s) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(a) * R * s, cy + Math.sin(a) * R * s]; };
      ctx.strokeStyle = C.g1; ctx.lineWidth = 2;
      [0.25, 0.5, 0.75, 1].forEach(s => { ctx.beginPath(); keys.forEach((_, i) => { const [x, y] = pt(i, s); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); });
      ctx.beginPath(); keys.forEach((k, i) => { const [x, y] = pt(i, Math.max(0.03, r.dims[k] / 100)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.fillStyle = 'rgba(31,122,85,.3)'; ctx.fill(); ctx.strokeStyle = C.g8; ctx.lineWidth = 5; ctx.stroke();
      ctx.font = `600 32px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      keys.forEach((k, i) => { const [x, y] = pt(i, 1.28); ctx.fillText(DIM_LABELS[k], x, y + 10); });
      // 分項
      let y = cy + R + 120;
      ctx.font = `600 36px ${FONT}`;
      keys.forEach(k => {
        ctx.textAlign = 'left'; ctx.fillStyle = C.ink2; ctx.fillText(DIM_LABELS[k], box.x, y);
        ctx.fillStyle = C.g1; ctx.fillRect(box.x + 250, y - 26, box.w - 360, 22);
        ctx.fillStyle = C.g8; ctx.fillRect(box.x + 250, y - 26, (box.w - 360) * r.dims[k] / 100, 22);
        ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.fillText(String(Math.round(r.dims[k])), box.x + box.w, y);
        y += 64;
      });
      ctx.textAlign = 'left';
    },
  });
  shareCanvas(cv, 'my-money-health.png', $('share-preview'));
});

renderQ();
