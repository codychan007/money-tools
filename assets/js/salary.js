import { mountLayout, money, readNum, moneyInput, loadJSON, sourceLine } from './layout.js';
import { mpfEmployee, mpfEmployer, takeHome, allocate } from './finance.js';

mountLayout();
const $ = id => document.getElementById(id);
moneyInput($('salary'));

// 預設值（萬一讀唔到 data/statutory.json 先用）
let MPF = { employeeRate: 0.05, employerRate: 0.05, minRelevantIncome: 7100, maxRelevantIncome: 30000 };
try {
  const s = await loadJSON('/data/statutory.json');
  MPF = s.mpf;
  $('mpf-source').innerHTML = sourceLine({ ...s.mpf, asOf: s.mpf.asOf }) +
    (s.mpf.note ? `<div class="source">⚠️ ${s.mpf.note}</div>` : '');
} catch { /* 用預設值 */ }

let donut;
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
    ? `月入少過 $${min}，你自己唔使供強積金，但老闆仍然要幫你供 5%。`
    : sal > MPF.maxRelevantIncome
      ? `月入超過 $${max}，強制性供款以 $${max} 計，所以每方每月最多供 ${money(MPF.maxRelevantIncome * MPF.employeeRate)}。`
      : `強積金供款 = 月薪 × 5%。老闆嗰份唔會入你袋，但會入你嘅強積金戶口。`;

  const a = allocate(th, needs, wants, save);
  $('alloc').innerHTML = `<tr><th>類別</th><th>比例</th><th>每月</th><th>一年</th></tr>
    <tr><td>🏠 必要開支</td><td>${needs}%</td><td>${money(a.needs)}</td><td>${money(a.needs * 12)}</td></tr>
    <tr><td>🎉 生活享受</td><td>${wants}%</td><td>${money(a.wants)}</td><td>${money(a.wants * 12)}</td></tr>
    <tr class="focus"><td>💎 儲蓄投資</td><td>${save}%</td><td>${money(a.save)}</td><td>${money(a.save * 12)}</td></tr>`;
  $('alloc-tip').innerHTML = th > 0
    ? `照呢個比例，你一年可以儲到大約 <b>${money(a.save * 12)}</b>。如果交租已經食咗大半人工，可以試 60/20/20 或者 70/20/10，最緊要係<b>有儲</b>，比例可以慢慢調。`
    : '輸入月薪就會自動計。';

  document.querySelectorAll('#presets .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.p === `${needs},${wants},${save}`)));

  if (window.Chart) {
    const data = { labels: ['必要開支', '生活享受', '儲蓄投資'], datasets: [{ data: [a.needs, a.wants, a.save].map(Math.round), backgroundColor: ['#9DC4B0', '#F4B942', '#0F5C3F'], borderWidth: 0 }] };
    if (donut) { donut.data = data; donut.update(); }
    else donut = new Chart($('donut'), {
      type: 'doughnut', data,
      options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: c => `${c.label}：${money(c.parsed)}` } } } },
    });
  }
}

$('salary').addEventListener('input', () => update());
$('needs').addEventListener('input', () => update('needs'));
$('wants').addEventListener('input', () => update('wants'));
$('presets').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const [n, w] = b.dataset.p.split(',').map(Number);
  $('needs').value = n; $('wants').value = w; update();
});
update();
