// 預約頁：聯絡掣直接用得（撳即表示同意個人資料收集聲明）；
// 做咗理財體檢嘅話，WhatsApp 訊息預先寫好分數（訪客自己撳傳送先會發出）
import { mountLayout } from './layout.js';
import { SITE, waUrl, waUrlEn, telUrl } from './config.js';
import { EN } from './i18n.js';
import { readJourney, scoreMessage } from './journey.js';

mountLayout();
const $ = id => document.getElementById(id);
$('phone').textContent = SITE.phone;

const msg = scoreMessage(readJourney().health, true);
$('cal').href = SITE.calendarUrl;
$('wa').href = msg ? `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}` : (EN ? waUrlEn : waUrl);
$('tel').href = telUrl;

// 由其他頁撳「個人資料收集聲明」過嚟，就自動打開
const openPics = () => { if (location.hash === '#pics') { $('pics').open = true; $('pics').scrollIntoView(); } };
window.addEventListener('hashchange', openPics);
openPics();
