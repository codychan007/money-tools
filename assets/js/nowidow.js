// ============================================================
// 排版：避免一段字最尾嗰行得返一兩隻字（「孤字」）
// 做法：每段字最尾大約 4 隻中文字（或者最尾兩個英文字）之間，加隱形嘅
// 「唔准斷行」記號（U+2060 字連接符；英文用不換行空格）。咁瀏覽器要斷行，
// 就會將呢幾隻字成組搬落下一行，最尾一行最少有 3–4 隻字。
// 唔靠 CSS text-wrap，所以舊版 Chrome／Samsung Internet 都有效。
// 動態生成嘅字（計算結果、總結）會自動再處理；轉螢幕方向會重新計。
// 太窄嘅格（例如表格細格）唔處理，免得撐爆版面。
// 另外按文法斷句：標題喺標點後面先轉行；內文逗號後頭 3 隻字、「」入面短詞唔拆開。
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
      // 用頁面上真正嘅字（未寫入嘅修改唔計），以免位置錯
      var node = pos[p].node;
      if (node.__offsData !== node.data) {
        var real = Array.from(node.data), acc = 0;
        node.__offs = real.map(function (c) { var o = acc; acc += c.length; return [o, c.length]; });
        node.__offsData = node.data;
      }
      var o = node.__offs[pos[p].i];
      if (!o) continue;
      r.setStart(node, o[0]); r.setEnd(node, o[0] + o[1]);
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
      // 去到「，、。」等標點：最後一句已經有 3 隻字或以上就停（喺標點後面轉行最自然）
      if (BOUNDARY.test(c) && weight >= 3) break;
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
    glueSpan(pos, start, end, changed, true);
    commit(changed);
  }

  // 將 pos[start..end] 黐埋（中間唔准斷行）。
  // 「，、。」等標點後面保留轉行位（cross 為 true 先黐埋），免得幾句連成一大舊
  function glueSpan(pos, start, end, changed, cross) {
    for (var p = start; p < end; p++) {
      var a = pos[p], nb = pos[p + 1];
      if (!cross && BOUNDARY.test(a.ch)) continue;
      var arrA = cps(a.node);
      if (SPACE.test(a.ch)) {
        if (arrA[a.i] === NBSP || arrA[a.i] === '') continue;
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
  }

  // ------------------------------------------------------------
  // 按文法斷句：
  //  - 標題、按鈕、常見問題：每個短句（以「，、：？！。」分開）成組，只喺標點後面轉行
  //    例：「扣埋強積金，你每月可以儲幾多？」→「扣埋強積金，⏎你每月可以儲幾多？」
  //    句子長過一行先喺句中間斷。
  //  - 內文：逗號後面頭 3 隻字黐埋（行尾唔會吊住「，你」），「」（）入面嘅短詞唔拆開
  // ------------------------------------------------------------
  var BOUNDARY = /[，、：；？！。]/;
  var ASCII_BOUNDARY = /[,;:?!]/;
  var CLOSERS = /[」』）〉》】"'”’)]/;
  var TITLE_TAG = /^(H[1-6]|SUMMARY|BUTTON|LEGEND|DT)$/;
  var JOIN_NEXT = /^[同及與和或但而]$/;
  var JOIN_PREV = /^[嘅咗緊住過晒吓啦㗎喎嘛咩呢]$/;
  var SEG = null;
  try { if (window.Intl && Intl.Segmenter) SEG = new Intl.Segmenter('zh-Hant', { granularity: 'word' }); } catch (e) { SEG = null; }
  var TITLE_SEL = '.btn, .cta-btn, .kicker, .section-title, .eyebrow, .teaser b';

  function isTitle(b) {
    return TITLE_TAG.test(b.tagName) || (b.matches && b.matches(TITLE_SEL));
  }

  function phraseBlock(b, nodes) {
    var pos = [];
    for (var n = 0; n < nodes.length && pos.length < 5000; n++) {
      var arr = cps(nodes[n]);
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] === WJ || arr[i] === '​') continue;
        pos.push({ node: nodes[n], i: i, ch: arr[i] });
      }
    }
    var hanCount = 0;
    for (var q = 0; q < pos.length; q++) if (HAN.test(pos[q].ch)) hanCount++;
    if (hanCount < 4) return;   // 英文為主：唔處理
    var cw = contentWidth(b) * MAX_SHARE;
    var title = isTitle(b);
    var changed = new Set();

    // 詞語唔拆開（用瀏覽器內置中文分詞，2–4 隻字嘅詞；舊瀏覽器冇呢個功能就略過）
    if (SEG) {
      var str = '', idxOf = {};
      for (var t = 0; t < pos.length; t++) { idxOf[str.length] = t; str += pos[t].ch; }
      var segs = SEG.segment(str), list = [];
      if (segs && segs[Symbol.iterator]) { var it = segs[Symbol.iterator](), sv; while (!(sv = it.next()).done) list.push(sv.value); }
      list.forEach(function (sg) {
        if (!sg.isWordLike || !HAN.test(sg.segment)) return;
        var len = Array.from(sg.segment).length;
        // 單字：連接字（同、及、或…）黐住後面；助詞（嘅、咗、緊…）黐住前面
        if (len === 1) {
          var at = idxOf[sg.index];
          if (at === undefined) return;
          if (JOIN_NEXT.test(sg.segment) && pos[at + 1] && HAN.test(pos[at + 1].ch)) glueSpan(pos, at, at + 1, changed);
          else if (JOIN_PREV.test(sg.segment) && at > 0 && HAN.test(pos[at - 1].ch)) glueSpan(pos, at - 1, at, changed);
          return;
        }
        if (len < 2 || len > 4) return;
        var a0 = idxOf[sg.index], z1 = idxOf[sg.index + sg.segment.length];
        if (a0 === undefined) return;
        glueSpan(pos, a0, (z1 === undefined ? pos.length : z1) - 1, changed);
      });
    }

    // 切開短句
    var clauses = [], s = 0;
    for (var p = 0; p < pos.length; p++) {
      var c = pos[p].ch;
      var isB = BOUNDARY.test(c) || (ASCII_BOUNDARY.test(c) && pos[p + 1] && SPACE.test(pos[p + 1].ch));
      if (!isB) continue;
      var e = p;
      while (e + 1 < pos.length && CLOSERS.test(pos[e + 1].ch)) e++;
      clauses.push([s, e]);
      s = e + 1; p = e;
    }
    if (s < pos.length) clauses.push([s, pos.length - 1]);

    clauses.forEach(function (cl) {
      var a = cl[0], z = cl[1];
      while (a <= z && SPACE.test(pos[a].ch)) a++;
      while (z >= a && SPACE.test(pos[z].ch)) z--;
      if (z - a < 1) return;
      if (title && tailWidth(pos, a, z) <= cw) { glueSpan(pos, a, z, changed); return; }
      // 內文（或者太長嘅標題句）：句頭 3 隻字黐埋；短句（4 隻字或以下）成句黐埋
      var h = 0, k = a, hanIn = 0;
      for (var x = a; x <= z; x++) if (HAN.test(pos[x].ch)) hanIn++;
      if (hanIn <= 4) k = z;
      else {
        // 數 3 個單位：每隻中文字一個；一個英文字／數字（例如 7、WhatsApp）都當一個
        for (; k <= z; k++) {
          var ch = pos[k].ch;
          if (HAN.test(ch)) { if (++h >= 3) break; continue; }
          if (SPACE.test(ch) || CJK_PUNCT.test(ch)) continue;
          while (k + 1 <= z && !SPACE.test(pos[k + 1].ch) && !HAN.test(pos[k + 1].ch) && !CJK_PUNCT.test(pos[k + 1].ch)) k++;
          if (++h >= 3) break;
        }
        if (k > z) k = z;
        while (k + 1 <= z && CLOSERS.test(pos[k + 1].ch)) k++;
      }
      if (k > a && tailWidth(pos, a, k) <= cw) glueSpan(pos, a, k, changed);
    });

    // 「」（）入面嘅短詞（8 隻字或以下）唔拆開
    for (var o = 0; o < pos.length; o++) {
      var open = pos[o].ch, close = open === '「' ? '」' : open === '（' ? '）' : open === '『' ? '』' : null;
      if (!close) continue;
      for (var m = o + 1; m < pos.length && m - o <= 10; m++) {
        if (pos[m].ch === close) { if (tailWidth(pos, o, m) <= cw) glueSpan(pos, o, m, changed); break; }
      }
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

  // 文字中間嘅超連結唔斬開兩行：成條連結一齊搬落下一行（太長、放唔落一行就照常斷）
  function glueLinks(root, cache) {
    var links = [].slice.call(root.querySelectorAll('a'));
    if (root.tagName === 'A') links.push(root);
    links.forEach(function (a) {
      if (getComputedStyle(a).display !== 'inline') return;
      var b = a.parentElement;
      while (b && b !== document.body && !isBlock(b, cache)) b = b.parentElement;
      if (!b || !b.clientWidth) return;
      var pos = [], w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT), t;
      while ((t = w.nextNode())) {
        var arr = cps(t);
        for (var i = 0; i < arr.length; i++) {
          if (arr[i] === WJ || arr[i] === '​') continue;
          pos.push({ node: t, i: i, ch: arr[i] });
        }
      }
      var s = 0, e = pos.length - 1;
      while (s <= e && SPACE.test(pos[s].ch)) s++;
      while (e >= s && SPACE.test(pos[e].ch)) e--;
      if (e - s < 1) return;
      if (tailWidth(pos, s, e) > contentWidth(b) * MAX_SHARE) return;
      var changed = new Set();
      glueSpan(pos, s, e, changed, true);
      commit(changed);
    });
  }

  function run(root) {
    var cache = new Map();
    var groups = new Map();
    // 其他程式改咗連結文字：箭咀冇咗，攞返 CSS 個箭咀先
    root.querySelectorAll('a.nw-has-arrow').forEach(function (a) { if (!a.querySelector('.nw-arrow')) a.classList.remove('nw-has-arrow'); });
    root.querySelectorAll('a[target="_blank"]').forEach(function (a) { try { glueArrow(a); } catch (e) { /* 保持原狀 */ } });
    try { glueLinks(root, cache); } catch (e) { /* 保持原狀 */ }
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
        try { phraseBlock(b, nodes); } catch (e) { /* 出錯就保持原狀 */ }
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
