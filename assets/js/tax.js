// ============================================================
// 慳稅規劃（薪俸稅）；課稅年度清單：data/tax/index.json（每年加新年度唔使改程式）；2026-11 由人生規劃通搬過嚟
// 稅率、免稅額、扣除上限：data/tax/20xx-yy.json（已對稅務局／GovHK）
// ============================================================
import { t } from './i18n.js';
import { money, loadJSON, esc } from './layout.js';
import { wizard } from './wizard.js';
import { salariesTax, maxOutThree, justEnough, mpfEmployeeAnnual } from './calc/tax.js';

const box = document.getElementById('wizard');
const [IDX, STAT] = await Promise.all([loadJSON('/data/tax/index.json'), loadJSON('/data/statutory.json')]);
const YEARS = Object.fromEntries(await Promise.all(IDX.years.map(async y => [y.year, await loadJSON('/data/tax/' + y.file)])));
const DEFAULT = YEARS[IDX.default] ? IDX.default : IDX.years[0].year;
const Yof = a => YEARS[a.year] || YEARS[DEFAULT];
const nf = new Intl.NumberFormat('en-HK');
const cap = v => '$' + nf.format(v);
const yearLabel = y => { const s = Number(y.slice(0, 4)); return t(`${y}（${s} 年 4 月至 ${s + 1} 年 3 月）`, `${y} (Apr ${s} – Mar ${s + 1})`); };
// 理財資訊通嘅 statutory.json 欄位名唔同，喺度轉一轉
const MPF = { rate: STAT.mpf.employeeRate, minIncome: STAT.mpf.minRelevantIncome, maxIncome: STAT.mpf.maxRelevantIncome };

const Q = [
  { key: 'year', q: t('計邊個課稅年度？', 'Which year of assessment?'), type: 'options',
    opts: IDX.years.map(y => [y.year, yearLabel(y.year)]) },
  { key: 'income', q: t('全年總入息係幾多？', 'What is your total yearly income?'), help: t('薪金＋花紅＋津貼，即僱主報稅表 IR56B 嘅總數', 'Salary + bonus + allowances, i.e. the total on your employer’s IR56B'), type: 'money', min: 0, max: 1e9, def: () => 360000 },
  { key: 'marital', q: t('你嘅婚姻狀況？', 'Your marital status?'), type: 'options',
    opts: [['single', t('單身', 'Single')], ['singleParent', t('單親（獨力撫養子女）', 'Single parent (raising children alone)')], ['marriedNoIncome', t('已婚，配偶冇應課稅入息', 'Married, spouse has no taxable income')], ['marriedBoth', t('已婚，雙方都有收入', 'Married, both earn income')]] },
  { key: 'kids', q: t('你有幾多個子女可以申索子女免稅額？', 'How many children can you claim child allowance for?'), type: 'counts',
    help: a => t(`一般係 18 歲以下、或 25 歲以下全日制讀書嘅未婚子女。${a.year || DEFAULT} 年度：出生後 ${Yof(a).allowances.newbornYears} 年內有額外免稅額。`,
      `Usually unmarried children under 18, or under 25 in full-time education. ${a.year || DEFAULT}: extra allowance within ${Yof(a).allowances.newbornYears} year(s) of birth.`),
    fields: [['children', t('子女數目', 'Number of children'), 9], ['newborns', t('當中有額外免稅額嘅新生子女（見上面說明）', 'Of whom newborns with the extra allowance (see above)'), 9]] },
  { key: 'parents', q: t('你有冇供養父母／祖父母？', 'Do you support parents or grandparents?'), type: 'counts',
    help: t('每位都要符合稅務局條件（例如全年同住先有額外免稅額）', 'Each must meet IRD conditions (e.g. living with you all year for the additional allowance)'),
    fields: [['parent60Live', t('60 歲或以上，全年同住', 'Aged 60+, living with you all year'), 4], ['parent60', t('60 歲或以上，冇同住', 'Aged 60+, not living with you'), 4],
      ['parent55Live', t('55–59 歲，全年同住', 'Aged 55–59, living with you all year'), 4], ['parent55', t('55–59 歲，冇同住', 'Aged 55–59, not living with you'), 4]] },
  { key: 'housing', q: t('你住緊嘅地方係？', 'Where you live is…'), type: 'options',
    opts: [['rent', t('租嘅（自己交租）', 'Rented (you pay rent)')], ['own', t('自己供緊樓', 'Owned with a mortgage')], ['none', t('都唔係（例如同屋企人住）', 'Neither (e.g. living with family)')]] },
  { key: 'housingAmt', when: a => a.housing !== 'none', type: 'money', min: 0,
    q: a => (a.housing === 'own' ? t('全年居所貸款利息係幾多？', 'Home loan interest for the year?') : t('全年住宅租金係幾多？', 'Rent paid for the year?')),
    help: a => { const D = Yof(a).deductions, own = a.housing === 'own', base = own ? D.homeLoan : D.rent, extra = own ? D.homeLoanWithChild : D.rentWithChild; return t(`有子女同住上限 ${cap(base + extra)}，否則 ${cap(base)}`, `Cap ${cap(base + extra)} if living with your child, otherwise ${cap(base)}`); } },
  { key: 'mpf', q: t('全年強積金強制性供款（你自己嗰份）', 'Your mandatory MPF contributions for the year (your part)'), type: 'money', min: 0,
    def: a => mpfEmployeeAnnual(a.income || 0, MPF), help: a => t(`已按你入息估算，可以改；上限 ${cap(Yof(a).deductions.mpf)}`, `Estimated from your income, edit if needed; cap ${cap(Yof(a).deductions.mpf)}`) },
  { key: 'vhisPersons', q: t('你有冇幫自己或家人交自願醫保保費？', 'Do you pay VHIS premiums for yourself or family?'), type: 'options',
    opts: [['0', t('冇', 'No')], ['1', t('有，1 位受保人', 'Yes, 1 insured person')], ['2', t('有，2 位', 'Yes, 2')], ['3', t('有，3 位', 'Yes, 3')], ['4', t('有，4 位或以上', 'Yes, 4 or more')]] },
  { key: 'vhis', when: a => a.vhisPersons !== '0', q: t('全年自願醫保保費合共幾多？', 'Total VHIS premiums for the year?'), help: a => t(`每位受保人最多扣 ${cap(Yof(a).deductions.vhisPerInsured)}`, `Up to ${cap(Yof(a).deductions.vhisPerInsured)} per insured person`), type: 'money', min: 0 },
  { key: 'tvcQdap', q: t('今年 TVC（強積金自願供款）同 QDAP（合資格延期年金）合共幾多？', 'Total TVC (MPF tax-deductible voluntary contributions) and QDAP (deferred annuity) this year?'), help: a => t(`兩樣合共最多扣 ${cap(Yof(a).deductions.tvcQdap)}`, `Up to ${cap(Yof(a).deductions.tvcQdap)} combined`), type: 'money', min: 0, optional: true, skipLabel: t('冇／跳過', 'None / skip') },
  { key: 'others', q: t('仲有冇其他扣除？', 'Any other deductions?'), help: t('進修開支、長者住宿照顧開支、認可慈善捐款', 'Self-education, elderly residential care, approved donations'), type: 'options',
    opts: [['no', t('冇', 'No')], ['yes', t('有', 'Yes')]] },
  { key: 'education', when: a => a.others === 'yes', q: t('進修開支（全年）', 'Self-education expenses (year)'), help: a => t(`上限 ${cap(Yof(a).deductions.education)}`, `Cap ${cap(Yof(a).deductions.education)}`), type: 'money', min: 0, optional: true, skipLabel: t('冇', 'None') },
  { key: 'elderly', when: a => a.others === 'yes', q: t('長者住宿照顧開支（全年）', 'Elderly residential care expenses (year)'), help: a => t(`上限 ${cap(Yof(a).elderlyCare)}`, `Cap ${cap(Yof(a).elderlyCare)}`), type: 'money', min: 0, optional: true, skipLabel: t('冇', 'None') },
  { key: 'donation', when: a => a.others === 'yes', q: t('認可慈善捐款（全年）', 'Approved charitable donations (year)'), help: a => t(`上限為入息（扣除其他扣除後）嘅 ${Math.round(Yof(a).deductions.donationPct * 100)}%`, `Capped at ${Math.round(Yof(a).deductions.donationPct * 100)}% of income after other deductions`), type: 'money', min: 0, optional: true, skipLabel: t('冇', 'None') },
];
function toParams(a) {
  return {
    income: a.income || 0, marital: a.marital, children: a.children || 0, newborns: a.newborns || 0,
    parent60: a.parent60 || 0, parent60Live: a.parent60Live || 0, parent55: a.parent55 || 0, parent55Live: a.parent55Live || 0,
    housing: a.housing, housingAmt: a.housingAmt || 0, mpf: a.mpf || 0,
    vhisPersons: Number(a.vhisPersons || 0), vhis: a.vhis || 0, tvcQdap: a.tvcQdap || 0,
    education: a.education || 0, elderly: a.elderly || 0, donation: a.donation || 0,
  };
}

/** 「慳稅規劃」：最少要多扣幾多先令稅款歸零，同埋點樣分配自願醫保同 TVC／QDAP */
function planHtml(Y, p, r) {
  const j = justEnough(Y, p);
  if (r.tax <= 0) return `<p class="callout green">${t('你估計唔使交稅，暫時唔使為慳稅加扣除。', 'You likely pay no tax, so extra deductions won’t help now.')}</p>`;
  if (j.need <= 0) return `<p class="callout green">${t('你已經用盡自願醫保同 TVC／QDAP 嘅上限。', 'You have already used the full VHIS and TVC / QDAP limits.')}</p>`;
  const zero = j.floor <= 0.5;
  const capV = Y.deductions.vhisPerInsured, capT = Y.deductions.tvcQdap;
  const who = p.vhisPersons > 0 ? t(`${j.persons} 位受保人`, `${j.persons} insured`) : t('當你自己 1 位受保人', 'counting just you');
  const vOnly = j.need <= j.roomV, tOnly = j.need <= j.roomT;
  const a = Math.min(j.need, j.roomV), b = j.need - a;
  const opts = [
    `<li><b>${t('只用自願醫保：', 'VHIS only: ')}</b>${vOnly
      ? t(`多交 ${money(j.need)} 保費就夠（${who}，每位上限 ${cap(capV)}）`, `${money(j.need)} more in premiums is enough (${who}, cap ${cap(capV)} each)`)
      : t(`最多只可以多扣 ${money(j.roomV)}（${who}，每位上限 ${cap(capV)}），唔夠，要夾埋 TVC／QDAP`, `At most ${money(j.roomV)} more (${who}, cap ${cap(capV)} each), not enough on its own`)}</li>`,
    `<li><b>${t('只用 TVC／QDAP：', 'TVC / QDAP only: ')}</b>${tOnly
      ? t(`多供 ${money(j.need)} 就夠（兩樣合共上限 ${cap(capT)}）`, `${money(j.need)} more is enough (combined cap ${cap(capT)})`)
      : t(`最多只可以多扣 ${money(j.roomT)}（兩樣合共上限 ${cap(capT)}），唔夠，要夾埋自願醫保`, `At most ${money(j.roomT)} more (combined cap ${cap(capT)}), not enough on its own`)}</li>`,
    `<li><b>${t('兩樣夾埋：', 'A mix of both: ')}</b>${t(`合共多扣 ${money(j.need)} 就得，喺各自上限之內點分都得，例如自願醫保 ${money(a)}${b > 0 ? ` ＋ TVC／QDAP ${money(b)}` : ''}`, `${money(j.need)} more in total, split any way within each cap, e.g. VHIS ${money(a)}${b > 0 ? ` + TVC / QDAP ${money(b)}` : ''}`)}</li>`,
  ];
  return `<div>
          <h3>${zero ? t('最少要多扣幾多，稅款先會歸零？', 'The least extra you need for zero tax') : t('最多可以慳幾多？', 'The most you could save')}</h3>
          <div class="big-result">${money(j.need)}</div>
          <p>${zero
            ? t(`只要多 ${money(j.need)} 嘅自願醫保保費或者 TVC／QDAP 供款，稅款就由 <b>${money(r.tax)}</b> 減到 <b>$0</b>，慳 <b>${money(j.saving)}</b>。唔使買到上限，多過呢個數都唔會再慳到稅。`,
                `Just ${money(j.need)} more in VHIS premiums or TVC / QDAP contributions takes your tax from <b>${money(r.tax)}</b> to <b>$0</b>, saving <b>${money(j.saving)}</b>. You don’t need to go up to the limits; anything above this saves no more tax.`)
            : t(`就算用盡上限，稅款都只可以由 <b>${money(r.tax)}</b> 減到 <b>${money(j.floor)}</b>，慳 <b>${money(j.saving)}</b>。要做到呢個效果，要多扣 ${money(j.need)}。`,
                `Even at the full limits, your tax only falls from <b>${money(r.tax)}</b> to <b>${money(j.floor)}</b>, saving <b>${money(j.saving)}</b>. That takes ${money(j.need)} more in deductions.`)}</p>
          <ul class="tips">${opts.join('')}</ul>
          <p class="muted" style="font-size:13px">${t('要真係交咗保費／供咗款先可以扣；呢啲係長期承擔，唔好單為慳稅而做。自願醫保要每位受保人有自己嘅保單先計得。', 'You can only deduct what you actually pay; these are long-term commitments, so don’t do it just for tax. VHIS needs a policy for each insured person.')}</p>
        </div>`;
}

function result(a, api) {
  const p = toParams(a);
  const draw = year => {
    const Y = YEARS[year];
    const m = maxOutThree(Y, p), r = m.before;
    const row = (l, v, strong) => `<div class="report-row"><span>${l}</span><b ${strong ? '' : 'style="font-size:1.05rem"'}>${v}</b></div>`;
    const D = r.ded.items;
    const dedRows = [
      [t('強積金強制性供款', 'Mandatory MPF'), D.mpf], [t('自願醫保保費', 'VHIS premiums'), D.vhis], [t('TVC＋QDAP', 'TVC + QDAP'), D.tvcQdap],
      [p.housing === 'own' ? t('居所貸款利息', 'Home loan interest') : t('住宅租金', 'Domestic rent'), D.housing], [t('進修開支', 'Self-education'), D.education],
      [t('長者住宿照顧', 'Elderly residential care'), D.elderly], [t('認可慈善捐款', 'Approved donations'), D.donation],
    ].filter(x => x[1] > 0);
    box.innerHTML = `
      <div class="stack">
        <div class="year-switch"><span class="muted">${t('課稅年度：', 'Year:')}</span>${Object.keys(YEARS).map(k => `<button type="button" class="chip" data-year="${k}" aria-pressed="${k === year}">${k}</button>`).join('')}</div>
        <div>
          <div class="q-step">${t(`${year} 估計應繳薪俸稅`, `Estimated ${year} salaries tax`)}</div>
          <div class="big-result">${money(r.tax)}</div>
          ${r.reduction > 0 ? `<p class="muted" style="font-size:14px">${t(`已扣一次性寬減 ${money(r.reduction)}`, `After one-off reduction of ${money(r.reduction)}`)}</p>` : ''}
        </div>
        <div>
          ${row(t('全年入息', 'Total income'), money(p.income))}
          ${dedRows.map(([l, v]) => row(`− ${l}`, money(v))).join('') || row(t('− 扣除', '− Deductions'), money(0))}
          ${row(t('入息淨額', 'Net income'), money(r.net))}
          ${row(t('− 免稅額', '− Allowances'), money(r.allow))}
          ${row(t('應課稅入息實額', 'Net chargeable income'), money(r.nci))}
          ${row(t('累進稅率計', 'Progressive rates'), money(r.prog))}
          ${row(t('標準稅率計', 'Standard rate'), money(r.std))}
          <p class="muted" style="font-size:14px">${r.useStd ? t('標準稅率計出嚟較少，所以用標準稅率。', 'The standard rate gives less tax, so it applies.') : t('兩種計法取較低者：今次用累進稅率。', 'The lower of the two applies: progressive rates here.')}</p>
        </div>
        ${planHtml(Y, p, r)}
        ${p.marital === 'marriedBoth' ? `<p class="callout">${t('雙方都有收入：呢度只計你一個（分開評稅），子女同父母免稅額當你申索。夫婦可以比較「合併評稅」，有時會更少稅。', 'Both earn income: this shows your separate assessment only, with child and parent allowances claimed by you. Couples can compare joint assessment, which sometimes lowers tax.')}</p>` : ''}
        <p class="muted" style="font-size:13px">${t(`只計薪俸稅；個人入息課稅、合併評稅只作提示。數字來源：稅務局／GovHK（核對日期 ${esc(Y.verifiedOn)}）。實際稅款以稅務局評稅為準。`, `Salaries tax only; personal assessment and joint assessment are mentioned for reference. Figures from IRD / GovHK (checked ${esc(Y.verifiedOn)}). Your actual tax is set by the IRD assessment.`)}
          <a href="${esc(Y.budgetUrl)}" target="_blank" rel="noopener">${t('稅務局預算案措施', 'IRD budget measures')}</a></p>
        <div class="q-nav"><button type="button" class="btn secondary" data-edit>${t('← 改答案', '← Change answers')}</button>
          <button type="button" class="btn secondary" data-restart>${t('重新答過', 'Start over')}</button></div>
      </div>`;
    box.querySelectorAll('[data-year]').forEach(b => b.addEventListener('click', () => draw(b.dataset.year)));
    box.querySelector('[data-edit]').addEventListener('click', api.edit);
    box.querySelector('[data-restart]').addEventListener('click', api.restart);
  };
  draw(a.year || DEFAULT);
}

wizard(box, Q, result);
