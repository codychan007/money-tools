// ============================================================
// 一頁一題問答（工具二至四共用）
// 題目類型：
//   { key, q, help, type: 'options', opts: [[值, 標籤], …] }
//   { key, q, help, type: 'money' | 'number', min, max, def: ans => 預設值, optional: true, unit }
//   { key, q, help, type: 'counts', fields: [[key, 標籤, max]] }   // 同一頁幾個加減數
//   { key, q, help, type: 'multi', opts: [[值, 標籤], …], none: '冇揀項目嘅值' }   // 可以揀多項，答案係陣列
//   when: ans => 布林值（唔符合就跳過呢題）；q／help 可以係 ans => 字串
// wizard(box, questions, onDone(ans, api))；api.edit() 返去最後一題、api.restart()
// ============================================================
import { t } from './i18n.js';
import { esc } from './layout.js';

const nf = new Intl.NumberFormat('en-HK', { maximumFractionDigits: 0 });
const parse = s => { const v = parseFloat(String(s).replace(/[^\d.-]/g, '')); return isFinite(v) ? v : null; };

export function wizard(box, Q, onDone, init = {}) {
  const ans = { ...init };
  let hist = [];          // 答過嘅題目 index（返回用）
  let i = 0;

  const visible = k => !Q[k].when || Q[k].when(ans);
  const nextIndex = from => { let k = from; while (k < Q.length && !visible(k)) k++; return k; };
  const total = () => Q.filter((_, k) => visible(k)).length;

  // 金額／數字題：聚焦輸入框，等 layout.js 跟住鍵盤將個欄位留喺可見區。
  // scrollIntoView(block:start) 會將成張卡捲去版面頂，鍵盤一開就蓋住輸入框。
  const showQuestion = () => {
    if (i >= Q.length) { box.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    const field = box.querySelector('#wz-in, input[data-count]');
    // 同一下撳掣入面即刻聚焦：手機／iPad 鍵盤唔會收埋再彈
    if (field) { field.focus({ preventScroll: true }); return; }
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  const go = k => { hist.push(i); i = nextIndex(k); render(); showQuestion(); };
  const back = () => { i = hist.pop() ?? 0; render(); showQuestion(); };

  function render() {
    if (i >= Q.length) return onDone({ ...ans }, api);
    const q = Q[i];
    const qText = typeof q.q === 'function' ? q.q(ans) : q.q, qHelp = typeof q.help === 'function' ? q.help(ans) : q.help;
    const n = hist.length + 1, N = Math.max(n, total());
    let body = '';
    if (q.type === 'options') {
      body = `<div class="options">${q.opts.map(([v, l]) => `<button type="button" class="option" data-v="${esc(v)}" aria-pressed="${ans[q.key] === v}">${esc(l)}</button>`).join('')}</div>`;
    } else if (q.type === 'money' || q.type === 'number') {
      const cur = ans[q.key] ?? (q.def ? q.def(ans) : null);
      const val = cur == null ? '' : q.type === 'money' ? nf.format(cur) : cur;
      body = `<label class="field"><span class="sr-only">${esc(qText)}</span>
        <div class="${q.type === 'money' ? 'input-money' : ''}"><input id="wz-in" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="${esc(val)}" placeholder="${esc(q.placeholder || '')}"></div>
        ${q.unit ? `<small class="muted">${esc(q.unit)}</small>` : ''}</label>
        <p class="muted" id="wz-err" style="color:var(--danger);display:none;font-size:14px"></p>
        <button type="button" class="btn shu block" data-next>${t('下一步 →', 'Next →')}</button>
        ${q.optional ? `<button type="button" class="btn secondary block" style="margin-top:8px" data-skip>${esc(q.skipLabel || t('唔知／跳過', 'Not sure / skip'))}</button>` : ''}`;
    } else if (q.type === 'multi') {
      const cur = ans[q.key] || [];
      body = `<div class="options">${q.opts.map(([v, l]) => `<button type="button" class="option" data-m="${esc(v)}" aria-pressed="${cur.includes(v)}">${esc(l)}</button>`).join('')}</div>
        <button type="button" class="btn shu block" style="margin-top:12px" data-next>${t('下一步 →', 'Next →')}</button>`;
    } else if (q.type === 'counts') {
      body = `${q.fields.map(([k, l, max]) => `<div class="field"><span>${esc(l)}</span>
        <div class="stepper"><button type="button" class="btn secondary" data-step="${esc(k)}" data-d="-1" aria-label="${t('減一', 'Minus one')}">−</button>
        <input type="number" min="0" max="${max ?? 9}" value="${ans[k] ?? 0}" data-count="${esc(k)}" inputmode="numeric" enterkeyhint="next" aria-label="${esc(l)}">
        <button type="button" class="btn secondary" data-step="${esc(k)}" data-d="1" aria-label="${t('加一', 'Plus one')}">+</button></div></div>`).join('')}
        <button type="button" class="btn shu block" data-next>${t('下一步 →', 'Next →')}</button>`;
    }
    const stepPct = N ? ((n - 1) / N) * 100 : 0;
    box.innerHTML = `
      <div class="q-step">${esc(t(`第 ${n} / ${N} 題`, `Question ${n} of ${N}`))}</div>
      <div class="progress" aria-hidden="true"><i style="width:${stepPct}%"></i></div>
      <h3 style="margin-top:14px">${esc(qText)}</h3>
      ${qHelp ? `<p class="muted" style="font-size:14px;margin-top:-4px">${esc(qHelp)}</p>` : ''}
      ${body}
      ${hist.length ? `<div class="q-nav"><button type="button" class="btn secondary" data-back>${t('← 返回上一題', '← Back')}</button></div>` : ''}`;

    box.querySelectorAll('.option[data-v]').forEach(b => b.addEventListener('click', () => { ans[q.key] = b.dataset.v; go(i + 1); }));
    if (q.type === 'multi') {
      const btns = [...box.querySelectorAll('.option[data-m]')];
      btns.forEach(b => b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (on) btns.forEach(x => {   // 「以上都冇」同其他選項互相排斥
          if (x !== b && (x.dataset.m === q.none || b.dataset.m === q.none)) x.setAttribute('aria-pressed', 'false');
        });
      }));
      box.querySelector('[data-next]').addEventListener('click', () => {
        ans[q.key] = btns.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.m);
        go(i + 1);
      });
    }
    box.querySelector('[data-back]')?.addEventListener('click', back);
    // 撳「下一步／返回」時唔好搶走輸入框焦點，鍵盤可以一直留住
    box.querySelectorAll('[data-next], [data-back], [data-skip]').forEach(b => b.addEventListener('pointerdown', e => { if (document.activeElement?.matches?.('#wz-in, input[data-count]')) e.preventDefault(); }));
    const inp = box.querySelector('#wz-in');
    if (inp) {
      if (q.type === 'money') inp.addEventListener('input', () => { const v = parse(inp.value); inp.value = v == null ? '' : nf.format(Math.round(v)); });
      const submit = () => {
        const v = parse(inp.value), err = box.querySelector('#wz-err');
        const bad = v == null ? t('請輸入數字', 'Please enter a number')
          : q.min != null && v < q.min ? t(`最少 ${q.min}`, `At least ${q.min}`)
          : q.max != null && v > q.max ? t(`最多 ${nf.format(q.max)}`, `At most ${nf.format(q.max)}`)
          : q.check ? q.check(v, ans) : '';
        if (bad) { err.textContent = bad; err.style.display = 'block'; return; }
        ans[q.key] = v; go(i + 1);
      };
      box.querySelector('[data-next]').addEventListener('click', submit);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      box.querySelector('[data-skip]')?.addEventListener('click', () => { ans[q.key] = null; go(i + 1); });
    }
    if (q.type === 'counts') {
      const clamp = (el) => Math.max(0, Math.min(Number(el.max) || 9, Math.round(Number(el.value) || 0)));
      box.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
        const el = box.querySelector(`[data-count="${b.dataset.step}"]`);
        el.value = clamp({ value: Number(el.value) + Number(b.dataset.d), max: el.max });
      }));
      box.querySelector('[data-next]').addEventListener('click', () => {
        box.querySelectorAll('[data-count]').forEach(el => { ans[el.dataset.count] = clamp(el); });
        go(i + 1);
      });
    }
  }

  const api = {
    ans,
    edit: () => { i = hist.pop() ?? 0; render(); showQuestion(); },
    restart: () => { for (const k in ans) delete ans[k]; Object.assign(ans, init); hist = []; i = nextIndex(0); render(); showQuestion(); },
  };
  i = nextIndex(0);
  render();
  return api;
}
