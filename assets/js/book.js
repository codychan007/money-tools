// 預約頁：聯絡掣直接用得（撳即表示同意個人資料收集聲明）；
// 做咗理財體檢嘅話，WhatsApp 訊息預先寫好分數（訪客自己撳傳送先會發出）
import { mountLayout } from './layout.js';
import { SITE, waUrl, waUrlEn } from './config.js';
import { EN, t } from './i18n.js';
import { readJourney, scoreMessage, weakest } from './journey.js';

mountLayout();
const $ = id => document.getElementById(id);

const msg = scoreMessage(readJourney().health, true);
$('cal').href = SITE.calendarUrl;
$('wa').href = msg ? `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}` : (EN ? waUrlEn : waUrl);

// 做咗理財體檢：「傾咩」改成針對佢嘅結果同最弱嗰項
const w = weakest(readJourney().health);
if (w) {
  $('topics').innerHTML = [
    t('一齊睇你嘅理財體檢結果', 'Go through your money check-up results together'),
    t(`針對你最值得先改善嘅「${w.name}」，計出具體做法`, `Work out concrete steps for "${w.name}", the area most worth improving first`),
    t('答你儲蓄、保障或者扣稅嘅問題', 'Answer your questions on saving, protection or tax'),
  ].map(x => `<li>${x}</li>`).join('');
}

// 由其他頁撳「個人資料收集聲明」過嚟，就自動打開
const openPics = () => { if (location.hash === '#pics') { $('pics').open = true; $('pics').scrollIntoView(); } };
window.addEventListener('hashchange', openPics);
openPics();
