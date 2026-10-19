// 市場快訊：先顯示 data/market.json（每日自動更新），
// 再喺訪客瀏覽器直接向金管局／Frankfurter 讀取最新利率及匯率（讀到就覆蓋）。
import { mountLayout, loadJSON, esc, todayHK } from './layout.js';

mountLayout();
const box = document.getElementById('groups');
const d = await loadJSON('/data/market.json');
const byId = Object.fromEntries(d.items.map(i => [i.id, i]));

function ageDays(updatedAt) {
  if (!updatedAt) return Infinity;
  const day = updatedAt.slice(0, 10);
  return (Date.parse(todayHK()) - Date.parse(day)) / 86400000;
}

function render() {
  const groups = [...new Set(d.items.map(i => i.group))];
  box.innerHTML = groups.map(g => `
    <section class="card"><h2>${esc(g)}</h2>
      ${d.items.filter(i => i.group === g).map(i => {
        const stale = i.value != null && ageDays(i.updatedAt) > (i.maxAgeDays || 5);
        const src = i.sourceUrl ? `<a href="${esc(i.sourceUrl)}" target="_blank" rel="noopener">${esc(i.source)}</a>` : esc(i.source);
        return `
        <div class="mkt" style="padding:10px 0;border-bottom:1px solid var(--line)">
          <div><b>${esc(i.name)}</b>
            ${i.live ? '<span class="badge">剛剛讀取</span>' : ''}
            ${stale ? '<span class="badge stale">可能未更新</span>' : ''}
            <div class="source" style="margin:2px 0 0">${i.value != null ? `數據日期：${esc(i.updatedAt)}` : '暫時未能讀取，系統會自動再試'}｜${esc(i.freq || '')}｜${src}</div>
            ${i.note ? `<div class="source" style="margin:2px 0 0">${esc(i.note)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0"><div class="v num">${i.value != null ? esc(i.value) : '—'}</div>
            ${i.change ? `<div class="num ${i.direction === 'up' ? 'up' : i.direction === 'down' ? 'down' : ''}">${esc(i.change)}</div>` : ''}</div>
        </div>`;
      }).join('')}
    </section>`).join('');
  document.getElementById('last-run').textContent = d.lastRun ? `系統最後檢查時間：${d.lastRun}（香港時間）` : '';
}
render();

// ---------- 瀏覽器即時讀取（失敗就保留上面嘅數據）----------
const newer = (a, b) => !b || a > b.slice(0, 10);
async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
function setLive(id, value, date) {
  const it = byId[id];
  if (it && value != null && (it.value == null || newer(date, it.updatedAt))) Object.assign(it, { value, updatedAt: date, live: true, change: '', direction: '' });
}

const jobs = [
  getJSON('https://api.hkma.gov.hk/public/market-data-and-statistics/daily-monetary-statistics/daily-figures-interbank-liquidity?pagesize=1')
    .then(j => { const r = j.result.records[0];
      setLive('base_rate', r.disc_win_base_rate != null ? `${r.disc_win_base_rate.toFixed(2)}%` : null, r.end_of_date);
      setLive('hibor_on', r.hibor_overnight != null ? `${r.hibor_overnight.toFixed(2)}%` : null, r.end_of_date);
      setLive('hibor_1m', r.hibor_fixing_1m != null ? `${r.hibor_fixing_1m.toFixed(4)}%` : null, r.end_of_date); }),
  getJSON('https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/hkd-ir-periodaverage?pagesize=1')
    .then(j => { const r = j.result.records[0];
      setLive('td_3m', r.dr_3m != null ? `${(+r.dr_3m).toFixed(2)}%` : null, r.end_of_month);
      setLive('prime', r.best_lending_rate != null ? `${(+r.best_lending_rate).toFixed(2)}%` : null, r.end_of_month); }),
  getJSON('https://api.frankfurter.dev/v1/latest?base=USD&symbols=HKD')
    .then(j => setLive('usdhkd', j.rates.HKD.toFixed(4), j.date)),
];
await Promise.allSettled(jobs);
render();
