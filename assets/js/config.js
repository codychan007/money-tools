// ============================================================
// 網站設定：品牌、聯絡方式。改呢度就會全站更新。
// ============================================================
export const SITE = {
  name: '香港地一站式理財資訊通',
  shortName: '理財資訊通',
  byline: 'By Cody Chan',
  ig: 'codychan813',
  phone: '46254001',
  whatsapp: '85246254001',
  whatsappText: '你好 Cody，我喺理財資訊通網站見到，想預約免費傾談。',
  calendarUrl: 'https://calendar.app.google/QXA112toHCRAD5qr9',
};

export const igUrl = `https://www.instagram.com/${SITE.ig}/`;
export const waUrl = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappText)}`;
export const telUrl = `tel:+852${SITE.phone}`;
