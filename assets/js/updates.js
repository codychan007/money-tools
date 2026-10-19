// 市場解讀：列表 + 文章（Markdown）
// 只顯示 status = "published" 嘅文章；網址加 ?preview=1 先睇到草稿。
import { mountLayout, loadJSON, esc } from './layout.js';

mountLayout();
const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const preview = params.get('preview') === '1';

const DISCLAIMER = `<div class="disclaimer"><strong>重要提示：</strong>市場解讀只係一般資訊整理，反映撰寫時嘅公開資料，
  不構成任何投資建議，亦唔係買賣任何資產嘅推介。投資涉及風險，過往表現不代表將來。</div>`;

/** 迷你 Markdown：標題、段落、清單、粗體、連結、分隔線 */
function md(src) {
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>');
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { close(); const l = Math.min(3, m[1].length + 1); out.push(`<h${l}>${inline(m[2])}</h${l}>`); continue; }
    if (/^---+$/.test(line)) { close(); out.push('<hr>'); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^>\s?(.*)/))) { close(); out.push(`<div class="callout">${inline(m[1])}</div>`); continue; }
    close(); out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join('\n');
}

const idx = await loadJSON('/data/updates.json');
const posts = idx.posts.filter(p => p.status === 'published' || preview).sort((a, b) => b.date.localeCompare(a.date));
const id = params.get('id');

if (id) {
  const p = posts.find(x => x.id === id);
  if (!p) {
    app.innerHTML = `<p>搵唔到呢篇文章。</p><a href="/updates/">← 返回列表</a>`;
  } else {
    const isPdf = /\.pdf$/i.test(p.file);
    document.title = `${p.title}｜理財資訊通`;
    const head = `
      <a href="/updates/${preview ? '?preview=1' : ''}">← 所有市場解讀</a>
      ${p.status !== 'published' ? '<div class="sample-banner">📝 草稿：未經審閱，請勿分享或公開。審閱後喺 data/updates.json 將 status 改為 published。</div>' : ''}
      <span class="badge">${esc(p.date)}</span> <span class="muted" style="font-size:13px">${p.period ? `回顧期 ${esc(p.period)}｜` : ''}數據截至 ${esc(p.dataAsOf || p.date)}</span>
      <h1 style="margin-top:10px">${esc(p.title)}</h1>`;
    if (isPdf) {
      app.innerHTML = `${head}
        <div class="grid cols-2">
          <a class="btn block" href="${esc(p.file)}" target="_blank" rel="noopener">📄 全螢幕開啟 PDF</a>
          <a class="btn secondary block" href="${esc(p.file)}" download>⬇️ 下載 PDF</a>
        </div>
        <div id="pdf-pages" class="stack"><div class="card center muted">PDF 載入中……</div></div>
        ${DISCLAIMER}
        <div data-cta></div>`;
      mountCta();
      renderPdf(p.file, document.getElementById('pdf-pages'));
    } else {
      const text = await (await fetch(p.file, { cache: 'no-cache' })).text();
      app.innerHTML = `${head}<article class="card article">${md(text)}</article>${DISCLAIMER}<div data-cta></div>`;
      mountCta();
    }
  }
} else {
  app.innerHTML = `
    <section class="hero">
      <div class="kicker">🗞️ 市場解讀</div>
      <h1>每兩星期，講清楚市場發生緊咩事</h1>
      <p>唔講術語、唔叫你買邊隻，只係幫你理解大環境同對荷包嘅影響。</p>
    </section>
    ${preview ? '<div class="sample-banner">預覽模式：包括未發布嘅草稿。</div>' : ''}
    ${posts.length ? posts.map(p => `
      <a class="card tool-card" href="/updates/?id=${encodeURIComponent(p.id)}${preview ? '&preview=1' : ''}">
        <span class="badge">${esc(p.date)}</span> ${p.status !== 'published' ? '<span class="badge draft">草稿</span>' : ''}
        <h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><span class="go">閱讀全文 →</span>
      </a>`).join('') : '<div class="card center muted">第一篇市場解讀準備緊，遲啲再嚟睇 👀</div>'}
    ${DISCLAIMER}`;
}

/**
 * 用 PDF.js 將每頁畫成圖片（手機瀏覽器多數唔可以直接喺網頁內睇 PDF）。
 * 捲到先畫，慳流量同記憶體。
 */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function renderPdf(url, box) {
  // 喺函數入面定義：上面嘅頂層程式會喺呢行之前就呼叫 renderPdf
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
  try {
    if (!window.pdfjsLib) await loadScript(`${PDFJS}/pdf.min.js`);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
    const pdf = await pdfjsLib.getDocument({ url, cMapUrl: `${PDFJS}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${PDFJS}/standard_fonts/` }).promise;
    box.innerHTML = '';
    const first = await pdf.getPage(1);
    const vp1 = first.getViewport({ scale: 1 });
    const holders = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const h = document.createElement('div');
      h.className = 'pdf-page';
      h.style.aspectRatio = `${vp1.width} / ${vp1.height}`;
      h.dataset.n = n;
      h.setAttribute('aria-label', `第 ${n} 頁，共 ${pdf.numPages} 頁`);
      box.appendChild(h); holders.push(h);
    }
    const draw = async h => {
      if (h.dataset.done) return; h.dataset.done = '1';
      const page = await pdf.getPage(+h.dataset.n);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const scale = (h.clientWidth * dpr) / page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale });
      const cv = document.createElement('canvas');
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      h.appendChild(cv);
    };
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { draw(e.target); io.unobserve(e.target); } }), { rootMargin: '600px 0px' });
    holders.forEach(h => io.observe(h));
  } catch (e) {
    box.innerHTML = `<div class="card center">未能喺網頁內顯示 PDF，請按上面「全螢幕開啟 PDF」睇。</div>`;
  }
}

function mountCta() {
  document.querySelectorAll('[data-cta]').forEach(el => {
    el.innerHTML = `<div class="cta-soft"><p>想知呢啲變化對你有咩影響？</p><a href="/book/">預約免費傾談 →</a></div>`;
  });
}
