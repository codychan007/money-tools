// ============================================================
// 網站設定：品牌、聯絡方式。改呢度就會全站更新。
// ============================================================
export const SITE = {
  name: '香港地一站式理財資訊通',
  shortName: '理財資訊通',
  nameEn: 'HK Money Compass',
  byline: 'By Cody Chan',
  ig: 'codychan813',
  phone: '46254001',
  whatsapp: '85246254001',
  whatsappText: '你好 Cody，我喺理財資訊通網站見到，想預約 1 對 1 理財傾談。',
  whatsappTextEn: 'Hi Cody, I found you on HK Money Compass and would like to book a 1-on-1 money chat.',
  calendarUrl: 'https://calendar.app.google/QXA112toHCRAD5qr9',
};

export const igUrl = `https://www.instagram.com/${SITE.ig}/`;
export const waUrl = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappText)}`;
export const waUrlEn = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(SITE.whatsappTextEn)}`;
export const telUrl = `tel:+852${SITE.phone}`;
