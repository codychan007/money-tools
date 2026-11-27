// ============================================================
// 排版：避免一段字最尾嗰行得返一兩隻字（「孤字」）
// 做法：每段字最尾大約 4 隻中文字（或者最尾兩個英文字）之間，加隱形嘅
// 「唔准斷行」記號（U+2060 字連接符；英文用不換行空格）。咁瀏覽器要斷行，
// 就會將呢幾隻字成組搬落下一行，最尾一行最少有 3–4 隻字。
// 唔靠 CSS text-wrap，所以舊版 Chrome／Samsung Internet 都有效。
// 動態生成嘅字（計算結果、總結）會自動再處理；轉螢幕方向會重新計。
// 太窄嘅格（例如表格細格）唔處理，免得撐爆版面。
// 唔想某段處理：加 data-no-glue。
// ============================================================
(function () {
  'use strict';
  var WJ = '⁠', NBSP = ' ';
  var HAN = /[㐀-鿿豈-﫿]/;
  var CJK_PUNCT = /[　-〿＀-￯“-‟…—·]/;
  var SPACE = /[ \t\n\r\f]/;            // 普通空格（不換行空格唔計）
  var WORDY = /[A-Za-z0-9’']/;
  var CLOSE = /[.,;:!?)\]}%]/;
  var SKIP_TAG = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA|INPUT|SELECT|OPTION|PRE|CODE|SVG|CANVAS)$/i;
  var TARGET = 4;   // 最尾一組最少「4 隻中文字」咁闊（英文字母當半隻）
  var CAP = 10;     // 最多黐埋 10 隻中文字咁闊
  var MAX_SHARE = 0.9;    // 黐埋嘅部分唔可以闊過該段可用闊度嘅 90%（即係一定放得落一行）
  var touched = new Set();   // 改過嘅文字節點（轉方向時還原再計）

  function isBlock(el, cache) {
    if (cache.has(el)) return cache.get(el);
    var d = getComputedStyle(el).display;
    var b = d !== 'inline' && d !== 'contents';
    cache.set(el, b);
    return b;
  }

  function cps(node) {
    if (!node.__cps || node.__cpsData !== node.data) {
      node.__cps = Array.from(node.data);
      node.__cpsData = node.data;
    }
    return node.__cps;
  }

  function contentWidth(b) {
    var cs = getComputedStyle(b);
    return b.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  }

  // 量 pos[s..e] 呢段字（可能跨行）總闊度
  function tailWidth(pos, s, e) {
    var w = 0, r = document.createRange();
    for (var p = s; p <= e; p++) {
      var arr = cps(pos[p].node), off = 0;
      for (var q = 0; q < pos[p].i; q++) off += arr[q].length;
      r.setStart(pos[p].node, off); r.setEnd(pos[p].node, off + arr[pos[p].i].length);
      w += r.getBoundingClientRect().width;
    }
    return w;
  }

  function commit(changed) {
    changed.forEach(function (node) {
      var s = node.__cps.join('');
      if (s !== node.data) {
        if (!('__orig' in node)) node.__orig = node.data;
        node.data = s;
        node.__glued = s;
        touched.add(node);
      }
      node.__cps = null;
    });
  }

  function glueBlock(b, nodes) {
    var pos = [];
    for (var n = nodes.length - 1; n >= 0 && pos.length < 80; n--) {
      var arr = cps(nodes[n]);
      for (var i = arr.length - 1; i >= 0 && pos.length < 80; i--) {
        if (arr[i] === WJ || arr[i] === '​') continue;
        pos.push({ node: nodes[n], i: i, ch: arr[i] });
      }
    }
    pos.reverse();
    var k = pos.length - 1;
    while (k >= 0 && SPACE.test(pos[k].ch)) k--;
    var end = k;
    if (end < 1) return;
    var weight = 0, words = 0, han = 0;
    var done = function () { return weight >= CAP || (weight >= TARGET && !(words === 1 && han === 0)); };
    while (k >= 0) {
      var c = pos[k].ch;
      if (SPACE.test(c)) { if (done()) break; k--; continue; }
      if (HAN.test(c)) { weight += 1; han++; k--; if (done()) break; continue; }
      if (CJK_PUNCT.test(c)) { k--; continue; }
      // 英文字／數字：成個字一齊計（不換行空格當係同一組）
      var j = k, letters = false, len = 0;
      while (j >= 0 && !SPACE.test(pos[j].ch) && !HAN.test(pos[j].ch) && !CJK_PUNCT.test(pos[j].ch)) {
        if (/[A-Za-z0-9]/.test(pos[j].ch)) letters = true;
        len++; j--;
      }
      weight += len * 0.5;
      if (letters) words++;
      k = j;
      if (done()) break;
    }
    var start = k + 1;
    if (start >= end || start === 0) return;   // 成段都好短：唔使處理
    // 太闊就唔黐（例如窄格、細卡）
    if (tailWidth(pos, start, end) > contentWidth(b) * MAX_SHARE) return;

    var changed = new Set();
    for (var p = start; p < end; p++) {
      var a = pos[p], nb = pos[p + 1];
      var arrA = cps(a.node);
      if (SPACE.test(a.ch)) {
        arrA[a.i] = (p > start && SPACE.test(pos[p - 1].ch)) ? '' : NBSP;
        changed.add(a.node);
        continue;
      }
      // 「|」「-」「/」後面嘅不換行空格仍然可以斷，所以呢類符號後面都要加 WJ
      if (SPACE.test(nb.ch) && WORDY.test(a.ch)) continue;
      if (WORDY.test(a.ch) && WORDY.test(nb.ch)) continue;   // 英文字中間本身唔會斷
      if (CLOSE.test(nb.ch)) continue;                         // 句號、逗號前面本身唔會斷
      if (arrA[a.i + 1] === WJ || arrA[a.i].slice(-1) === WJ) continue;
      arrA[a.i] = arrA[a.i] + WJ;
      changed.add(a.node);
    }
    commit(changed);
  }

  // 外部連結尾嘅「↗」（CSS ::after）會自己跌落下一行：
  // 改用連結入面一個真嘅箭咀，同最尾一隻字包埋唔准斷行
  function glueArrow(link) {
    if (link.querySelector('.nw-tail')) return;
    var after = getComputedStyle(link, '::after').content;
    if (!after || after === 'none' || after === 'normal') return;
    var w = document.createTreeWalker(link, NodeFilter.SHOW_TEXT), t, lastT = null;
    while ((t = w.nextNode())) if (/\S/.test(t.data)) lastT = t;
    if (!lastT) return;
    var m = /(\S)(⁠?)(\s*)$/u.exec(lastT.data);
    if (!m) return;
    var cut = lastT.data.length - m[0].length;
    var rest = lastT.splitText(cut);
    var span = document.createElement('span');
    span.className = 'nw-tail';
    rest.parentNode.insertBefore(span, rest);
    span.appendChild(rest);
    var arrow = document.createElement('span');
    arrow.className = 'nw-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = ' ↗';
    span.appendChild(arrow);
    link.classList.add('nw-has-arrow');
  }

  function run(root) {
    var cache = new Map();
    var groups = new Map();
    // 其他程式改咗連結文字：箭咀冇咗，攞返 CSS 個箭咀先
    root.querySelectorAll('a.nw-has-arrow').forEach(function (a) { if (!a.querySelector('.nw-arrow')) a.classList.remove('nw-has-arrow'); });
    root.querySelectorAll('a[target="_blank"]').forEach(function (a) { try { glueArrow(a); } catch (e) { /* 保持原狀 */ } });
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (SKIP_TAG.test(n.tagName) || n.isContentEditable || n.hasAttribute('data-no-glue')) return NodeFilter.FILTER_REJECT;
          return n.tagName === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
        return /\S/.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var t;
    while ((t = walker.nextNode())) {
      var b = t.parentElement;
      while (b && b !== root && !isBlock(b, cache)) b = b.parentElement;
      if (!b) continue;
      if (!groups.has(b)) groups.set(b, [[]]);
      var segs = groups.get(b);
      // <br> 前後當係兩段，各自處理最尾嗰行
      if (t.nodeType === 1) { if (segs[segs.length - 1].length) segs.push([]); continue; }
      segs[segs.length - 1].push(t);
    }
    groups.forEach(function (segs, b) {
      var ws = getComputedStyle(b).whiteSpace;
      if (ws === 'pre' || ws === 'nowrap' || !b.clientWidth) return;
      segs.forEach(function (nodes) {
        if (!nodes.length) return;
        try { glueBlock(b, nodes); } catch (e) { /* 出錯就保持原狀 */ }
      });
    });
  }

  // 有字改咗：即刻（喺畫出嚟之前）處理受影響嗰幾段，唔會見到字跳
  var obs;
  function onMutate(list) {
    var cache = new Map(), roots = [];
    list.forEach(function (m) {
      var el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      while (el && el !== document.body && !isBlock(el, cache)) el = el.parentElement;
      if (el && el.isConnected && roots.indexOf(el) < 0) roots.push(el);
    });
    roots = roots.filter(function (r) { return !roots.some(function (o) { return o !== r && o.contains(r); }); });
    roots.forEach(function (r) { try { run(r); } catch (e) { /* 保持原狀 */ } });
    if (obs) obs.takeRecords();   // 自己改嘅字唔再觸發
  }
  // 轉螢幕方向／改視窗闊度：還原再重新計（窄格嘅判斷會變）
  var lastW = window.innerWidth, rTimer = null;
  function onResize() {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rTimer);
    rTimer = setTimeout(function () {
      touched.forEach(function (node) {
        // 只還原自己改過、之後冇其他程式再改過嘅字
        if (node.isConnected && '__orig' in node && node.data === node.__glued) node.data = node.__orig;
        delete node.__orig; delete node.__glued;
      });
      touched.clear();
      run(document.body);
      if (obs) obs.takeRecords();
    }, 200);
  }
  function start() {
    run(document.body);
    if ('MutationObserver' in window) {
      obs = new MutationObserver(onMutate);
      // class／hidden／style 改變（例如收埋嘅結果顯示出嚟）都要再處理：收埋時量唔到闊度
      obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'open'] });
    }
    window.addEventListener('resize', onResize);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
