// ============================================================
// 薪俸稅計算（純函數，tests/verify.html 會驗算）
// Y = data/tax/20xx-yy.json；所有金額港元／年
// ============================================================

/** 累進稅：bands = [[50000, .02], …, [null, .17]] */
export function progressiveTax(nci, bands) {
  let left = Math.max(0, nci), tax = 0;
  for (const [width, rate] of bands) {
    const part = width == null ? left : Math.min(left, width);
    tax += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  return tax;
}

/** 標準稅率：standard = [[5000000, .15], [null, .16]]，計喺入息淨額（未扣免稅額）上面 */
export function standardTax(net, standard) {
  return progressiveTax(net, standard);
}

/** 免稅額總數 */
export function allowances(Y, p) {
  const A = Y.allowances;
  let total = p.marital === 'marriedNoIncome' ? A.married : A.basic;
  if (p.marital === 'singleParent' && p.children > 0) total += A.singleParent;
  const kids = Math.max(0, p.children | 0), born = Math.min(kids, Math.max(0, p.newborns | 0));
  total += kids * A.child + born * A.childNewborn;
  total += (p.parent60 | 0) * A.parent60 + (p.parent60Live | 0) * (A.parent60 + A.parent60Live);
  total += (p.parent55 | 0) * A.parent55 + (p.parent55Live | 0) * (A.parent55 + A.parent55Live);
  return total;
}

/** 可扣除項目（每項按上限），回傳 { items: {key: 可扣金額}, total } */
export function deductions(Y, p) {
  const D = Y.deductions, kids = (p.children | 0) > 0;
  const items = {
    mpf: Math.min(p.mpf || 0, D.mpf),
    vhis: Math.min(p.vhis || 0, D.vhisPerInsured * Math.max(1, p.vhisPersons | 0)),
    tvcQdap: Math.min(p.tvcQdap || 0, D.tvcQdap),
    housing: p.housing === 'rent' ? Math.min(p.housingAmt || 0, D.rent + (kids ? D.rentWithChild : 0))
      : p.housing === 'own' ? Math.min(p.housingAmt || 0, D.homeLoan + (kids ? D.homeLoanWithChild : 0)) : 0,
    education: Math.min(p.education || 0, D.education),
    elderly: Math.min(p.elderly || 0, Y.elderlyCare),
  };
  const before = Object.values(items).reduce((a, b) => a + b, 0);
  // 慈善捐款：上限 = (入息 − 其他扣除) × 35%
  items.donation = Math.min(p.donation || 0, Math.max(0, (p.income || 0) - before) * D.donationPct);
  const total = before + items.donation;
  return { items, total };
}

/** 主計算：回傳 { net, allow, nci, prog, std, useStd, gross, reduction, tax, ded } */
export function salariesTax(Y, p) {
  const ded = deductions(Y, p);
  const net = Math.max(0, (p.income || 0) - ded.total);
  const allow = allowances(Y, p);
  const nci = Math.max(0, net - allow);
  const prog = progressiveTax(nci, Y.bands);
  const std = standardTax(net, Y.standard);
  const useStd = std < prog;
  const gross = Math.min(prog, std);
  const reduction = Math.min(gross * (Y.reduction?.pct || 0), Y.reduction?.cap || 0);
  const tax = Math.max(0, gross - reduction);
  return { ded, net, allow, nci, prog, std, useStd, gross, reduction, tax };
}

/** 「用盡三寶」：自願醫保補到每位上限、TVC＋QDAP 補到上限，再計一次 */
export function maxOutThree(Y, p) {
  const D = Y.deductions;
  const persons = Math.max(1, p.vhisPersons | 0);
  const q = { ...p, vhisPersons: persons, vhis: Math.max(p.vhis || 0, D.vhisPerInsured * persons), tvcQdap: Math.max(p.tvcQdap || 0, D.tvcQdap) };
  const before = salariesTax(Y, p), after = salariesTax(Y, q);
  return {
    before, after, saving: Math.max(0, before.tax - after.tax),
    extraVhis: Math.max(0, q.vhis - (p.vhis || 0)), extraTvc: Math.max(0, q.tvcQdap - (p.tvcQdap || 0)),
  };
}

/**
 * 「啱啱好」：最少要多扣幾多（自願醫保＋TVC／QDAP），稅款先跌到最低（通常係 $0）。
 * 自願醫保：每位受保人上限（冇填受保人就當自己 1 位）；TVC＋QDAP：共用一個上限。
 * 兩樣都係扣除，效果一樣，所以只計「合共要多扣幾多」，再睇點樣分配。
 */
export function justEnough(Y, p) {
  const D = Y.deductions;
  const persons = Math.max(1, p.vhisPersons | 0);
  const curV = Math.min(p.vhis || 0, D.vhisPerInsured * persons);
  const curT = Math.min(p.tvcQdap || 0, D.tvcQdap);
  const roomV = D.vhisPerInsured * persons - curV, roomT = D.tvcQdap - curT;
  const withExtra = x => {
    const v = Math.min(x, roomV);
    return salariesTax(Y, { ...p, vhisPersons: persons, vhis: curV + v, tvcQdap: curT + (x - v) });
  };
  const before = salariesTax(Y, p);
  const floor = withExtra(roomV + roomT).tax;          // 用盡兩個上限後嘅最低稅款
  let lo = 0, hi = roomV + roomT;
  if (floor > 0.005) lo = hi;                           // 用盡都去唔到零：每多扣一蚊都再慳，所以要用盡
  else if (before.tax > 0.005) {
    while (lo < hi) {                                   // 搵最細嘅額外扣除（以 $1 計），稅款啱啱好歸零
      const mid = Math.floor((lo + hi) / 2);
      if (withExtra(mid).tax <= 0.005) hi = mid; else lo = mid + 1;
    }
  }
  return { before, floor, need: lo, after: withExtra(lo), saving: Math.max(0, before.tax - floor), roomV, roomT, persons, curV, curT };
}

/** 強積金強制性供款（僱員部分，全年）：月入低過下限唔使供，高過上限按上限計 */
export function mpfEmployeeAnnual(annualIncome, mpf) {
  const m = annualIncome / 12;
  if (m < mpf.minIncome) return 0;
  return Math.round(Math.min(m, mpf.maxIncome) * mpf.rate * 12);
}
