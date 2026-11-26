// 預約頁：聯絡掣直接用得（撳即表示同意個人資料收集聲明）；
// 做咗理財體檢嘅話，WhatsApp 訊息預先寫好分數（訪客自己撳傳送先會發出）
import { mountLayout } from './layout.js';
import { SITE } from './config.js';
import { EN, t } from './i18n.js';
import { readJourney, scoreMessage, weakest } from './journey.js';

mountLayout();
const $ = id => document.getElementById(id);

const baseMsg = scoreMessage(readJourney().health, true) || (EN ? SITE.whatsappTextEn : SITE.whatsappText);

// ---- 預約前兩條必揀題：揀晒先撳得預約；答案只會帶入訊息，網站唔會儲存 ----
const TOPICS = [
  ['儲錢同理財規劃', 'Saving and money planning'],
  ['醫療同危疾保障', 'Medical and critical illness cover'],
  ['扣稅（自願醫保、TVC、QDAP）', 'Tax deductions (VHIS, TVC, QDAP)'],
  ['退休規劃', 'Retirement planning'],
  ['未諗好，想整體睇下', 'Not sure yet, a general look'],
];
const TIMES = [
  ['平日日頭（9am–6pm）', 'Weekday daytime (9am–6pm)'],
  ['平日晚上（7pm–10pm）', 'Weekday evening (7pm–10pm)'],
  ['週末上晝', 'Weekend morning'],
  ['週末下晝', 'Weekend afternoon'],
  ['週末晚上', 'Weekend evening'],
  ['時間彈性，邊個時間都得', 'Flexible, any time'],
];
const chip = (label, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="false">${label}</button>`;
$('q-topic').innerHTML = TOPICS.map((x, i) => chip(t(...x), i)).join('');
$('q-time').innerHTML = TIMES.map((x, i) => chip(t(...x), i)).join('');
let topic = null; const times = new Set();
$('q-topic').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  topic = +b.dataset.i;
  $('q-topic').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
  refresh();
});
$('q-time').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const i = +b.dataset.i, on = !times.has(i);
  on ? times.add(i) : times.delete(i);
  b.setAttribute('aria-pressed', String(on));
  refresh();
});

const ready = () => topic !== null && times.size > 0;
const answers = () => ({
  topic: t(...TOPICS[topic]),
  time: [...times].sort((a, b) => a - b).map(i => t(...TIMES[i])).join(t('、', ', ')),
});
function refresh() {
  const ok = ready();
  ['cal', 'wa'].forEach(id => {
    $(id).classList.toggle('locked', !ok);
    $(id).setAttribute('aria-disabled', String(!ok));
  });
  $('cal').href = SITE.calendarUrl;
  if (ok) {
    const a = answers();
    const extra = t(`\n想傾：${a.topic}\n方便時間：${a.time}`, `\nMain topic: ${a.topic}\nTimes that suit me: ${a.time}`);
    $('wa').href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(baseMsg + extra)}`;
    $('prebook-hint').classList.remove('nudge');
    $('cal-note').hidden = false;
    $('cal-note').textContent = t('用 Google 日曆預約：撳掣時會幫你複製答案，喺預約表「諮詢主題」一欄貼上就得。',
      'Booking with Google Calendar: your answers are copied when you tap, so just paste them into the "topic" box on the form.');
  } else {
    $('wa').removeAttribute('href');
    $('cal-note').hidden = true;
  }
}
// 未揀晒就撳：唔開連結，提示佢先揀
['cal', 'wa'].forEach(id => $(id).addEventListener('click', e => {
  if (!ready()) {
    e.preventDefault();
    const h = $('prebook-hint');
    h.classList.remove('nudge'); void h.offsetWidth; h.classList.add('nudge');
    $('prebook').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (id === 'cal') {
    const a = answers();
    const text = t(`想傾：${a.topic}｜方便時間：${a.time}`, `Topic: ${a.topic} | Times: ${a.time}`);
    try { navigator.clipboard?.writeText(text); } catch { /* 唔俾複製就算 */ }
    $('cal-note').textContent = t(`已複製：「${text}」，喺預約表「諮詢主題」一欄貼上就得。`,
      `Copied: "${text}". Paste it into the "topic" box on the booking form.`);
  }
}, true));
refresh();

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
