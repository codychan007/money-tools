import { mountLayout, money, readNum, moneyInput } from './layout.js';
import { healthScores, healthGrade } from './finance.js';
import { buildCard, shareCanvas } from './sharecard.js';
import { t, locale } from './i18n.js';
import { saveStep, nextCard, stepUrl } from './journey.js';

mountLayout();
const $ = id => document.getElementById(id);

// 問題清單：type 'money' = 輸入金額；'choice' = 選擇題
const QUESTIONS = [
  { key: 'income', type: 'money', title: t('每月收入大約幾多？', 'Roughly how much do you earn each month?'),
    hint: t('扣完強積金、實際入到銀行嗰個數。', 'After MPF, the amount that actually lands in your bank account.') },
  { key: 'expenses', type: 'money', title: t('每月生活開支大約幾多？', 'Roughly how much do you spend each month?'),
    hint: t('租金、家用、食飯、交通、娛樂……唔計還債。', 'Rent, family, food, transport, fun… not counting loan repayments.') },
  { key: 'cash', type: 'money', title: t('而家手上有幾多現金存款？', 'How much cash savings do you have now?'),
    hint: t('即係隨時攞得出嚟嘅錢，唔計股票、基金。', 'Money you can get at any time. Not stocks or funds.') },
  { key: 'debt', type: 'money', title: t('每月要還幾多債？', 'How much do you repay on debts each month?'),
    hint: t('卡數、私人貸款、學債、分期……冇就填 0。', 'Credit cards, personal loans, student loans, instalments… enter 0 if none.') },
  { key: 'revolving', type: 'choice', title: t('你有冇卡數未還清、要「碌落去」？', 'Do you carry a credit card balance from month to month?'),
    hint: t('即係唔係每月全數還清。', 'That is, not paying the full statement balance every month.'),
    options: [['no', t('冇，每月都全數還清', 'No, I pay it off in full every month')], ['sometimes', t('間中有', 'Sometimes')], ['yes', t('有，經常都有', 'Yes, often')]] },
  { key: 'saving', type: 'money', title: t('每月實際儲到幾多？', 'How much do you actually save each month?'),
    hint: t('包括轉去儲蓄戶口、定期投資嘅錢。', 'Including transfers to savings and regular investing.') },
  { key: 'medical', type: 'choice', title: t('你有冇醫療保障？', 'Do you have medical cover?'),
    options: [[0, t('完全冇', 'None at all')], [1, t('只有公司醫療', 'Only through my employer')], [2, t('有自己嘅醫療保障', 'Yes, my own medical cover')]] },
  { key: 'lifeCI', type: 'choice', title: t('有冇危疾或人壽保障？', 'Do you have critical illness or life cover?'),
    hint: t('萬一有事，有冇錢頂住收入損失或者照顧屋企人。', 'If something happened, would there be money to replace your income or look after your family?'),
    options: [[0, t('冇', 'No')], [1, t('有，但唔肯定夠唔夠', "Yes, but I'm not sure it's enough")], [2, t('有，近兩年檢視過', 'Yes, reviewed in the last two years')]] },
  { key: 'invest', type: 'choice', title: t('除咗強積金，有冇定期投資或者為退休儲錢？', 'Apart from MPF, do you invest or save for retirement regularly?'),
    options: [[0, t('冇', 'No')], [1, t('間中，唔固定', 'Now and then')], [2, t('有，每月定期', 'Yes, every month')]] },
  { key: 'budget', type: 'choice', title: t('你有冇記帳或者做預算嘅習慣？', 'Do you track spending or keep a budget?'),
    options: [[0, t('冇', 'No')], [1, t('間中有', 'Sometimes')], [2, t('有，每月都會睇', 'Yes, I check it every month')]] },
];

const answers = {};
const PLACEHOLDER = {
  income: t('例如 20,000', 'e.g. 20,000'), expenses: t('例如 12,000', 'e.g. 12,000'), cash: t('例如 30,000', 'e.g. 30,000'),
  debt: t('冇就填 0', '0 if none'), saving: t('例如 3,000', 'e.g. 3,000'),
};
let idx = 0;

function renderQ() {
  const q = QUESTIONS[idx];
  $('prog').style.width = `${(idx / QUESTIONS.length) * 100}%`;
  $('q-count').textContent = t(`第 ${idx + 1} / ${QUESTIONS.length} 題`, `Question ${idx + 1} of ${QUESTIONS.length}`);
  $('q-title').textContent = q.title;
  $('q-hint').textContent = q.hint || '';
  $('prev').disabled = idx === 0;
  $('prev').classList.toggle('disabled', idx === 0);
  $('next').textContent = idx === QUESTIONS.length - 1 ? t('睇結果', 'See my score') : t('下一題', 'Next');

  if (q.type === 'money') {
    const v = answers[q.key] ?? '';
    $('q-body').innerHTML = `<div class="input-money"><input type="text" id="q-input" aria-label="${q.title}"
      placeholder="${PLACEHOLDER[q.key] || ''}" value="${v === '' ? '' : Number(v).toLocaleString(locale)}"></div>`;
    const inp = $('q-input'); moneyInput(inp);
    inp.addEventListener('input', () => { answers[q.key] = readNum(inp); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') next(); });
    answers[q.key] = readNum(inp);
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  } else {
    $('q-body').innerHTML = `<div class="options">${q.options.map(([v, label]) =>
      `<button class="option" data-v="${v}" aria-pressed="${String(answers[q.key]) === String(v)}">${label}</button>`).join('')}</div>`;
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
  if (q.type === 'choice' && answers[q.key] === undefined) { $('q-hint').textContent = t('揀一個答案先', 'Please pick an answer first'); return; }
  if (idx < QUESTIONS.length - 1) { idx++; renderQ(); } else showResult();
}
$('next').addEventListener('click', next);
$('prev').addEventListener('click', () => { if (idx > 0) { idx--; renderQ(); } });
$('restart').addEventListener('click', () => {
  idx = 0; $('result').classList.add('hidden'); $('quiz').classList.remove('hidden'); renderQ();
  $('quiz').scrollIntoView({ behavior: 'smooth' });
});

const DIM_LABELS = {
  cashflow: t('現金流', 'Cash flow'), emergency: t('緊急備用金', 'Emergency fund'), debt: t('負債', 'Debt'),
  protection: t('基本保障', 'Protection'), habits: t('增值習慣', 'Money habits'),
};
const GRADE_EN = { good: 'In good shape', ok: 'Not bad, room to improve', warn: 'Room for improvement', bad: 'Worth a closer look' };
let lastResult;

function tipsFor(r, a) {
  const outflow = (a.expenses || 0) + (a.debt || 0);
  const sr = (r.saveRate * 100).toFixed(0);
  const T = {
    cashflow: r.saveRate < 0.1
      ? t(`你而家儲蓄率大約 ${sr}%。試下出糧當日先自動轉走收入嘅 10%（約 ${money(a.income * 0.1)}）去另一個戶口，剩低先使——「先儲後使」比「使剩先儲」易得多。`,
        `You save about ${sr}% of your income. Try moving 10% (about ${money(a.income * 0.1)}) to a separate account on payday, then spend what's left. Saving first is much easier than saving what's left over.`)
      : r.saveRate < 0.2
        ? t(`儲蓄率約 ${sr}%，唔錯！下一步可以試下每次加人工，將加幅一半自動撥去儲蓄，慢慢推到 20%。`,
          `You save about ${sr}%. Nice! Next, each time you get a raise, send half of it straight to savings and work up to 20%.`)
        : t(`儲蓄率約 ${sr}%，已經達到一般建議嘅 20%，做得好！繼續保持，並定期檢視儲落嚟嘅錢係咪用喺你嘅目標上。`,
          `You save about ${sr}%, at or above the common 20% guideline. Well done! Keep it up, and check now and then that the money is going towards your goals.`),
    emergency: r.efMonths >= 6
      ? t(`你嘅備用金大約夠 ${r.efMonths.toFixed(1)} 個月開支，已經達到一般建議嘅 6 個月，做得好！記得收入或開支有變時再檢視一次。`,
        `Your emergency fund covers about ${r.efMonths.toFixed(1)} months of spending, meeting the common 6-month guideline. Review it whenever your income or spending changes.`)
      : t(`你嘅備用金大約夠 ${r.efMonths.toFixed(1)} 個月開支。一般建議儲到 3–6 個月（約 ${money(outflow * 3)}–${money(outflow * 6)}），放喺隨時攞得到嘅地方，先再諗投資。`,
        `Your emergency fund covers about ${r.efMonths.toFixed(1)} months of spending. A common guideline is 3–6 months (about ${money(outflow * 3)}–${money(outflow * 6)}) kept somewhere easy to reach, before you think about investing.`),
    debt: a.revolving === 'yes' || a.revolving === 'sometimes'
      ? t('卡數利息通常好高，只還最低還款額會越滾越大。先集中還清循環卡數，係最穩陣嘅「回報」。',
        'Credit card interest is usually very high, and paying only the minimum lets it snowball. Clearing that balance first is the safest "return" you can get.')
      : (a.debt || 0) > 0
        ? t(`每月還款佔收入約 ${(r.dti * 100).toFixed(0)}%。可以列出所有債務，優先還利息最高嗰筆，同時避免再開新分期。`,
          `Repayments take about ${(r.dti * 100).toFixed(0)}% of your income. List all your debts, pay off the highest-interest one first, and avoid new instalment plans.`)
        : t('冇債務、卡數又每月清還，做得好！繼續保持，借錢前先諗清楚還款能力。',
          'No debts and your card is paid off every month. Well done! Before borrowing, make sure you can comfortably repay.'),
    protection: r.dims.protection >= 100
      ? t('你已經有醫療同危疾／人壽保障。建議每一兩年，或者人生有大轉變（例如結婚、生仔、轉工）時，檢視一次保障範圍同金額。',
        'You already have medical and critical illness or life cover. Review it every year or two, or after big life changes like marriage, a new baby or a new job.')
      : a.medical === 1
        ? t('只靠公司醫療嘅話，轉工、失業或者退休後就可能出現保障空檔。可以先了解下自己而家嘅保障範圍同上限，睇下有冇缺口。',
          'If you rely only on employer medical cover, there can be a gap when you change jobs, lose your job or retire. Start by checking what your current cover includes and its limits.')
        : t('萬一生病或者意外，醫療開支同收入損失可以好快食晒積蓄。值得花少少時間了解下自己需要邊類基本保障、預算大約幾多。',
          'An illness or accident can eat through savings quickly through medical bills and lost income. It is worth taking a little time to understand what basic cover you need and roughly what it costs.'),
    habits: a.budget < 2
      ? t('試下用一個月時間記低每筆開支（用手機 app 或者 Excel 都得），好多人記完先發現錢原來係咁走甩。',
        'Try writing down every expense for one month (an app or a spreadsheet is fine). Many people only then see where the money goes.')
      : a.invest < 2
        ? t('除咗強積金，可以了解下點樣為長遠目標定期儲蓄或投資，例如用「目標計算機」計下要每月放幾多。',
          'Beyond MPF, look into saving or investing regularly for long-term goals. The goal planner shows how much you would need each month.')
        : t('你有記帳又有定期為長遠目標儲錢，習慣好好！可以用「目標計算機」睇下而家嘅步速，幾時可以達到目標。',
          'You track spending and save regularly for long-term goals. Great habits! Use the goal planner to see when your current pace gets you there.'),
  };
  return Object.entries(r.dims).sort((x, y) => x[1] - y[1]).slice(0, 3).map(([k]) => ({ k, text: T[k] }));
}

function nextStepHtml(r, a) {
  const sr = Math.round(r.saveRate * 100);
  const yearGap = a.income > 0 && r.saveRate < 0.2 ? money((0.2 - r.saveRate) * a.income * 12) : null;
  const title = yearGap
    ? t(`你每月儲收入嘅 ${sr}%。如果做到 20%，一年會多儲 ${yearGap}。`, `You save ${sr}% of your income. At 20%, you would save ${yearGap} more a year.`)
    : t(`你每月儲收入嘅 ${sr}%。咁你份人工，最理想點樣分？`, `You save ${sr}% of your income. So what is the best way to split your pay?`);
  return nextCard({
    eyebrow: t('第 1 步完成・下一步 2 / 3', 'Step 1 done · Next: step 2 of 3'),
    title,
    body: t('第 2 步用月薪分配計算器，睇下扣埋強積金之後，你份人工每月應該儲幾多，同你而家實際儲嘅差幾遠。',
      'Step 2 uses the salary split calculator to show how much your pay should be saving after MPF, and how far that is from what you save now.'),
    unlock: t('做完第 2 步，第 3 步會話你：照呢個儲法，幾時先儲到你嘅目標；遲 5 年先開始又會差幾遠。',
      'After step 2, step 3 shows when that pace gets you to your goal, and what starting 5 years later would cost you.'),
    href: stepUrl('salary'),
    button: t('去第 2 步：月薪分配 →', 'Go to step 2: Salary split →'),
  });
}

let radar;
function showResult() {
  const r = healthScores(answers);
  const g = healthGrade(r.total);
  const label = t(g.label, GRADE_EN[g.tone]);
  lastResult = { r, g, label };
  $('prog').style.width = '100%';
  $('quiz').classList.add('hidden');
  $('result').classList.remove('hidden');
  $('total').textContent = `${r.total} / 100`;
  $('grade').textContent = label;
  $('bars').innerHTML = Object.entries(r.dims).map(([k, v]) =>
    `<div class="bar-row"><span>${DIM_LABELS[k]}</span><div class="progress"><i style="width:${v}%"></i></div><b class="num">${Math.round(v)}</b></div>`).join('');
  const tips = tipsFor(r, answers);
  $('tips').innerHTML = tips.map(x => `<li><b>${DIM_LABELS[x.k]}${t('：', ': ')}</b>${x.text}</li>`).join('');
  $('next-step').innerHTML = nextStepHtml(r, answers);

  saveStep('health', {
    total: r.total, tone: g.tone, dims: r.dims, saveRate: r.saveRate, efMonths: r.efMonths,
    income: answers.income || 0, expenses: answers.expenses || 0, cash: answers.cash || 0, saving: answers.saving || 0,
    weakest: tips[0]?.k, weakestTip: tips[0]?.text,
  });

  if (window.Chart) {
    const data = {
      labels: Object.keys(r.dims).map(k => DIM_LABELS[k]),
      datasets: [{ data: Object.values(r.dims).map(Math.round), backgroundColor: 'rgba(181,54,31,.16)', borderColor: '#B5361F', pointBackgroundColor: '#B5361F', borderWidth: 2 }],
    };
    if (radar) { radar.data = data; radar.update(); }
    else radar = new Chart($('radar'), {
      type: 'radar', data,
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 25, display: false }, grid: { color: '#D6C9AF' }, angleLines: { color: '#D6C9AF' },
          pointLabels: { font: { size: 13 }, color: '#231F1C' } } },
      },
    });
  }
  $('result').scrollIntoView({ behavior: 'smooth' });
}

// ---------- 分享卡（只顯示分數）----------
$('share-btn').addEventListener('click', () => {
  if (!lastResult) return;
  const { r, label } = lastResult;
  const cv = buildCard({
    kicker: t('理財健康檢查', 'Money health check'), title: t('我嘅理財健康分數係……', 'My money health score is…'),
    big: `${r.total}`, bigSub: t(`滿分 100・${label}`, `out of 100 · ${label}`),
    draw(ctx, box, { C, FONT }) {
      // 雷達圖
      const keys = Object.keys(r.dims), N = keys.length;
      const cx = box.x + box.w / 2, cy = box.y + 230, R = 190;
      const pt = (i, s) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + Math.cos(a) * R * s, cy + Math.sin(a) * R * s]; };
      ctx.strokeStyle = C.line; ctx.lineWidth = 2;
      [0.25, 0.5, 0.75, 1].forEach(s => { ctx.beginPath(); keys.forEach((_, i) => { const [x, y] = pt(i, s); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); });
      ctx.beginPath(); keys.forEach((k, i) => { const [x, y] = pt(i, Math.max(0.03, r.dims[k] / 100)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      ctx.fillStyle = 'rgba(181,54,31,.18)'; ctx.fill(); ctx.strokeStyle = C.shu; ctx.lineWidth = 5; ctx.stroke();
      ctx.font = `600 30px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      keys.forEach((k, i) => { const [x, y] = pt(i, 1.3); ctx.fillText(DIM_LABELS[k], x, y + 10); });
      // 分項
      let y = cy + R + 120;
      ctx.font = `600 34px ${FONT}`;
      keys.forEach(k => {
        ctx.textAlign = 'left'; ctx.fillStyle = C.ink2; ctx.fillText(DIM_LABELS[k], box.x, y);
        ctx.fillStyle = C.paper2; ctx.fillRect(box.x + 290, y - 26, box.w - 400, 22);
        ctx.fillStyle = C.matcha; ctx.fillRect(box.x + 290, y - 26, (box.w - 400) * r.dims[k] / 100, 22);
        ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.fillText(String(Math.round(r.dims[k])), box.x + box.w, y);
        y += 64;
      });
      ctx.textAlign = 'left';
    },
  });
  shareCanvas(cv, 'my-money-health.png', $('share-preview'));
});

renderQ();
