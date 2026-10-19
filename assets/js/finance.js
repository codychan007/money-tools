// ============================================================
// 純計算函數（唔掂畫面），方便驗算同測試。
// 所有計算只喺瀏覽器內進行，不會上傳。
// ============================================================

/** 年回報率 → 等效月回報率：(1+r)^(1/12) − 1 */
export function monthlyRate(annualRate) {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** n 個月後嘅終值（每月尾供款） */
export function futureValue(savings, monthly, annualRate, months) {
  const i = monthlyRate(annualRate);
  if (months <= 0) return savings;
  if (i === 0) return savings + monthly * months;
  const g = Math.pow(1 + i, months);
  return savings * g + monthly * (g - 1) / i;
}

/**
 * 需要幾多個月先達標（向上取整）。
 * 達唔到（例如每月 0 兼冇回報）就回傳 Infinity。
 */
export function monthsToGoal(target, savings, monthly, annualRate) {
  if (savings >= target) return 0;
  const i = monthlyRate(annualRate);
  if (i === 0) return monthly > 0 ? Math.ceil((target - savings) / monthly) : Infinity;
  if (monthly <= 0 && savings <= 0) return Infinity;
  const n = Math.log((target * i + monthly) / (savings * i + monthly)) / Math.log(1 + i);
  // 浮點誤差保護：先四捨五入到 1e-9 再取整
  return Math.ceil(Math.round(n * 1e9) / 1e9);
}

/** 反向：指定月數內達標，每月要供幾多（已有儲蓄夠就回傳 0） */
export function monthlyNeeded(target, savings, annualRate, months) {
  if (months <= 0) return Infinity;
  const i = monthlyRate(annualRate);
  if (i === 0) return Math.max(0, (target - savings) / months);
  const g = Math.pow(1 + i, months);
  const p = (target - savings * g) * i / (g - 1);
  return Math.max(0, p);
}

/**
 * 「遲 5 年先開始」比較（目標年期固定）：
 * 今日開始有 months 個月；遲 delayMonths 先開始就只剩 months − delayMonths 個月。
 * 假設遲開始期間，現有儲蓄冇投資（0% 回報）。
 */
export function delayComparison(target, savings, annualRate, months, delayMonths = 60) {
  const now = monthlyNeeded(target, savings, annualRate, months);
  const left = months - delayMonths;
  const late = left > 0 ? monthlyNeeded(target, savings, annualRate, left) : Infinity;
  return { now, late, extra: late - now, monthsLeft: left };
}

/** 同一筆每月供款：今日開始 vs 遲 delayMonths 開始，到第 months 個月相差幾多 */
export function delayGapAt(savings, monthly, annualRate, months, delayMonths = 60) {
  const a = futureValue(savings, monthly, annualRate, months);
  const b = months > delayMonths ? futureValue(savings, monthly, annualRate, months - delayMonths) : savings;
  return { onTime: a, late: b, gap: a - b };
}

// ------------------------------------------------------------
// 強積金及月薪
// ------------------------------------------------------------
/** 僱員強制性供款（月薪僱員） */
export function mpfEmployee(salary, mpf) {
  if (salary < mpf.minRelevantIncome) return 0;
  return Math.min(salary, mpf.maxRelevantIncome) * mpf.employeeRate;
}
/** 僱主強制性供款（低於最低入息，僱主仍要供） */
export function mpfEmployer(salary, mpf) {
  return Math.min(salary, mpf.maxRelevantIncome) * mpf.employerRate;
}
export function takeHome(salary, mpf) {
  return salary - mpfEmployee(salary, mpf);
}
/** 按比例分配（比例總和應為 100） */
export function allocate(amount, needsPct, wantsPct, savePct) {
  return {
    needs: amount * needsPct / 100,
    wants: amount * wantsPct / 100,
    save: amount * savePct / 100,
  };
}

// ------------------------------------------------------------
// 理財健康檢查評分（經驗準則，非官方標準）
// ------------------------------------------------------------
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/**
 * a: { income, expenses, cash, debt, revolving: 'no'|'sometimes'|'yes',
 *      saving, medical: 0|1|2, lifeCI: 0|1|2, invest: 0|1|2, budget: 0|1|2 }
 */
export function healthScores(a) {
  const income = Math.max(0, a.income || 0);
  const outflow = Math.max(1, (a.expenses || 0) + (a.debt || 0));

  // 1. 現金流：儲蓄率 20% 或以上 = 滿分
  const saveRate = income > 0 ? (a.saving || 0) / income : 0;
  const cashflow = clamp(saveRate / 0.2 * 100);

  // 2. 緊急備用金：6 個月（支出＋還款）= 滿分
  const efMonths = (a.cash || 0) / outflow;
  const emergency = clamp(efMonths / 6 * 100);

  // 3. 負債：還款佔收入 ≤10% 滿分，50% 或以上 0 分；循環卡數再扣分
  const dti = income > 0 ? (a.debt || 0) / income : (a.debt > 0 ? 1 : 0);
  let debt = clamp(100 - Math.max(0, dti - 0.1) / 0.4 * 100);
  if (a.revolving === 'yes') debt -= 40;
  else if (a.revolving === 'sometimes') debt -= 20;
  debt = clamp(debt);

  // 4. 基本保障：醫療 50 + 危疾／人壽 50
  const protection = clamp((a.medical || 0) * 25 + (a.lifeCI || 0) * 25);

  // 5. 增值習慣：定期投資／退休儲蓄 50 + 記帳預算 50
  const habits = clamp((a.invest || 0) * 25 + (a.budget || 0) * 25);

  const dims = { cashflow, emergency, debt, protection, habits };
  const total = Math.round((cashflow + emergency + debt + protection + habits) / 5);
  return { dims, total, saveRate, efMonths, dti };
}

export function healthGrade(total) {
  if (total >= 80) return { label: '好健康', tone: 'good' };
  if (total >= 60) return { label: '唔錯，仲有進步空間', tone: 'ok' };
  if (total >= 40) return { label: '有改善空間', tone: 'warn' };
  return { label: '要留神喇', tone: 'bad' };
}
