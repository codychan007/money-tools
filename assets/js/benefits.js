// ============================================================
// 福利檢查（/deals/ 「福利檢查」分頁）
// 12 條問題 → 每項福利：很可能符合／可能符合／不符合，附原因、金額、申請方法同官方連結
// 文字同數字喺 data/benefits.json（每 3 個月更新）；呢度只係判斷規則
// 答案唔會儲存，亦唔會上傳
// ============================================================
import { t, EN } from './i18n.js';
import { loadJSON, money, esc, safeUrl } from './layout.js';
import { wizard } from './wizard.js';
import { hideBottomCta } from './journey.js';

const box = document.getElementById('benefit-box');
if (box) init();

async function init() {
  const D = await loadJSON('/data/benefits.json');
  const T = D.tables;
  const L = o => (o == null ? '' : typeof o === 'string' ? o : (EN ? o.en : o.zh) ?? o.zh);
  const byId = Object.fromEntries(D.items.map(i => [i.id, i]));

  // ---------------- 問題 ----------------
  const unsure = ['unsure', t('不確定', 'Not sure')];
  const Q = [
    { key: 'age', q: t('你今年幾多歲？', 'How old are you?'), type: 'options',
      opts: [['18-24', '18 – 24'], ['25-29', '25 – 29'], ['30-35', '30 – 35'], ['36-40', '36 – 40'], ['41+', t('41 歲或以上', '41 or above')]] },
    { key: 'res', q: t('你喺香港嘅居民身份係？', 'What is your Hong Kong residency status?'), type: 'options',
      opts: [['perm', t('香港永久性居民', 'Hong Kong permanent resident')], ['7y', t('非永久性居民，住港 7 年或以上', 'Non-permanent resident, 7+ years in Hong Kong')],
        ['1y', t('非永久性居民，住港 1 至 7 年', 'Non-permanent resident, 1 to 7 years')], ['new', t('來港少於 1 年', 'Less than 1 year in Hong Kong')], unsure] },
    { key: 'work', q: t('你而家嘅工作狀況係？', 'What is your work status now?'), type: 'options',
      opts: [['full', t('全職', 'Full-time')], ['part', t('兼職', 'Part-time')], ['self', t('自僱', 'Self-employed')],
        ['unemployed', t('失業／待業', 'Unemployed / between jobs')], ['student', t('全日制學生', 'Full-time student')], unsure] },
    { key: 'edu', q: t('你嘅最高學歷係？', 'What is your highest education level?'), type: 'options',
      opts: [['secondary', t('中學或以下', 'Secondary or below')], ['subdegree', t('副學位（副學士、高級文憑）', 'Sub-degree (associate degree, higher diploma)')],
        ['degree', t('學士或以上', "Bachelor's degree or above")], unsure] },
    { key: 'home', q: t('你而家住喺邊度？', 'Where do you live now?'), type: 'options',
      opts: [['family', t('同家人住（私樓）', 'With family (private housing)')], ['rent', t('租樓（包括劏房）', 'Renting (including subdivided units)')],
        ['prh', t('公屋', 'Public rental housing')], ['own', t('自己或家人擁有嘅物業（包括居屋）', 'Property owned by me or my family (including HOS)')],
        ['other', t('其他（例如宿舍）', 'Other (e.g. a hostel)')], unsure] },
    { key: 'prhApp', when: a => !['prh', 'own'].includes(a.home), q: t('你有冇申請緊公屋？', 'Are you on the public housing waiting list?'), type: 'options',
      opts: [['none', t('冇', 'No')], ['lt3', t('有，輪候少於 3 年', 'Yes, waiting less than 3 years')], ['ge3', t('有，輪候 3 年或以上', 'Yes, waiting 3 years or more')], unsure] },
    { key: 'size', q: t('你嘅住戶有幾多人（包括你）？', 'How many people are in your household (including you)?'),
      help: t('即係同你住埋一齊、一齊使錢嘅人。', 'People who live with you and share living costs.'), type: 'options',
      opts: [['1', t('1 人（只有我）', '1 (just me)')], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', t('6 人或以上', '6 or more')]] },
    { key: 'income', q: t('全個住戶每月總入息大約幾多？', "Roughly what is your household's total monthly income?"),
      help: t('所有同住成員嘅工資、花紅等，扣強積金之前。大約數就得。', 'Wages, bonuses and so on for everyone in the household, before MPF. A rough figure is fine.'),
      type: 'money', min: 0, max: 1e7, optional: true, skipLabel: t('不確定', 'Not sure') },
    { key: 'assets', q: t('全個住戶嘅資產大約幾多？', "Roughly what are your household's total assets?"),
      help: t('現金、銀行存款、股票、基金等，唔計自住物業。', 'Cash, bank deposits, stocks, funds and so on, not counting the home you live in.'),
      type: 'money', min: 0, max: 1e9, optional: true, skipLabel: t('不確定', 'Not sure') },
    { key: 'hours', q: t('全個住戶每月合共做幾多個鐘工作？', 'How many hours a month does your household work in total?'),
      help: t('全職一般每月約 176 至 200 小時。', 'Full-time work is usually about 176 to 200 hours a month.'), type: 'options',
      opts: [['zero', t('冇人工作', 'No one works')], ['lt144', t('少於 144 小時', 'Under 144 hours')], ['144', t('144 至 167 小時', '144 to 167 hours')],
        ['168', t('168 至 191 小時', '168 to 191 hours')], ['192', t('192 小時或以上', '192 hours or more')], unsure] },
    { key: 'transport', q: t('你每月搭公共交通大約使幾多？', 'Roughly how much do you spend on public transport each month?'), type: 'options',
      opts: [['lt500', t('少於 $500', 'Under $500')], ['500', '$500 – $999'], ['1000', '$1,000 – $1,799'], ['1800', t('$1,800 或以上', '$1,800 or more')], unsure] },
    { key: 'family', q: t('以下有冇適用於你？（可以揀多項）', 'Do any of these apply to you? (Pick all that apply)'), type: 'multi', none: 'none',
      opts: [['baby', t('有未滿 1 歲嘅子女，或者準備生育', 'A child under 1, or planning a baby')], ['kinder', t('有讀幼稚園或幼兒中心嘅子女', 'A child at kindergarten or a child care centre')], ['school', t('有讀小學或中學嘅子女', 'Children in primary or secondary school')],
        ['p60', t('有 60 至 64 歲嘅父母', 'A parent aged 60 to 64')], ['p65', t('有 65 至 69 歲嘅父母', 'A parent aged 65 to 69')], ['p70', t('有 70 歲或以上嘅父母', 'A parent aged 70 or above')],
        ['carer', t('我每月照顧輪候長期護理服務嘅長者，或殘疾家人，最少 80 小時', 'I care for an elderly person waiting for long-term care, or a family member with a disability, 80+ hours a month')],
        ['none', t('以上都冇', 'None of these')]] },
  ];

  // ---------------- 判斷 ----------------
  const yes = (zh, en) => ({ ok: true, text: t(zh, en) });
  const no = (zh, en) => ({ ok: false, text: t(zh, en) });
  const unk = (zh, en) => ({ ok: null, text: t(zh, en) });
  const check = (v, okText, noText, unkText) => (v === true ? yes(...okText) : v === false ? no(...noText) : unk(...unkText));
  const known = v => v != null && v !== 'unsure';

  function rules(a) {
    const size = Number(a.size || 1), idx = Math.min(size, 10) - 1, inc = a.income, ast = a.assets;
    const fam = a.family || [];
    const age = { '18-24': [18, 24], '25-29': [25, 29], '30-35': [30, 35], '36-40': [36, 40], '41+': [41, 99] }[a.age] || [18, 99];
    const ageIn = (lo, hi) => (age[0] >= lo && age[1] <= hi ? true : age[1] < lo || age[0] > hi ? false : null);
    const le = (v, lim) => (v == null ? null : v <= lim);
    const working = ['full', 'part', 'self'].includes(a.work) ? true : ['unemployed', 'student'].includes(a.work) ? false : null;
    const resident = ['perm', '7y', '1y'].includes(a.res) ? true : a.res === 'new' ? null : null;
    const perm = a.res === 'perm' ? true : known(a.res) ? false : null;
    const ownsHome = a.home === 'own' ? true : known(a.home) ? false : null;
    const inPRH = a.home === 'prh' ? true : known(a.home) ? false : null;
    const eduLE = a.edu === 'secondary' || a.edu === 'subdegree' ? true : a.edu === 'degree' ? false : null;
    const eduGE = a.edu === 'subdegree' || a.edu === 'degree' ? true : a.edu === 'secondary' ? false : null;
    const R = {};
    const fmt = n => money(n);

    R.cef = { reasons: [yes('年滿 18 歲', 'Aged 18 or above'),
      check(resident, ['香港居民', 'Hong Kong resident'], ['要係香港居民', 'Must be a Hong Kong resident'], ['要有香港居留權、入境權或無逗留條件限制', 'Needs right of abode, right to land or unconditional stay'])] };

    R.erb = a.work === 'unemployed'
      ? { reasons: [yes('失業人士可以讀免費「就業掛鈎課程」，仲有再培訓津貼', 'Unemployed people can take free placement-tied courses with a retraining allowance'),
          check(perm, ['香港永久性居民', 'Permanent resident'], ['就業掛鈎課程主要為永久性居民而設', 'Placement-tied courses are mainly for permanent residents'], ['就業掛鈎課程主要為永久性居民而設', 'Placement-tied courses are mainly for permanent residents'])] }
      : a.work === 'student'
        ? { reasons: [no('課程為在職或待業人士而設，唔係全日制學生', 'Courses are for working or job-seeking people, not full-time students')] }
        : { reasons: [yes('15 歲或以上嘅合資格僱員都可以報讀', 'Eligible employees aged 15+ can enrol'),
            unk('學費減免視乎你個人月入（$15,000 或以下可豁免）', 'Fee waiver depends on your own monthly income ($15,000 or below)')] };

    R.yes = { reasons: [check(ageIn(15, 29), ['15 至 29 歲', 'Aged 15 to 29'], ['要 29 歲或以下', 'Must be 29 or under'], ['要 29 歲或以下', 'Must be 29 or under']),
      check(eduLE, ['學歷副學位或以下', 'Sub-degree or below'], ['學歷要副學位或以下', 'Education must be sub-degree or below'], ['學歷要副學位或以下', 'Education must be sub-degree or below'])] };

    R.gbayes = { reasons: [check(ageIn(18, 29), ['18 至 29 歲', 'Aged 18 to 29'], ['要 29 歲或以下', 'Must be 29 or under'], ['要 29 歲或以下', 'Must be 29 or under']),
      check(eduGE, ['持副學位或以上學歷', 'Sub-degree or above'], ['要持副學位或以上學歷', 'Needs sub-degree education or above'], ['要持副學位或以上學歷', 'Needs sub-degree education or above'])] };

    R.loan = { cap: 'maybe', reasons: [check(eduGE, ['讀過專上課程，可能有學資處貸款', 'Post-secondary education, so you may have a student loan'], ['冇讀專上課程，一般冇學資處貸款', 'No post-secondary study, so usually no student loan'], ['如果你有學資處貸款', 'If you have a student loan']),
      check(['unemployed', 'student'].includes(a.work) ? true : known(a.work) ? false : null,
        ['因為進修或失業，還款可能有困難', 'Studying or unemployed, so repayment may be hard'],
        ['主要為因進修、失業、經濟困難或患重病而還款有困難嘅人', 'Mainly for people struggling to repay due to study, unemployment, hardship or serious illness'],
        ['要因進修、經濟困難或患重病而還款有困難', 'You must have trouble repaying due to study, hardship or serious illness'])] };

    R.prh = { reasons: [check(ownsHome === null ? null : !ownsHome, ['冇住宅物業', 'No residential property'], ['擁有住宅物業唔可以申請', "Owning residential property isn't allowed"], ['唔可以擁有住宅物業', "You mustn't own residential property"]),
      check(inPRH === null ? null : !inPRH, ['未住公屋', 'Not living in public housing'], ['你已經住緊公屋', 'You already live in public housing'], ['未住公屋先申請', 'For people not yet in public housing']),
      check(le(inc, T.prh.income[idx]), [`住戶月入低於 ${fmt(T.prh.income[idx])}（${size} 人上限）`, `Household income under ${fmt(T.prh.income[idx])} (limit for ${size})`],
        [`住戶月入高於 ${fmt(T.prh.income[idx])}（${size} 人上限）`, `Household income above ${fmt(T.prh.income[idx])} (limit for ${size})`], [`住戶月入要低於 ${fmt(T.prh.income[idx])}`, `Household income must be under ${fmt(T.prh.income[idx])}`]),
      check(le(ast, T.prh.assets[idx]), [`資產低於 ${fmt(T.prh.assets[idx])}`, `Assets under ${fmt(T.prh.assets[idx])}`], [`資產高於 ${fmt(T.prh.assets[idx])}`, `Assets above ${fmt(T.prh.assets[idx])}`], [`資產要低於 ${fmt(T.prh.assets[idx])}`, `Assets must be under ${fmt(T.prh.assets[idx])}`])] };

    R.lph = { reasons: [check(a.prhApp === 'ge3' ? true : ['none', 'lt3'].includes(a.prhApp) || inPRH || ownsHome ? false : null,
        ['已輪候公屋 3 年或以上', 'Waiting for public housing 3+ years'], ['要輪候傳統公屋 3 年或以上', 'Must have waited 3+ years for public housing'], ['要輪候傳統公屋 3 年或以上', 'Must have waited 3+ years for public housing']),
      check(size >= 2, ['二人或以上家庭', 'Household of 2 or more'], ['非長者一人申請唔合資格', "Non-elderly one-person applicants aren't eligible"], [''])] };

    const hosInc = size === 1 ? T.hosWhite.income1 : T.hosWhite.income2, hosAst = size === 1 ? T.hosWhite.assets1 : T.hosWhite.assets2;
    const whiteForm = () => [check(ownsHome === null ? null : !ownsHome, ['冇住宅物業', 'No residential property'], ['擁有住宅物業唔可以申請', "Owning residential property isn't allowed"], ['唔可以擁有住宅物業', "You mustn't own residential property"]),
      check(le(inc, hosInc), [`住戶月入低於 ${fmt(hosInc)}`, `Household income under ${fmt(hosInc)}`], [`住戶月入高於 ${fmt(hosInc)}`, `Household income above ${fmt(hosInc)}`], [`住戶月入要低於 ${fmt(hosInc)}`, `Household income must be under ${fmt(hosInc)}`]),
      check(le(ast, hosAst), [`資產低於 ${fmt(hosAst)}`, `Assets under ${fmt(hosAst)}`], [`資產高於 ${fmt(hosAst)}`, `Assets above ${fmt(hosAst)}`], [`資產要低於 ${fmt(hosAst)}`, `Assets must be under ${fmt(hosAst)}`])];
    R.hos = { reasons: whiteForm() };

    // 白居二：限額同居屋白表；住緊公屋嘅人一般用綠表買二手居屋
    R.wsm = { extra: ageIn(18, 39) !== false && !inPRH && !ownsHome ?t('40 歲以下可以揀參加「青年計劃（白居二）」', 'Under 40? You can join the Youth Scheme (WSM)') : '',
      reasons: [...whiteForm(), check(inPRH === null ? null : !inPRH, ['唔係公屋住戶，用白表', 'Not a public housing tenant, so White Form applies'], ['公屋住戶一般用綠表買二手居屋', 'Public housing tenants usually buy on the secondary market with the Green Form'], ['公屋住戶一般用綠表', 'Public housing tenants usually use the Green Form'])] };

    // 家有初生／天倫樂：要有初生嬰兒或 60 歲以上父母，而且申請緊或準備申請公屋／居屋
    const hasBaby = fam.includes('baby'), hasElder = fam.includes('p60') || fam.includes('p65') || fam.includes('p70');
    R.familyPriority = { reasons: [
      check(hasBaby || hasElder, [hasBaby ? '有初生嬰兒或準備生育' : '有 60 歲或以上父母', hasBaby ? 'A newborn or a baby planned' : 'A parent aged 60+'], ['要有初生嬰兒，或者同 60 歲或以上父母一齊申請', 'You need a newborn, or to apply with a parent aged 60+'], ['']),
      check(ownsHome === null ? null : !ownsHome, ['冇住宅物業，可以申請公屋或居屋', 'No residential property, so you can apply for public housing or HOS'], ['擁有住宅物業唔可以申請公屋或居屋', "Owning residential property rules out public housing and HOS"], ['唔可以擁有住宅物業', "You mustn't own residential property"]),
      ...(!hasBaby && hasElder ? [unk('「天倫樂」要同長者一齊申請，並同住或入住就近單位照顧佢', 'You must apply with the elderly parent and live with, or near, and care for them')] : [])] };

    R.greenform = { reasons: [check(inPRH, ['住緊公屋，可以用綠表', 'In public housing, so you can use the Green Form'], ['綠表主要為公屋住戶而設', 'The Green Form is mainly for public housing tenants'], ['要係公屋住戶', 'Must be a public housing tenant'])] };

    const YH = T.youthHostel;
    R.youthHostel = { reasons: [check(ageIn(YH.ageMin, YH.ageMax), [`${YH.ageMin} 至 ${YH.ageMax} 歲`, `Aged ${YH.ageMin} to ${YH.ageMax}`], [`要 ${YH.ageMin} 至 ${YH.ageMax} 歲`, `Must be aged ${YH.ageMin} to ${YH.ageMax}`], [`要 ${YH.ageMin} 至 ${YH.ageMax} 歲`, `Must be aged ${YH.ageMin} to ${YH.ageMax}`]),
      check(perm, ['香港永久性居民', 'Permanent resident'], ['要係香港永久性居民', 'Must be a permanent resident'], ['要係香港永久性居民', 'Must be a permanent resident']),
      check(working, ['有工作', 'Working'], ['要有工作，全日制學生唔合資格', "Must be working; full-time students aren't eligible"], ['要有工作', 'Must be working']),
      check(ownsHome === null ? null : !ownsHome, ['冇住宅物業', 'No residential property'], ['唔可以擁有住宅物業', "You mustn't own residential property"], ['唔可以擁有住宅物業', "You mustn't own residential property"]),
      check(size === 1 ? le(inc, YH.income1) : null, [`月入低於 ${fmt(YH.income1)}`, `Income under ${fmt(YH.income1)}`], [`月入高於 ${fmt(YH.income1)}`, `Income above ${fmt(YH.income1)}`], [`你自己月入要低於約 ${fmt(YH.income1)}`, `Your own income must be under about ${fmt(YH.income1)}`])] };

    const W = T.wfa, wi = Math.min(size, 6) - 1, hrs = { zero: false, lt144: false, '144': true, '168': true, '192': true }[a.hours];
    let wfaAmt = '';
    if (hrs && inc != null && inc <= W.half[wi]) {
      const band = inc <= W.full[wi] ? 0 : inc <= W.threeQuarter[wi] ? 1 : 2;
      const tier = { '144': W.basic, '168': W.medium, '192': W.high }[a.hours][band];
      wfaAmt = t(`估計每月 ${fmt(tier)}（${['全額', '3/4 額', '半額'][band]}）`, `Estimated ${fmt(tier)} a month (${['full', '3/4', 'half'][band]} rate)`)
        + (fam.includes('school') || fam.includes('baby') ? t(`，每名 15 歲以下子女另加 ${fmt(W.child[band])}`, `, plus ${fmt(W.child[band])} per child under 15`) : '');
    }
    R.wfa = { extra: wfaAmt, reasons: [check(hrs ?? null, ['住戶每月工時 144 小時或以上', 'Household works 144+ hours a month'], ['住戶每月工時要 144 小時或以上（單親 36 小時）', 'Household must work 144+ hours a month (36 for single parents)'], ['住戶每月工時要 144 小時或以上', 'Household must work 144+ hours a month']),
      check(le(inc, W.half[wi]), [`住戶月入低於 ${fmt(W.half[wi])}`, `Household income under ${fmt(W.half[wi])}`], [`住戶月入高於 ${fmt(W.half[wi])}（${size} 人上限）`, `Household income above ${fmt(W.half[wi])} (limit for ${size})`], [`住戶月入要低於 ${fmt(W.half[wi])}`, `Household income must be under ${fmt(W.half[wi])}`]),
      check(le(ast, W.assets[idx]), [`資產低於 ${fmt(W.assets[idx])}`, `Assets under ${fmt(W.assets[idx])}`], [`資產高於 ${fmt(W.assets[idx])}`, `Assets above ${fmt(W.assets[idx])}`], [`資產要低於 ${fmt(W.assets[idx])}`, `Assets must be under ${fmt(W.assets[idx])}`])] };

    const P = T.ptfss, band = { lt500: [0, 499], '500': [500, 999], '1000': [1000, 1799], '1800': [1800, null] }[a.transport];
    const subOf = x => Math.min(P.cap, Math.max(0, Math.floor((x - P.threshold) * P.rate + 1e-9)));
    const lo = band ? subOf(band[0]) : 0, hi = band ? (band[1] == null ? P.cap : subOf(band[1])) : 0;
    R.ptfss = { extra: !band || hi <= 0 ? '' : lo === hi ? t(`估計每月 ${fmt(hi)}${hi === P.cap ? '（上限）' : ''}`, `Estimated ${fmt(hi)} a month${hi === P.cap ? ' (the cap)' : ''}`)
        : t(`估計每月 ${fmt(lo)} 至 ${fmt(hi)}`, `Estimated ${fmt(lo)} to ${fmt(hi)} a month`),
      reasons: [check(band == null ? null : band[0] >= P.threshold, [`每月交通開支超過 ${fmt(P.threshold)}`, `Monthly spending over ${fmt(P.threshold)}`], [`每月交通開支要超過 ${fmt(P.threshold)}`, `Monthly spending must be over ${fmt(P.threshold)}`], [`每月交通開支要超過 ${fmt(P.threshold)}`, `Monthly spending must be over ${fmt(P.threshold)}`])] };

    const C = T.cssa, cLim = size === 1 ? C.singleAbleBodied : C.familyAbleBodied[Math.min(size, 4) - 1];
    const needy = a.work === 'unemployed' ? true : inc != null ? inc / size <= C.perPersonIncomeHint : null;
    R.cssa = { cap: 'maybe', reasons: [check(le(ast, cLim), [`資產低於 ${fmt(cLim)}`, `Assets under ${fmt(cLim)}`], [`資產高於 ${fmt(cLim)}（健全成人上限）`, `Assets above ${fmt(cLim)} (able-bodied limit)`], [`資產要低於 ${fmt(cLim)}`, `Assets must be under ${fmt(cLim)}`]),
      check(needy, ['入息可能不足以應付基本生活', 'Income may not cover basic needs'], ['以你嘅住戶入息，一般高過綜援認可需要', 'Your household income is usually above CSSA recognised needs'], ['要入息不足以應付基本生活', "Income must fall short of basic needs"])] };

    const H = T.haWaiver, hi5 = Math.min(size, 5) - 1, hLim = H.income[hi5], hAst = T.prh.assets[idx];
    R.haWaiver = { extra: inc != null && inc <= H.fullIncome[hi5] && le(ast, hAst) !== false ? t('估計一般可獲全數減免', 'Likely a full waiver') : '',
      reasons: [check(le(inc, hLim), [`住戶月入低於 ${fmt(hLim)}（${size} 人上限）`, `Household income under ${fmt(hLim)} (limit for ${size})`],
        [`住戶月入高於 ${fmt(hLim)}（${size} 人上限）`, `Household income above ${fmt(hLim)} (limit for ${size})`], [`住戶月入要低於 ${fmt(hLim)}`, `Household income must be under ${fmt(hLim)}`]),
      check(le(ast, hAst), [`資產低於 ${fmt(hAst)}`, `Assets under ${fmt(hAst)}`], [`資產高於 ${fmt(hAst)}（家有 65 歲以上長者可以提高）`, `Assets above ${fmt(hAst)} (higher if an elderly person lives with you)`], [`資產要低於 ${fmt(hAst)}`, `Assets must be under ${fmt(hAst)}`]),
      unk('只喺你需要睇公立醫院或診所時先申請；未婚成年人一般當一人家庭計', 'Apply only when you use public hospitals or clinics; unmarried adults are usually assessed as a one-person household')] };

    const ci = T.carer.income[Math.min(size, 6) - 1];
    R.carer = { reasons: [check(fam.includes('carer'), ['你每月照顧家人 80 小時或以上', 'You provide 80+ hours of care a month'], ['要每月照顧合資格家人最少 80 小時', 'You must provide 80+ hours of care a month to an eligible person'], ['']),
      check(le(inc, ci), [`住戶月入低於 ${fmt(ci)}`, `Household income under ${fmt(ci)}`], [`住戶月入高於 ${fmt(ci)}`, `Household income above ${fmt(ci)}`], [`住戶月入要低於 ${fmt(ci)}`, `Household income must be under ${fmt(ci)}`])] };

    R.newborn = { reasons: [check(fam.includes('baby'), ['有未滿 1 歲子女或準備生育', 'A baby under 1 or planned'], ['為喺香港出生嘅新生嬰兒而設', 'For babies born in Hong Kong'], ['']),
      check(perm, ['你係香港永久性居民', 'You are a permanent resident'], ['父母其中一方要係香港永久性居民', 'One parent must be a permanent resident'], ['父母其中一方要係香港永久性居民', 'One parent must be a permanent resident'])] };

    const afi = inc == null ? null : (inc * 12) / (size + 1);
    R.textbook = { extra: afi == null || !fam.includes('school') ? '' : afi <= T.textbook.fullAFI ? t('估計可獲全額', 'Likely full rate') : afi <= T.textbook.halfAFI ? t('估計可獲半額', 'Likely half rate') : '',
      reasons: [check(fam.includes('school'), ['有讀中小學嘅子女', 'Children in primary or secondary school'], ['為有中小學生嘅家庭而設', 'For families with school children'], ['']),
        check(afi == null ? null : afi <= T.textbook.halfAFI, [`調整後家庭收入約 ${fmt(afi || 0)}，喺上限之內`, `Adjusted family income about ${fmt(afi || 0)}, within the limit`], [`調整後家庭收入約 ${fmt(afi || 0)}，高過上限 ${fmt(T.textbook.halfAFI)}`, `Adjusted family income about ${fmt(afi || 0)}, above the ${fmt(T.textbook.halfAFI)} limit`], ['按家庭入息審查', 'Means-tested on family income'])] };

    const K = T.kcfrs;
    R.kcfrs = { extra: afi == null || !fam.includes('kinder') ? '' : afi <= K.fullAFI ? t('估計可獲全額減免', 'Likely full remission') : afi <= K.threeQuarterAFI ? t('估計可獲 3/4 額減免', 'Likely 3/4 remission') : afi <= K.halfAFI ? t('估計可獲半額減免', 'Likely half remission') : '',
      reasons: [check(fam.includes('kinder'), ['有讀幼稚園或幼兒中心嘅子女', 'A child at kindergarten or child care'], ['為有幼稚園或幼兒中心學童嘅家庭而設', 'For families with a child at kindergarten or child care'], ['']),
        check(afi == null ? null : afi <= K.halfAFI, [`調整後家庭收入約 ${fmt(afi || 0)}，喺上限之內`, `Adjusted family income about ${fmt(afi || 0)}, within the limit`], [`調整後家庭收入約 ${fmt(afi || 0)}，高過上限 ${fmt(K.halfAFI)}`, `Adjusted family income about ${fmt(afi || 0)}, above the ${fmt(K.halfAFI)} limit`], ['按家庭入息審查', 'Means-tested on family income'])] };

    // 專上學生資助：全日制學生；要有居留權或住港滿 3 年
    R.postsec = { reasons: [check(a.work === 'student' ? true : known(a.work) ? false : null, ['你係全日制學生', 'You are a full-time student'], ['為全日制專上學生而設', 'For full-time post-secondary students'], ['要係全日制專上學生', 'You must be a full-time post-secondary student']),
      check(['perm', '7y'].includes(a.res) ? true : null, ['有居留權或住港滿 3 年', 'Right of abode or 3+ years in Hong Kong'], [''], ['要有香港居留權，或者本人或家庭已連續住港滿 3 年', 'You need right of abode, or you or your family must have lived here 3 continuous years']),
      unk('助學金要經家庭入息及資產審查；免入息審查貸款就唔使', 'Grants are means-tested; the non-means-tested loan is not')] };

    // 父母
    const p60 = fam.includes('p60') || fam.includes('p65') || fam.includes('p70'), p65 = fam.includes('p65') || fam.includes('p70'), p70 = fam.includes('p70');
    if (p60) {
      R.seniorCard = { reasons: [check(p65, ['父母 65 歲或以上', 'Parent aged 65+'], ['年滿 65 歲先可以申請（生日前 60 日可預先遞交）', 'Available from 65 (apply up to 60 days early)'], [''])] };
      R.colonscreen = { reasons: [check(fam.includes('p60') || fam.includes('p65') ? true : null, ['父母 50 至 75 歲', 'Parent aged 50 to 75'], [''], ['父母要 75 歲或以下', 'Your parent must be 75 or under']),
        unk('要冇大腸癌徵狀或高風險因素，並經醫生評估', 'No symptoms or high-risk factors; a doctor will assess')] };
      R.fare2 = { reasons: [yes('父母 60 歲或以上', 'Parent aged 60+')] };
      R.hcv = { reasons: [check(p65, ['父母 65 歲或以上', 'Parent aged 65+'], ['年滿 65 歲先有醫療券', 'Vouchers start at age 65'], [''])] };
      R.oaa = { reasons: [check(p70, ['父母 70 歲或以上', 'Parent aged 70+'], ['年滿 70 歲先可以申請', 'Available from age 70'], ['']), unk('要住港最少 7 年', 'Needs 7 years of residence')] };
      R.oala = { cap: 'maybe', reasons: [check(p65, ['父母 65 歲或以上', 'Parent aged 65+'], ['年滿 65 歲先可以申請', 'Available from age 65'], ['']),
        unk(`父母入息同資產要低於限額（單身每月 ${fmt(T.oala.incomeSingle)}、資產 ${fmt(T.oala.assetsSingle)}）`, `Parent's income and assets must be under the limits (single: ${fmt(T.oala.incomeSingle)} a month, ${fmt(T.oala.assetsSingle)} assets)`)] };
    }
    for (const r of Object.values(R)) {
      const oks = r.reasons.map(x => x.ok);
      r.status = oks.includes(false) ? 'no' : oks.every(v => v === true) ? 'likely' : 'maybe';
      if (r.cap === 'maybe' && r.status === 'likely') r.status = 'maybe';
      r.reasons = r.reasons.filter(x => x.text);
    }
    return R;
  }

  // ---------------- 結果 ----------------
  const ICON = { true: '✓', false: '✗', null: '?' };
  const LABEL = { likely: t('很可能符合', 'Likely eligible'), maybe: t('可能符合', 'Possibly eligible'), no: t('不符合', 'Not eligible') };
  function card(it, r) {
    const status = r.status === 'likely' || r.status === 'maybe' || r.status === 'no' ? r.status : 'maybe';
    const href = safeUrl(L(it.url));
    return `<article class="card benefit ${status}">
      <div class="benefit-head"><span class="badge status-${status}">${esc(LABEL[r.status] || '')}</span><span class="badge">${esc(L(D.groups[it.group]))}</span></div>
      <h3>${esc(L(it.name))}</h3>
      <p class="mt0">${esc(L(it.summary))}</p>
      <ul class="reasons">${r.reasons.map(x => {
        const ok = x.ok === true ? 'true' : x.ok === false ? 'false' : 'null';
        return `<li class="r-${ok}"><span aria-hidden="true">${ICON[x.ok] || ''}</span>${esc(x.text)}</li>`;
      }).join('')}</ul>
      <details class="benefit-more">
        <summary>${t('睇大約金額同點樣申請', 'See rough amount and how to apply')}</summary>
        <dl class="benefit-facts">
          <div><dt>${t('大約金額', 'Roughly how much')}</dt><dd>${r.extra ? `<b>${esc(r.extra)}</b><br>` : ''}${esc(L(it.amount))}</dd></div>
          <div><dt>${t('點樣申請', 'How to apply')}</dt><dd>${esc(L(it.apply))}</dd></div>
          ${it.notes ? `<div><dt>${t('注意', 'Note')}</dt><dd>${esc(L(it.notes))}</dd></div>` : ''}
        </dl>
        <div class="source">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${t('官方網頁', 'Official page')}</a>` : esc(t('官方網頁', 'Official page'))}
          ${t('｜資料來源：', ' | Source: ')}${esc(L(it.source))}${t('｜核對日期：', ' | Checked: ')}${esc(it.asOf)}</div>
      </details>
    </article>`;
  }

  function result(a, api) {
    hideBottomCta(false);   // 所有適用題目都答完，先顯示頁底預約
    const R = rules(a);
    const list = D.items.filter(it => R[it.id]).map(it => ({ it, r: R[it.id] }));
    const pick = s => list.filter(x => x.r.status === s);
    const L1 = pick('likely'), L2 = pick('maybe'), L3 = pick('no');
    box.innerHTML = `<div class="stack">
      <div>
        <h2 class="mt0">${t('福利檢查結果', 'Your benefits check')}</h2>
        <p>${t(`很可能符合 <b>${L1.length}</b> 項、可能符合 <b>${L2.length}</b> 項、不符合 <b>${L3.length}</b> 項。`, `Likely eligible for <b>${L1.length}</b>, possibly eligible for <b>${L2.length}</b>, not eligible for <b>${L3.length}</b>.`)}</p>
        <p class="callout" style="font-size:14px">${t('結果只係按你嘅答案估算，最終以有關部門審批為準。「可能符合」通常係因為你揀咗「不確定」，或者要由部門評估。', 'Results are estimates from your answers; the departments make the final decision. "Possibly eligible" usually means you answered "not sure", or the department needs to assess you.')}</p>
      </div>
      ${L1.length ? `<h3>${LABEL.likely}（${L1.length}）</h3>${L1.map(x => card(x.it, x.r)).join('')}` : ''}
      ${L2.length ? `<h3>${LABEL.maybe}（${L2.length}）</h3>${L2.map(x => card(x.it, x.r)).join('')}` : ''}
      ${L3.length ? `<details class="card flat"><summary style="cursor:pointer;font-weight:700">${LABEL.no}（${L3.length}）${t('：撳開睇原因', ': tap to see why')}</summary><div class="stack" style="margin-top:12px">${L3.map(x => card(x.it, x.r)).join('')}</div></details>` : ''}
      <div class="q-nav"><button type="button" class="btn secondary" data-edit>${t('← 改答案', '← Change answers')}</button>
        <button type="button" class="btn secondary" data-restart>${t('重新答過', 'Start over')}</button></div>
      <p class="muted" style="font-size:13px">${t(`資料最後核對：${esc(D.reviewedOn)}（每 3 個月更新）。本工具與香港政府並無關連，你嘅答案唔會儲存或上傳。`, `Last checked: ${esc(D.reviewedOn)} (updated every 3 months). This tool is not connected with the Hong Kong Government; your answers are not saved or uploaded.`)}</p>
    </div>`;
    box.querySelector('[data-edit]').addEventListener('click', () => { hideBottomCta(true); api.edit(); });
    box.querySelector('[data-restart]').addEventListener('click', () => { hideBottomCta(true); api.restart(); });
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------------- 開始畫面 ----------------
  box.innerHTML = `<h2 class="mt0">${t('2 分鐘，睇下有冇錯過咗政府福利', 'Two minutes to see which benefits you may be missing')}</h2>
    <p>${t(`答 ${Q.length} 題，做完即刻睇到政府及半官方福利嘅結果，附原因、大約金額同官方連結。任何問題都可以揀「不確定」。`, `Answer ${Q.length} questions and see your government and semi-official benefits straight away, with reasons, rough amounts and official links. You can answer "not sure" to anything.`)}</p>
    <button type="button" class="btn shu lg" data-start>${t('開始福利檢查 →', 'Start the benefits check →')}</button>`;
  box.querySelector('[data-start]').addEventListener('click', () => wizard(box, Q, result));
}
