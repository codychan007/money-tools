import { mountLayout, money, readNum, moneyInput, loadJSON, sourceLine } from './layout.js';
import { mpfEmployee, mpfEmployer, takeHome, allocate } from './finance.js';
import { t, EN } from './i18n.js';
import { saveStep, readJourney, nextCard, stepUrl } from './journey.js';

mountLayout();
const $ = id => document.getElementById(id);
moneyInput($('salary'));

// 預設值（萬一讀唔到 data/statutory.json 先用）
let MPF = { employeeRate: 0.05, employerRate: 0.05, minRelevantIncome: 7100, maxRelevantIncome: 30000 };
try {
  const s = await loadJSON('/data/statutory.json');
  MPF = s.mpf;
  const m = EN ? { ...s.mpf, source: s.mpf.source_en || s.mpf.source, sourceUrl: s.mpf.sourceUrl_en || s.mpf.sourceUrl, asOf: s.mpf.asOf_en || s.mpf.asOf } : s.mpf;
  const note = EN ? s.mpf.note_en : s.mpf.note;
  $('mpf-source').innerHTML = sourceLine(m) + (note ? `<div class="source">${note}</div>` : '');
} catch { /* 用預設值 */ }

const LBL = { needs: t('必要開支', 'Needs'), wants: t('生活享受', 'Wants'), save: t('儲蓄投資', 'Savings') };
let donut, touched = false, last;

function nextStepHtml() {
  const j = readJourney();
  const yearSave = money(last.save * 12);
  const actual = j.health?.saving;
  const compare = actual != null && last.save > 0
    ? (actual < last.save
      ? t(`第 1 步你話每月實際儲 ${money(actual)}，比呢個分配少 ${money(last.save - actual)}。`,
        `In step 1 you said you actually save ${money(actual)} a month, ${money(last.save - actual)} less than this split.`)
      : t(`第 1 步你話每月實際儲 ${money(actual)}，已經做到呢個分配。`, `In step 1 you said you actually save ${money(actual)} a month, already in line with this split.`))
    : '';
  return nextCard({
    eyebrow: t('第 2 步・下一步 3 / 3', 'Step 2 · Next: step 3 of 3'),
    title: t(`照 ${last.pct}% 儲蓄，你每月可以儲 ${money(last.save)}，一年 ${yearSave}。`,
      `Saving ${last.pct}%, you would put away ${money(last.save)} a month, ${yearSave} a year.`),
    body: `${compare}${compare ? t('', ' ') : ''}${t('咁用呢個數，幾時先儲到你嘅目標？', 'So at this pace, when do you reach your goal?')}`,
    unlock: t('第 3 步會用你嘅數字預先填好，再話你知：遲 5 年先開始，每月要多儲幾多先追得返。',
      'Step 3 is pre-filled with your numbers, and shows how much more a month you would need if you started 5 years later.'),
    href: `${stepUrl('goal')}?from=checkup`,
    button: t('去第 3 步：目標計算 →', 'Go to step 3: Goal planner →'),
  });
}

function update(changed) {
  const sal = readNum($('salary'));
  let needs = +$('needs').value, wants = +$('wants').value;
  if (needs + wants > 100) {
    if (changed === 'needs') wants = 100 - needs; else needs = 100 - wants;
    $('needs').value = needs; $('wants').value = wants;
  }
  const save = 100 - needs - wants;
  $('needs-pct').textContent = needs; $('wants-pct').textContent = wants; $('save-pct').textContent = save;

  const ee = mpfEmployee(sal, MPF), er = mpfEmployer(sal, MPF), th = takeHome(sal, MPF);
  $('take-home').textContent = money(th);
  $('ee').textContent = money(ee); $('er').textContent = money(er);
  const min = MPF.minRelevantIncome.toLocaleString(), max = MPF.maxRelevantIncome.toLocaleString();
  $('mpf-note').textContent = sal < MPF.minRelevantIncome
    ? t(`月入少過 $${min}，你自己唔使供強積金，但老闆仍然要幫你供 5%。`, `Earning under $${min} a month, you don't contribute to MPF, but your employer still pays 5%.`)
    : sal > MPF.maxRelevantIncome
      ? t(`月入超過 $${max}，強制性供款以 $${max} 計，所以每方每月最多供 ${money(MPF.maxRelevantIncome * MPF.employeeRate)}。`,
        `Earning over $${max} a month, mandatory contributions are based on $${max}, so each side pays at most ${money(MPF.maxRelevantIncome * MPF.employeeRate)} a month.`)
      : t('強積金供款 = 月薪 × 5%。老闆嗰份唔會入你袋，但會入你嘅強積金戶口。',
        "MPF contribution = monthly salary × 5%. Your employer's share doesn't reach your pocket, but it goes into your MPF account.");

  const a = allocate(th, needs, wants, save);
  $('alloc').innerHTML = `<tr><th>${t('類別', 'Category')}</th><th>${t('比例', 'Share')}</th><th>${t('每月', 'Monthly')}</th><th>${t('一年', 'Yearly')}</th></tr>
    <tr><td>${LBL.needs}</td><td>${needs}%</td><td>${money(a.needs)}</td><td>${money(a.needs * 12)}</td></tr>
    <tr><td>${LBL.wants}</td><td>${wants}%</td><td>${money(a.wants)}</td><td>${money(a.wants * 12)}</td></tr>
    <tr class="focus"><td>${LBL.save}</td><td>${save}%</td><td>${money(a.save)}</td><td>${money(a.save * 12)}</td></tr>`;
  $('alloc-tip').innerHTML = th > 0
    ? t(`照呢個比例，你一年可以儲到大約 <b>${money(a.save * 12)}</b>。如果交租已經食咗大半人工，可以試 60/20/20 或者 70/20/10，最緊要係<b>有儲</b>，比例可以慢慢調。`,
      `At this split you would save about <b>${money(a.save * 12)}</b> a year. If rent already takes most of your pay, try 60/20/20 or 70/20/10. What matters most is that you <b>save something</b>; you can adjust the split over time.`)
    : t('輸入月薪就會自動計。', 'Enter your salary to see the numbers.');

  document.querySelectorAll('#presets .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.p === `${needs},${wants},${save}`)));

  last = { salary: sal, takeHome: th, save: a.save, pct: save, needs, wants };
  $('next-step').innerHTML = th > 0 ? nextStepHtml() : '';
  if (touched && th > 0) saveStep('salary', last);

  if (window.Chart) {
    const data = { labels: [LBL.needs, LBL.wants, LBL.save], datasets: [{ data: [a.needs, a.wants, a.save].map(Math.round), backgroundColor: ['#D6C9AF', '#B98327', '#B5361F'], borderColor: '#FBF7EE', borderWidth: 2 }] };
    if (donut) { donut.data = data; donut.update(); }
    else donut = new Chart($('donut'), {
      type: 'doughnut', data,
      options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, color: '#231F1C' } }, tooltip: { callbacks: { label: c => `${c.label}${t('：', ': ')}${money(c.parsed)}` } } } },
    });
  }
}

const touch = () => { touched = true; };
$('salary').addEventListener('input', () => { touch(); update(); });
$('needs').addEventListener('input', () => { touch(); update('needs'); });
$('wants').addEventListener('input', () => { touch(); update('wants'); });
$('presets').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const [n, w] = b.dataset.p.split(',').map(Number);
  $('needs').value = n; $('wants').value = w; touch(); update();
});
// 撳「去第 3 步」都當完成咗呢步（就算冇改過預設數字）
$('next-step').addEventListener('click', e => { if (e.target.closest('a') && last?.takeHome > 0) saveStep('salary', last); });
update();
