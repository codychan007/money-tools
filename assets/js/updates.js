// 市場解讀：文章頁同列表已經由 scripts/build.py 生成靜態 HTML。
// 呢度只負責：① 喺文章頁將 PDF 逐頁畫出嚟 ② 舊網址 /updates/?id=xxx 轉去 /updates/xxx/
// ③ 列表頁加 ?preview=1 時顯示草稿
import { mountLayout, loadJSON, esc } from './layout.js';
import { t, P, EN } from './i18n.js';

mountLayout();
const params = new URLSearchParams(location.search);

const legacyId = params.get('id');
if (legacyId && /^[\w-]+$/.test(legacyId)) location.replace(`${P}/updates/${legacyId}/`);

const pdfBox = document.getElementById('pdf-pages');
if (pdfBox?.dataset.pdf) renderPdf(pdfBox.dataset.pdf, pdfBox);

if (params.get('preview') === '1' && document.getElementById('posts')) {
  const idx = await loadJSON('/data/updates.json');
  const drafts = idx.posts.filter(p => p.status !== 'published');
  document.getElementById('posts').insertAdjacentHTML('afterbegin',
    `<div class="sample-banner">${t('預覽模式：包括未發布嘅草稿。', 'Preview mode: includes unpublished drafts.')}</div>` + drafts.map(p => `
    <a class="card tool-card" href="${P}/updates/${encodeURIComponent(p.id)}/">
      <span class="badge">${esc(p.date)}</span> <span class="badge draft">${t('草稿', 'Draft')}</span>
      <h3>${esc((EN && p.title_en) || p.title)}</h3><p>${esc((EN && p.summary_en) || p.summary)}</p><span class="go">${t('閱讀全文 →', 'Read more →')}</span>
    </a>`).join(''));
}

/**
 * 用 PDF.js 將每頁畫成圖片（手機瀏覽器多數唔可以直接喺網頁內睇 PDF）。
 * 捲到先畫，慳流量同記憶體。
 */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function renderPdf(url, box) {
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
      h.setAttribute('aria-label', t(`第 ${n} 頁，共 ${pdf.numPages} 頁`, `Page ${n} of ${pdf.numPages}`));
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
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { draw(en.target); io.unobserve(en.target); } }), { rootMargin: '600px 0px' });
    holders.forEach(h => io.observe(h));
  } catch {
    box.innerHTML = `<div class="card center">${t('未能喺網頁內顯示 PDF，請按上面「全螢幕開啟 PDF」睇。', "The PDF can't be shown here. Please use “Open the PDF” above.")}</div>`;
  }
}
