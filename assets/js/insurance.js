import { mountLayout, money, readNum, moneyInput, loadJSON, sourceLine, esc, isStale } from './layout.js';

mountLayout();
const $ = id => document.getElementById(id);

const verifyBadge = () => '';   // data 入面嘅 verified 只作內部提醒，唔喺網站顯示
const extra = list => (list || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join('、');

function statCards(items) {
  return `<div class="grid cols-2">${items.map(it => `
    <div class="stat">
      <span>${esc(it.label)}</span>
      <b class="num" style="font-size:1.5rem">${esc(it.value)}</b>
      ${it.sub ? `<span>${esc(it.sub)}</span>` : ''}
      ${it.source ? sourceLine(it) : ''}${verifyBadge(it.verified)}
    </div>`).join('')}</div>`;
}

const D = await loadJSON('/data/insurance.json');

// 醫療通脹
const mi = D.medicalInflation;
$('inflation').innerHTML = `<h2>📈 ${esc(mi.title)}</h2>${statCards(mi.items)}<p class="muted" style="font-size:13px;margin:12px 0 0">${esc(mi.note)}</p>`;

// 計算機
moneyInput($('cost'));
$('infl').value = mi.defaultRate;
function calc() {
  const c = readNum($('cost')), r = parseFloat($('infl').value) / 100 || 0, n = Math.max(0, Math.min(50, parseInt($('yrs').value) || 0));
  const fv = c * Math.pow(1 + r, n);
  $('infl-result').innerHTML = `如果每年升 ${(r * 100).toFixed(1)}%，今日 ${money(c)} 嘅醫療開支，${n} 年後大約要 <span class="hl">${money(fv)}</span>（約 ${(fv / (c || 1)).toFixed(1)} 倍）。`;
}
['cost', 'infl', 'yrs'].forEach(id => $(id).addEventListener('input', calc));
calc();

// 公立醫院收費
const pf = D.publicFees;
$('public-fees').innerHTML = `<h2>🏥 ${esc(pf.title)}${verifyBadge(pf.verified)}</h2><p>${esc(pf.intro)}</p>
  <div class="table-scroll"><table class="data wrap-cells">
    <tr><th>項目</th><th>收費</th><th>備註</th></tr>
    ${pf.rows.map(r => `<tr><td>${esc(r[0])}</td><td class="num"><b>${esc(r[1])}</b></td><td style="text-align:left;font-size:13px">${esc(r[2])}</td></tr>`).join('')}
  </table></div>${sourceLine(pf)}${pf.extraSources ? `<div class="source">另見：${extra(pf.extraSources)}</div>` : ''}`;

// 私家醫院
const pc = D.privateCosts;
const filled = pc.table.filter(r => r.p50 && !/【/.test(r.procedure));
$('private-costs').innerHTML = `<h2>🏨 ${esc(pc.title)}</h2><p>${esc(pc.intro)}</p>${statCards(pc.highlights)}
  ${filled.length ? `<div class="table-scroll" style="margin-top:12px"><table class="data">
    <tr><th>手術</th><th>醫院</th><th>P50</th><th>P90</th><th>資料期</th></tr>
    ${filled.map(r => `<tr><td>${r.sourceUrl ? `<a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">${esc(r.procedure)}</a>` : esc(r.procedure)}</td><td>${esc(r.hospital)}</td><td>${esc(r.p50)}</td><td>${esc(r.p90)}</td><td>${esc(r.period)}</td></tr>`).join('')}
  </table></div>` : ''}
  <p class="muted" style="font-size:13px;margin:12px 0 0">小貼士：入院前可以要求醫院提供書面費用預算，亦可以喺醫院網站搵「過往收費統計」比較。</p>`;

// 癌症
const ca = D.cancer;
$('cancer').innerHTML = `<h2>🎗️ ${esc(ca.title)}${verifyBadge(ca.verified)}</h2>${statCards(ca.items)}${sourceLine(ca)}${ca.extraSources ? `<div class="source">另見：${extra(ca.extraSources)}</div>` : ''}`;

// 政策
const po = D.policy;
$('policy').innerHTML = `<h2>🏛️ ${esc(po.title)}</h2>${po.items.map(it => `
  <div style="border-left:3px solid var(--green-100);padding-left:12px;margin:14px 0">
    <span class="badge">${esc(it.date)}</span>
    <h3 style="margin:6px 0">${esc(it.title)}</h3>
    <ul style="margin:0;padding-left:1.2em">${it.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <div class="source">來源：<a href="${esc(it.sourceUrl)}" target="_blank" rel="noopener">${esc(it.source)}</a></div>
  </div>`).join('')}
  <div class="source">本部分最後整理：${esc(po.asOf)}${isStale(po.reviewBy) ? ' <span class="badge stale">資料或已過時</span>' : ''}</div>`;

// 基本概念
const b = D.basics;
$('basics').innerHTML = `<h2>📚 ${esc(b.title)}</h2>
  <div class="grid cols-2">${b.items.map(i => `<div class="stat"><b>${i.icon} ${esc(i.name)}</b><span>解決：${esc(i.solves)}<br>${esc(i.note)}</span></div>`).join('')}</div>
  <ul style="margin:14px 0 0;padding-left:1.2em">${b.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
  ${sourceLine(b)}`;
