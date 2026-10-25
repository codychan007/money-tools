// ============================================================
// IG Story 分享卡：1080 × 1920（9:16），直接用 Canvas 畫，唔靠截圖
// 風格同網站一樣：和紙底、墨色字、朱紅印章
// ============================================================
import { SITE } from './config.js';
import { t } from './i18n.js';

const W = 1080, H = 1920;
const FONT = '"Noto Sans HK", "PingFang HK", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const SERIF = '"Noto Serif HK", "Noto Serif TC", "Songti TC", "PMingLiU", serif';
const C = {
  paper: '#F3ECDD', paper2: '#EAE0CB', card: '#FBF7EE', ink: '#231F1C', ink2: '#564E46', line: '#D6C9AF',
  shu: '#B5361F', matcha: '#4F6B3A', ochre50: '#F4E6C6',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** 自動換行，回傳最後一行嘅 y（英文按字分行） */
export function wrapText(ctx, text, x, y, maxW, lineH) {
  const tokens = String(text).match(/[A-Za-z0-9$%,.'’\-+/]+\s*|\s+|\n|./gu) || [];
  let line = '';
  for (const tk of tokens) {
    if (tk === '\n') { ctx.fillText(line, x, y); line = ''; y += lineH; continue; }
    const test = line + tk;
    if (ctx.measureText(test.trimEnd()).width > maxW && line) { ctx.fillText(line.trimEnd(), x, y); line = tk.trimStart(); y += lineH; }
    else line = test;
  }
  if (line) ctx.fillText(line.trimEnd(), x, y);
  return y;
}

function stamp(ctx, x, y, size, ch) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2); ctx.rotate(-3 * Math.PI / 180);
  ctx.fillStyle = C.shu; rr(ctx, -size / 2, -size / 2, size, size, size * 0.1); ctx.fill();
  ctx.strokeStyle = 'rgba(251,243,228,.9)'; ctx.lineWidth = size * 0.035;
  rr(ctx, -size / 2 + size * 0.08, -size / 2 + size * 0.08, size * 0.84, size * 0.84, size * 0.06); ctx.stroke();
  ctx.fillStyle = '#FBF3E4'; ctx.font = `700 ${Math.round(size * 0.56)}px ${SERIF}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ch, 0, size * 0.03);
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

/**
 * opts: { kicker, title, big, bigSub, draw(ctx, box) }
 * draw 喺卡內畫自訂內容，box = {x, y, w, h}
 */
export function buildCard(opts) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 和紙底
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {   // 紙紋
    ctx.fillStyle = `rgba(90,72,46,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }

  // 頂部品牌
  stamp(ctx, 80, 110, 96, '理');
  ctx.fillStyle = C.ink; ctx.font = `700 42px ${SERIF}`; ctx.fillText(t(SITE.shortName, SITE.nameEn), 200, 152);
  ctx.fillStyle = C.ink2; ctx.font = `400 28px ${FONT}`; ctx.fillText(SITE.byline, 200, 194);

  // 標題
  ctx.fillStyle = C.shu; ctx.font = `700 38px ${FONT}`; ctx.fillText(opts.kicker || '', 80, 320);
  ctx.fillStyle = C.ink; ctx.font = `700 64px ${SERIF}`;
  wrapText(ctx, opts.title || '', 80, 410, W - 160, 84);

  // 內容卡
  const box = { x: 60, y: 560, w: W - 120, h: 1040 };
  ctx.fillStyle = 'rgba(35,31,28,.10)'; rr(ctx, box.x + 10, box.y + 10, box.w, box.h, 18); ctx.fill();
  ctx.fillStyle = C.card; rr(ctx, box.x, box.y, box.w, box.h, 18); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.stroke();
  if (opts.big) {
    ctx.fillStyle = C.ink; ctx.font = `700 124px ${SERIF}`; ctx.textAlign = 'center';
    ctx.fillText(opts.big, W / 2, box.y + 200);
    ctx.fillStyle = C.ink2; ctx.font = `500 36px ${FONT}`;
    ctx.fillText(opts.bigSub || '', W / 2, box.y + 270);
    ctx.textAlign = 'left';
  }
  if (opts.draw) opts.draw(ctx, { x: box.x + 60, y: box.y + (opts.big ? 330 : 80), w: box.w - 120, h: box.h - 400 }, { C, FONT, rr });

  // 頁尾
  ctx.fillStyle = C.ink; ctx.font = `700 42px ${SERIF}`; ctx.textAlign = 'center';
  ctx.fillText(t(`你又計下？IG 搵 @${SITE.ig}`, `Try it yourself: IG @${SITE.ig}`), W / 2, 1700);
  ctx.fillStyle = C.ink2; ctx.font = `400 30px ${FONT}`;
  ctx.fillText(t(SITE.name, SITE.nameEn), W / 2, 1752);
  ctx.fillStyle = 'rgba(35,31,28,.55)'; ctx.font = `400 24px ${FONT}`;
  ctx.fillText(t('結果僅供參考，不構成投資或保險建議；回報率為假設，並非保證。',
    'For reference only. Not investment or insurance advice. Returns are assumptions, not guarantees.'), W / 2, 1830);
  ctx.textAlign = 'left';
  return cv;
}

/** 預覽 + 分享（手機用分享選單，否則下載） */
export async function shareCanvas(cv, filename, previewEl) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  if (previewEl) {
    previewEl.innerHTML = `<img src="${url}" alt="${t('分享卡預覽', 'Share card preview')}"><p class="muted" style="font-size:13px">${
      t('如果冇彈出分享選單，長按圖片儲存，再上載到 IG Story。', "If the share menu doesn't appear, press and hold the image to save it, then post it to your IG Story.")}</p>`;
    previewEl.style.display = 'block';
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: t(SITE.shortName, SITE.nameEn) }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
