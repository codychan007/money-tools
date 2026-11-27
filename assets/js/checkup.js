// 理財體檢總結：將 3 步嘅結果（只喺訪客瀏覽器）放埋一頁
import { mountLayout, money, ym, esc } from './layout.js';
import { t, P, EN } from './i18n.js';
import { buildCard, shareCanvas } from './sharecard.js';
import { igUrl } from './config.js';
import { readJourney, clearJourney, STEPS, stepName, stepUrl, doneCount, chatCard, hideBottomCta } from './journey.js';

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
      <p>${t('你未做任何一步。3 步大約 3 分鐘，做完呢度就會見到你嘅總結。', "You haven't done any steps yet. The 3 steps take about 3 minutes, and your summary will appear here.")}</p>
      <a class="btn shu lg" href="${stepUrl('health')}">${t('開始第 1 步：健康檢查 →', 'Start step 1: Health check →')}</a></div>`;
    $('clear-box').classList.add('hidden');
    hideBottomCta(false);
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
      ${row(t(`建議每月儲（${s.pct}%）`, `Suggested monthly saving (${s.pct}%)`), t(`${money(s.save)}／月`, `${money(s.save)}/month`), t(`一年 ${money(s.save * 12)}`, `${money(s.save * 12)} a year`))}
      ${actual != null ? row(t('你而家實際每月儲', 'What you actually save now'), money(actual),
        actual < s.save ? t(`比建議少 ${money(s.save - actual)}`, `${money(s.save - actual)} less than suggested`) : actual > s.save ? t(`比建議多 ${money(actual - s.save)}`, `${money(actual - s.save)} more than suggested`) : t('啱啱好同建議一樣', 'Exactly as suggested')) : ''}
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

  // 建議文字按頁面語言揀；舊資料只得一種語言，語言唔夾就唔顯示
  const tipText = (() => {
    const h = j.health; if (!h?.weakestTip) return '';
    if (h.weakestTipEn) return t(h.weakestTip, h.weakestTipEn);
    const isZh = /[一-鿿]/.test(h.weakestTip);
    return isZh === !EN ? h.weakestTip : '';
  })();
  const tipInner = tipText ? `<h2>${t('最值得先處理嘅 1 件事', 'The one thing worth tackling first')}</h2>
      <p class="mt0"><b>${esc(DIM[j.health.weakest] || '')}${t('：', ': ')}</b>${esc(tipText)}</p>
      <p class="muted" style="font-size:13px;margin:0">${t('以上建議只係根據你答嘅 10 條題，你嘅實際情況可能仲有其他要考慮；內容唔涉及任何產品。', 'These suggestions are based only on your answers to the 10 questions, and your situation may involve more to think about. They do not involve any product.')}</p>` : '';
  if (tipInner && missing.length) out.push(`<section class="card tint">${tipInner}</section>`);

  if (missing.length) {
    out.push(`<section class="next-step"><div class="eyebrow">${t(`仲差 ${missing.length} 步`, `${missing.length} step${missing.length > 1 ? 's' : ''} to go`)}</div>
      <h2>${t('做埋先睇到完整總結', 'Finish them to see the full picture')}</h2>
      <div class="grid">${missing.map(s => `<a class="btn secondary block" href="${stepUrl(s)}">${t(`去做：${stepName(s)} →`, `Do it now: ${stepName(s)} →`)}</a>`).join('')}</div></section>`);
  }

  // 「3 步完成」分享圖放喺建議／預約卡上面：白色卡排埋一齊，綠色卡喺下面，顏色較統一
  if (!missing.length) {
    out.push(`<section class="card"><h2>${t('分享到 IG Story', 'Share to your IG Story')}</h2>
      <p class="muted mt0">${t('分享圖會顯示分數、儲蓄比例同達標時間，唔會顯示你嘅收入或者存款。', "The image shows your score, savings share and time to goal. It doesn't show your income or savings.")}</p>
      <label class="toggle"><input type="checkbox" id="show-amounts"> ${t('喺圖入面顯示目標金額', 'Show my goal amount in the image')}</label>
      <button class="btn block" id="share-btn">${t('生成「3 步完成」分享圖', 'Create my "3 steps done" image')}</button>
      <div class="share-preview" id="share-preview"></div></section>`);
  }

  // 「WhatsApp 我」放最尾，做晒 3 步先出；有咗佢就收埋頁底預約掣，免得叫兩次
  let chat = missing.length ? '' : chatCard(j.health, { detail: true });
  if (chat && tipInner) {   // 做晒 3 步：建議同 WhatsApp 合埋一張卡，唔使講兩次最弱嗰項
    chat = chat.replace('<section class="card tint chat-card">',
      `<section class="card tint chat-card">${tipInner}<div style="border-top:1px solid var(--line);margin:16px 0"></div>`);
  } else if (!chat && tipInner && !missing.length) out.push(`<section class="card tint">${tipInner}</section>`);
  out.push(chat);
  hideBottomCta(!!chat);

  if (!missing.length) {
    // 做晒先推介其他工具（首頁同樣做晒先出）
    const link = (href, ch, label) => `<a class="teaser" href="${P}${href}"><span class="seal" aria-hidden="true">${ch}</span><div><b>${label}</b></div><span class="arrow">→</span></a>`;
    out.push(`<section><h2 class="section-title"><span class="brush">${t('下一步可以睇', 'What to look at next')}</span></h2>
      <div class="teasers quick-links">
        ${link('/tax/', '稅', t('慳稅規劃：今年少交幾多稅', 'Tax saver: how much less tax this year'))}
        ${link('/deals/', '惠', t('優惠福利：信用卡回贈、政府福利', 'Deals and benefits: card rebates, government help'))}
        <a class="teaser wide" href="${igUrl}" target="_blank" rel="noopener"><span class="seal" aria-hidden="true">追</span><div><b>${t('追蹤我 IG：@codychan813', 'Follow me on IG: @codychan813')}</b><span>${t('淺白理財小貼士，有需要隨時搵得返我', 'Plain-language money tips, and an easy way to reach me whenever you need')}</span></div><span class="arrow">→</span></a>
      </div></section>`);
  }

  $('report').innerHTML = out.join('');
  $('clear-box').classList.remove('hidden');
}

// ---------- 「3 步完成」分享卡（唔顯示收入同存款）----------
function goalLine(g, showAmt) {
  const amt = showAmt ? t(`儲到 ${money(g.target)}`, `reach ${money(g.target)}`) : t('儲到目標', 'reach my goal');
  if (g.mode === 'time') {
    return g.months != null ? t(`${ym(g.months)}${amt}`, `${ym(g.months)} to ${amt}`) : t(`50 年內未${amt}`, `Over 50 years to ${amt}`);
  }
  return t(`${g.years} 年內${amt}`, `${amt} within ${g.years} years`);
}

$('report').addEventListener('click', e => {
  if (!e.target.closest('#share-btn')) return;
  const j = readJourney();
  if (!j.health || !j.salary || !j.goal) return;
  const h = j.health, showAmt = $('show-amounts')?.checked;
  const rows = [
    ['健', t('理財健康檢查', 'Money health check'), t(`緊急備用金夠 ${(h.efMonths || 0).toFixed(1)} 個月`, `Emergency fund: ${(h.efMonths || 0).toFixed(1)} months`)],
    ['薪', t('月薪分配', 'Salary split'), t(`每月儲 ${j.salary.pct}% 人工`, `Saving ${j.salary.pct}% of my pay`)],
    ['標', t('目標計算', 'Goal planner'), goalLine(j.goal, showAmt)],
  ];
  const cv = buildCard({
    kicker: t('理財體檢 3 步・全部完成', '3-step money check-up · all done'),
    title: t('我做完 3 步理財體檢！', 'I finished the 3-step check-up!'),
    big: `${h.total}`, bigSub: t(`理財健康分數・${GRADE[h.tone] || ''}`, `Money health score · ${GRADE[h.tone] || ''}`),
    draw(ctx, box, { C, FONT, stamp }) {
      let y = box.y + 100;
      rows.forEach(([ch, label, value], i) => {
        stamp(ctx, box.x, y, 92, ch);
        ctx.fillStyle = C.ink2; ctx.font = `500 30px ${FONT}`; ctx.fillText(`${i + 1}. ${label}`, box.x + 126, y + 36);
        ctx.fillStyle = C.ink; ctx.font = `700 40px ${FONT}`; ctx.fillText(value, box.x + 126, y + 88);
        y += 205;
        if (i < rows.length - 1) { ctx.fillStyle = C.line; ctx.fillRect(box.x, y - 55, box.w, 2); }
      });
      ctx.textAlign = 'left';
    },
  });
  shareCanvas(cv, 'my-money-checkup.png', $('share-preview'));
});

$('clear').addEventListener('click', () => {
  clearJourney();
  render();
  $('cleared').classList.remove('hidden');
});
render();
if (location.hash === '#clear-box' && !$('clear-box').classList.contains('hidden')) {
  $('clear-box').scrollIntoView({ block: 'start' });
}
