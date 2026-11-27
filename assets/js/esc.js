// HTML 跳脫同連結檢查。呢個檔案唔可以 import 其他模組，避免同 layout.js 循環引用。
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 只准 http(s) 或站內路徑。javascript: 這類值唔會變成連結。 */
export function safeUrl(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (s.startsWith('/') && !s.startsWith('//')) {
    if (/[\s<>"']/.test(s)) return '';
    return s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}
