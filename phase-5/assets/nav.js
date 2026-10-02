/* nav.js — 课程页共享注入层（kbar 共享层）
 * 1) 左侧两级小节导航：自动从 h2[id] + 其下属 h3 生成本课目录（≥1240px 显示，css 在 course.css）。
 *    滚动时高亮当前小节/小小节；点击平滑滚动。目录标签用短标签（去编号、去括注、取"："前段，
 *    撞名回退全称）；无 h2[id] 的页面静默退出；考场页（/exam/）与 data-no-toc 不建目录（防结构泄漏）。
 * 2) 法务免责页脚：全站每页注入（批次 C，调研 05 号文案）；涉加密品种页加加密风险句。
 * 3) 课程上下文导航：课页统一提供阶段返回与阶段实操入口。零依赖。 */
(function () {
  if (typeof document === 'undefined') return;

  /* ---- 课程上下文导航（课页统一入口） ---- */
  function injectLessonContext() {
    if (document.querySelector('.lesson-nav') || !document.body) return;

    var match = location.pathname.match(/\/phase-([0-6])\/lessons\/([^/]+)\.html$/);
    if (!match) match = location.pathname.match(/\/phase([1-6])\/course\/lessons\/([^/]+)\.html$/);
    if (!match) {
      var p0 = location.pathname.match(/\/course\/lessons\/([^/]+)\.html$/);
      if (p0) match = ['', '0', p0[1]];
    }
    if (!match) return;

    var phase = match[1];
    var lesson = match[2].match(/^(\d{4})/);
    var names = ['辨认', '复述推理', '作图应用', '概率引用', '组装综合', '执行自律', '贡献输出'];
    var nav = document.createElement('nav');
    nav.className = 'lesson-nav';
    nav.setAttribute('aria-label', '课程上下文');
    nav.innerHTML = '<a href="../index.html">← 返回 P' + phase + ' 阶段</a>'
      + '<span>P' + phase + ' · ' + names[Number(phase)] + ' · 第 ' + (lesson ? lesson[1] : '') + ' 课</span>'
      + '<a href="../mastery.html">' + (phase === '6' ? '作品集' : '阶段实操') + ' →</a>';

    var style = document.createElement('style');
    style.setAttribute('data-kbar-context-nav', '');
    style.textContent = '.lesson-nav{display:flex;justify-content:space-between;gap:1rem;margin:0 0 1.25rem;font:.82rem var(--sans,sans-serif);}'
      + '.lesson-nav a{color:var(--lesson-accent,var(--ink));border-bottom-color:rgba(45,86,107,.35);}'
      + '.lesson-nav a:focus-visible{outline:3px solid var(--lesson-focus,var(--ink));outline-offset:3px;}'
      + '@media(max-width:560px){.lesson-nav{flex-wrap:wrap;}}'
      + '@media print{.lesson-nav{display:none;}}';
    document.head.appendChild(style);
    document.body.insertBefore(nav, document.body.firstElementChild);
  }

  /* ---- 课页顶栏（票 063）：←上一课 / 课号·短题 / 下一课→ + 搜索入口 ----
   * 清单=构建产物 assets/lesson-nav.js（单一权威源 window.KBAR_LESSON_NAV，防课序漏改；
   * 用 script 标签加载而非 fetch——file:// 下 fetch 被 CORS 拦）。
   * 豁免面与左目录一致：考场/exercises/data-no-toc 页不注入（防结构泄漏与盲测干扰）。
   * 首课无 prev、末课无 next；打印隐藏。 */
  function injectTopbar() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.querySelector('.kbar-topbar')) return;
    if (document.body.hasAttribute('data-no-toc')) return;
    var pn = location.pathname;
    if (pn.indexOf('/exam/') >= 0 || pn.indexOf('/exercises/') >= 0) return;
    var match = pn.match(/\/phase-([0-6])\/lessons\/([^/]+)\.html$/)
      || pn.match(/\/phase([1-6])\/course\/lessons\/([^/]+)\.html$/);
    if (!match) {
      var p0 = pn.match(/\/course\/lessons\/([^/]+)\.html$/);
      if (p0) match = ['', '0', p0[1]];
    }
    if (!match) return;
    var phase = match[1], file = match[2] + '.html'; /* 正则组分不含扩展名，与清单 l.file 对齐 */

    function bar(nav) {
      if (document.querySelector('.kbar-topbar')) return;
      var lessons = (nav && nav.lessons) || [];
      var i = -1;
      lessons.forEach(function (l, k) { if (l.file === file) i = k; });
      if (i < 0) return; /* 清单未收（新页未再生成）则静默退出，不造幽灵链接 */
      var prev = lessons[i - 1], next = lessons[i + 1], cur = lessons[i];
      var root = pn.indexOf('/course/lessons/') >= 0 ? '../../' : '../../';
      var el = document.createElement('nav');
      el.className = 'kbar-topbar';
      el.setAttribute('aria-label', '课序导航');
      el.innerHTML =
        (prev ? '<a class="tb-prev" href="' + prev.file + '" title="' + prev.no + ' ' + prev.title + '">← ' + prev.no + '</a>' : '<span class="tb-side"></span>')
        + '<span class="tb-cur" title="' + cur.no + ' ' + cur.title + '">P' + phase + ' · ' + cur.no + ' ' + cur.short + '</span>'
        + '<a class="tb-search" href="' + root + 'search.html">搜索</a>'
        + (next ? '<a class="tb-next" href="' + next.file + '" title="' + next.no + ' ' + next.title + '">' + next.no + ' →</a>' : '<span class="tb-side"></span>');
      var st = document.createElement('style');
      st.setAttribute('data-kbar-topbar', '');
      st.textContent = 'body{padding-top:calc(2.5rem + 52px)}' /* 顶栏占位补偿（fixed 贴顶，正文不钻栏底） */
        + '.kbar-topbar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;gap:.7rem;padding:.45rem clamp(1rem,4vw,2rem);background:var(--paper,#fcfcfb);border-bottom:1px solid var(--line,#e4e2d9);font:.8rem var(--sans,sans-serif)}'
        + '.kbar-topbar a{color:var(--ink,#1c1c1a);border-bottom:none;padding:.35rem .5rem;border-radius:8px;min-height:36px;display:inline-flex;align-items:center;white-space:nowrap}'
        + '.kbar-topbar a:hover{background:var(--note-bg,#f7f3e3)}'
        + '.kbar-topbar a:focus-visible{outline:3px solid var(--ink,#1c1c1a);outline-offset:2px}'
        + '.kbar-topbar .tb-cur{flex:1;text-align:center;color:var(--muted,#6e6c64);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.kbar-topbar .tb-side{min-width:3.2rem}'
        + '@media(max-width:560px){.kbar-topbar .tb-cur{font-size:.72rem}.kbar-topbar a{padding:.3rem .4rem}}'
        + '@media print{.kbar-topbar{display:none!important}}';
      document.head.appendChild(st);
      document.body.insertBefore(el, document.body.firstElementChild);
    }

    if (window.KBAR_LESSON_NAV && String(window.KBAR_LESSON_NAV.phase) === phase) { bar(window.KBAR_LESSON_NAV); return; }
    var s = document.createElement('script');
    s.src = '../assets/lesson-nav.js';
    s.onload = function () { bar(window.KBAR_LESSON_NAV); };
    document.head.appendChild(s);
  }

  /* ---- 主题三态（票 062）：auto（prefers-color-scheme）/浅/深 ----
   * 存储 kbar-theme（auto/light/dark，与配色语义键 kbar-palette 相互独立）；
   * auto 不落 data-theme 属性（由 CSS 媒体查询接管），light/dark 落属性；
   * 切换派发 kbar-themechange → candles.js 全图重染；系统深浅变化同样派发。
   * 切换钮与配色钮同族样式（右上角圆钮，print 隐藏；063 顶栏就位后吸收）。 */
  function initTheme() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var KEY = 'kbar-theme';
    var root = document.documentElement;
    function stored() {
      try { var t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'auto'; } catch (e) { return 'auto'; }
    }
    function fire() { try { document.dispatchEvent(new CustomEvent('kbar-themechange')); } catch (e) {} }
    function apply(t, silent) {
      if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
      else root.removeAttribute('data-theme');
      try { localStorage.setItem(KEY, t); } catch (e) {}
      if (!silent) fire();
    }
    apply(stored()); /* 初始也派发事件：手动档与系统态不一致时，先画的图表需要一次重染（恒等则无操作） */
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fire);
    } catch (e) {}
    if (document.getElementById('kbar-theme-toggle')) return;
    function mount() {
      if (document.getElementById('kbar-theme-toggle')) return;
      function sysDark() { try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } }
      var b = document.createElement('button');
      b.id = 'kbar-theme-toggle'; b.type = 'button';
      b.style.cssText = 'position:fixed;top:56px;right:68px;z-index:60;width:44px;height:44px;padding:0;border:1px solid rgba(128,126,116,.4);border-radius:50%;background:var(--card,#fff);color:var(--ink,#1c1c1a);cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.07)';
      function icon() {
        var t = stored();
        var svg = t === 'light'
          ? '<circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><g stroke="currentColor" stroke-width="1.3">' +
            [0, 45, 90, 135, 180, 225, 270, 315].map(function (d) {
              var a = d * Math.PI / 180;
              return '<line x1="' + (10 + 6.8 * Math.cos(a)).toFixed(1) + '" y1="' + (10 + 6.8 * Math.sin(a)).toFixed(1) +
                '" x2="' + (10 + 8.8 * Math.cos(a)).toFixed(1) + '" y2="' + (10 + 8.8 * Math.sin(a)).toFixed(1) + '"/>';
            }).join('') + '</g>'
          : t === 'dark'
          ? '<path d="M12.6 3.2A7.2 7.2 0 1 0 16.8 11.6 5.6 5.6 0 0 1 12.6 3.2z" fill="currentColor"/>'
          : '<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 3.8a6.2 6.2 0 0 0 0 12.4z" fill="currentColor"/>';
        b.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">' + svg + '</svg>';
        var now = t === 'auto' ? ('跟随系统（当前' + (sysDark() ? '深色' : '浅色') + '）') : (t === 'light' ? '浅色' : '深色');
        var next = t === 'auto' ? '浅色' : t === 'light' ? '深色' : '跟随系统';
        var txt = '主题：' + now + '，点击切换为' + next + '；图表同步重绘，红涨绿跌与空心/实心不变。';
        b.title = txt; b.setAttribute('aria-label', txt);
      }
      b.onclick = function () {
        var t = stored();
        apply(t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto');
        icon();
      };
      icon();
      document.body.appendChild(b);
      var st = document.createElement('style');
      st.textContent = '@media print{#kbar-theme-toggle{display:none!important}}';
      document.head.appendChild(st);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
  }

  /* ---- 法务免责（每页注入） ---- */
  function injectDisclaimer() {
    if (document.getElementById('kbar-legal')) return;
    var crypto = /BTC|ETH|SOL|XRP|LINK|DOGE|加密|比特币|以太坊/.test(document.body.textContent);
    var f = document.createElement('footer');
    f.id = 'kbar-legal';
    f.setAttribute('aria-label', '免责声明');
    f.style.cssText = 'max-width:46rem;margin:3rem auto 2rem;padding:.8rem 1rem;border-top:1px solid #d8d4c8;font:12.5px/1.7 var(--sans,sans-serif);color:#8a8578;text-align:left';
    f.innerHTML = '本站为技术分析投资者教育内容，仅记录历史行情与统计口径，<b>不构成投资建议</b>，不提供投资咨询服务；所涉品种与数据仅作教学示例，不代表任何未来表现。'
      + (crypto ? '加密资产价格与监管风险高，相关内容仅为历史行情教学，不构成任何买卖建议。' : '')
      + '学习记录仅存于本地浏览器。';
    document.body.appendChild(f);
  }

  /* ---- 左侧目录（条件启用） ---- */
  function buildToc() {
    if (location.pathname.indexOf('/exam/') >= 0) return;
    if (document.body.hasAttribute('data-no-toc')) return;
    var h2s = [], seen = {};
    var all = document.querySelectorAll('h2[id]');
    for (var i = 0; i < all.length; i++) {
      if (!seen[all[i].id]) { seen[all[i].id] = 1; h2s.push(all[i]); }
    }
    if (h2s.length < 2) return;

    /* 收集每个 h2 到下一个 h2 之间的 h3（无 id 的自动补 id） */
    var tree = [];                       // {h2, subs:[h3]}
    h2s.forEach(function (h) { tree.push({ h2: h, subs: [] }); });
    var cur = -1, subSeq = 0;
    var walk = document.body.querySelectorAll('h2[id], h3');
    for (var j = 0; j < walk.length; j++) {
      var el = walk[j];
      if (el.tagName === 'H2') {
        for (var k = 0; k < h2s.length; k++) if (h2s[k] === el) { cur = k; break; }
      } else if (cur >= 0) {
        if (!el.id) { el.id = 'toc-' + (cur + 1) + '-' + (++subSeq); }
        tree[cur].subs.push(el);
      }
    }

    function titleOf(h) {
      var no = h.querySelector('.no');
      var t = h.textContent;
      if (no) t = t.replace(no.textContent, '');
      return t.replace(/≈\s*\d+\s*min/, '').trim();
    }
    /* 短标签：去（…）注、取"："前段；超 10 字截断 */
    function shortLabel(t) {
      var s = t.replace(/（[^）]*）/g, '').trim();
      var c = s.indexOf('：');
      if (c > 1) s = s.slice(0, c);
      if (s.length > 10) s = s.slice(0, 10);
      return s;
    }

    var flat = [];                       // {el, label, full, lv, no}  文档顺序
    tree.forEach(function (node) {
      var noEl = node.h2.querySelector('.no');
      var full2 = titleOf(node.h2), lab2 = shortLabel(full2);
      flat.push({ el: node.h2, label: lab2, full: full2, lv: 2, no: noEl ? noEl.textContent.trim() : '' });
      node.subs.forEach(function (h3) {
        var full3 = titleOf(h3), lab3 = shortLabel(full3);
        flat.push({ el: h3, label: lab3, full: full3, lv: 3, no: '' });
      });
    });
    /* 同级撞名 → 回退全称 */
    ['2', '3'].forEach(function (lv) {
      var same = flat.filter(function (f) { return String(f.lv) === lv; });
      var cnt = {};
      same.forEach(function (f) { cnt[f.label] = (cnt[f.label] || 0) + 1; });
      same.forEach(function (f) { if (cnt[f.label] > 1) f.label = f.full; });
    });

    var html = [];
    flat.forEach(function (f) {
      html.push('<a class="lv' + f.lv + '" href="#' + f.el.id + '" title="' + f.full + '">'
        + (f.lv === 2 && f.no ? '<span class="lt-no">' + f.no + '</span>' : '')
        + f.label + '</a>');
    });
    var nav = document.createElement('nav');
    nav.className = 'lesson-toc';
    nav.setAttribute('aria-label', '本课导航');
    nav.innerHTML = html.join('');
    document.body.appendChild(nav);

    var links = nav.querySelectorAll('a');
    var ticking = false;
    function setActive() {
      ticking = false;
      var curIdx = -1;
      for (var i = 0; i < flat.length; i++) {
        if (flat[i].el.getBoundingClientRect().top <= 100) curIdx = i;
      }
      for (var j2 = 0; j2 < links.length; j2++) links[j2].classList.remove('on');
      if (curIdx >= 0) {
        links[curIdx].classList.add('on');
        /* 高亮小节时，其父节同步点亮（弱高亮用 CSS 相邻选择器难表达，这里直接加类） */
        for (var m = curIdx; m >= 0; m--) {
          if (flat[m].lv === 2) { links[m].classList.add('on'); break; }
        }
      }
      var on = nav.querySelector('a.on');
      if (on && nav.scrollHeight > nav.clientHeight) {
        var top = on.offsetTop, bottom = top + on.offsetHeight;
        if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
          nav.scrollTop = top - nav.clientHeight / 2 + on.offsetHeight / 2;
        }
      }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(setActive); }
    }, { passive: true });
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth' });
      history.replaceState(null, '', a.getAttribute('href'));
    });
    setActive();
  }

  initTheme();
  injectTopbar();
  injectLessonContext();
  injectDisclaimer();
  buildToc();
})();
