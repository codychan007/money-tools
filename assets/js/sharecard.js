// ============================================================
// IG Story 分享卡：1080 × 1920（9:16），直接用 Canvas 畫，唔靠截圖
// ============================================================
import { SITE } from './config.js';

const W = 1080, H = 1920;
const FONT = '"PingFang HK", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
const C = { g9: '#0A3D2A', g8: '#0F5C3F', g6: '#1F7A55', g1: '#E3F1EA', accent: '#F4B942', ink: '#17251F', ink2: '#4A5A53' };

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** 自動換行，回傳最後一行嘅 y */
export function wrapText(ctx, text, x, y, maxW, lineH) {
  let line = '';
  for (const ch of String(text)) {
    if (ch === '\n') { ctx.fillText(line, x, y); line = ''; y += lineH; continue; }
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = ch; y += lineH; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
}

/**
 * opts: { kicker, title, big, bigSub, draw(ctx, box) }
 * draw 喺白卡內畫自訂內容，box = {x, y, w, h}
 */
export function buildCard(opts) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 背景
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.g8); g.addColorStop(1, C.g9);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(244,185,66,.12)';
  ctx.beginPath(); ctx.arc(W - 80, 200, 260, 0, Math.PI * 2); ctx.fill();

  // 頂部品牌
  ctx.fillStyle = C.accent; rr(ctx, 80, 120, 84, 84, 22); ctx.fill();
  ctx.fillStyle = C.g9; ctx.font = `800 46px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('理', 122, 164);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff'; ctx.font = `700 40px ${FONT}`; ctx.fillText(SITE.shortName, 190, 158);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `400 28px ${FONT}`; ctx.fillText(SITE.byline, 190, 198);

  // 標題
  ctx.fillStyle = C.accent; ctx.font = `700 40px ${FONT}`; ctx.fillText(opts.kicker || '', 80, 330);
  ctx.fillStyle = '#fff'; ctx.font = `800 64px ${FONT}`;
  wrapText(ctx, opts.title || '', 80, 420, W - 160, 84);

  // 白卡
  const box = { x: 60, y: 560, w: W - 120, h: 1040 };
  ctx.fillStyle = '#fff'; rr(ctx, box.x, box.y, box.w, box.h, 48); ctx.fill();
  if (opts.big) {
    ctx.fillStyle = C.g8; ctx.font = `800 130px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(opts.big, W / 2, box.y + 200);
    ctx.fillStyle = C.ink2; ctx.font = `500 38px ${FONT}`;
    ctx.fillText(opts.bigSub || '', W / 2, box.y + 270);
    ctx.textAlign = 'left';
  }
  if (opts.draw) opts.draw(ctx, { x: box.x + 60, y: box.y + (opts.big ? 330 : 80), w: box.w - 120, h: box.h - 400 }, { C, FONT, rr });

  // 頁尾
  ctx.fillStyle = '#fff'; ctx.font = `700 42px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`你又計下？IG 搵 @${SITE.ig}`, W / 2, 1700);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `400 30px ${FONT}`;
  ctx.fillText(SITE.name, W / 2, 1752);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `400 24px ${FONT}`;
  ctx.fillText('結果僅供參考，不構成投資或保險建議；回報率為假設，並非保證。', W / 2, 1830);
  ctx.textAlign = 'left';
  return cv;
}

/** 預覽 + 分享（手機用分享選單，否則下載） */
export async function shareCanvas(cv, filename, previewEl) {
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  if (previewEl) {
    previewEl.innerHTML = `<img src="${url}" alt="分享卡預覽"><p class="muted" style="font-size:13px">如果冇彈出分享選單，長按圖片儲存，再上載到 IG Story。</p>`;
    previewEl.style.display = 'block';
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: SITE.shortName }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
