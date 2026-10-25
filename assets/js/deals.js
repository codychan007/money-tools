// 優惠回贈：讀 data/deals.json，按類別篩選，過期自動收埋。英文頁用 *_en 欄位。
import { mountLayout, loadJSON, esc, todayHK } from './layout.js';
import { EN, t } from './i18n.js';

mountLayout();
const d = await loadJSON('/data/deals.json');
const today = todayHK();
const L = (o, k) => (EN && o[`${k}_en`] != null && o[`${k}_en`] !== '' ? o[`${k}_en`] : o[k]);
const CATS = EN && d.categories_en ? d.categories_en : d.categories;
const live = d.items.filter(i => !i.expiry || i.expiry >= today);   // 過期自動隱藏
const stale = d.reviewBy && today > d.reviewBy;
document.getElementById('status').innerHTML = `
  <p class="muted" style="font-size:13px;margin:0">${t('最後整理：', 'Last updated: ')}${esc(d.updatedOn)}${t('｜下次更新：約 ', ' | Next update: around ')}${esc(d.reviewBy)}</p>
  ${stale ? `<div class="sample-banner" style="margin-top:8px">${t('呢頁資料已超過兩星期未更新，部分優惠可能已經改變，請以官方條款為準。',
    "This page hasn't been updated for over two weeks. Some offers may have changed; the official terms prevail.")}</div>` : ''}`;

let cat = 'all';
const cats = document.getElementById('cats');
cats.innerHTML = [['all', t('全部', 'All')], ...Object.entries(CATS)].map(([k, v]) =>
  `<button class="chip" data-c="${k}" aria-pressed="${k === cat}">${esc(v)}</button>`).join('');
cats.addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; render(); });

const daysLeft = exp => Math.round((Date.parse(exp) - Date.parse(today)) / 86400000);
function render() {
  cats.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.c === cat)));
  const rows = live.filter(i => cat === 'all' || i.categories.includes(cat))
    .sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
  document.getElementById('list').innerHTML = rows.length ? rows.map(i => {
    const left = i.expiry ? daysLeft(i.expiry) : null;
    const expiry = i.expiry
      ? `${t('到期：', 'Ends: ')}${esc(i.expiry)}${left <= 14 ? t(`（尚餘 ${left} 日）`, ` (${left} day${left === 1 ? '' : 's'} left)`) : ''}`
      : t('官方未列明完結日期', 'No end date stated');
    return `
    <article class="card deal">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div><h3>${esc(L(i, 'title'))}</h3>
          <p style="margin:0;font-weight:700">${esc(L(i, 'highlight'))}</p></div>
        <div class="num rate">${esc(L(i, 'rate'))}</div>
      </div>
      <ul style="margin:8px 0 0;padding-left:1.2em;font-size:14px;color:var(--ink-2)">${L(i, 'conditions').map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <div class="meta">
        ${i.categories.map(c => `<span class="badge">${esc(CATS[c] || c)}</span>`).join('')}
        <span class="badge">${esc(L(i, 'type'))}</span>
        <span class="badge ${left !== null && left <= 14 ? 'stale' : 'draft'}">${expiry}</span>
      </div>
      <div class="source">${t('核實日期：', 'Checked: ')}${esc(i.verifiedOn)}${t('｜', ' | ')}<a href="${esc(i.url)}" target="_blank" rel="noopener">${t('睇官方條款 →', 'Official terms →')}</a></div>
    </article>`;
  }).join('') : `<p class="muted center">${t('呢個類別暫時冇合適優惠，下次更新會再搵。', "No suitable offers in this category right now. We'll look again next update.")}</p>`;
}
render();
