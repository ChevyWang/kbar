/* quiz.js — 即时反馈选择题组件（kbar 训练营共享资产）
 * 用法: Quiz.mount('#selector', {
 *   title: '训练场',
 *   questions: [
 *     { stage: 可选SVG字符串, q: '题干', options: ['A','B','C'], answer: 0, explain: '解析', tag: 可选误解标签 },
 *   ],
 *   verdicts: [[9,'全对'], [7,'不错'], [0,'再练']]  // [最低分, 判词] 降序
 * })
 * 规则: 选项顺序打乱；点击立即判分并给解析；结束给总分与判词、可重练（重开时再洗牌）。
 * 无障碍（批次 D）：解析区 aria-live=polite；答完焦点交"下一题"、换题后焦点落新题第一项、
 *   交卷页焦点落首要动作；按钮触控目标 ≥44px（样式注入）。
 * 学习记录（批次 C）：每次作答写入本地 kbar-quizlog::（课号+题号+对错+时间戳）；
 *   交卷页显示「错题重练」——按 1/3/7/21 天间隔只重练到期错题（答对升档、再错归零）。
 *   记录仅存本浏览器，可随时清空；不含任何个人信息。
 */
(function () {
  'use strict';

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---- 学习记录层（纯本地，失败静默降级） ---- */
  var LADDER = [1, 3, 7, 21]; // 天
  function store(key, val) {
    try {
      if (arguments.length === 2) { localStorage.setItem(key, JSON.stringify(val)); return val; }
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }
  function lessonId() {
    /* 页面可用 data-quiz-id 显式覆写（非课号页面：混练 drill0/1/2、总览等聚合页） */
    var ov = document.body && document.body.getAttribute('data-quiz-id');
    if (ov) return ov;
    var m = location.pathname.match(/(\d{4})-[a-z0-9-]*\.html/i);
    return m ? m[1] : location.pathname.replace(/\/$/, '').split('/').pop();
  }
  function logKey() { return 'kbar-quizlog::' + lessonId(); }
  function sumKey() { return 'kbar-quizsum::' + lessonId(); }
  function getState() { return store(logKey()) || { events: [], boxes: {} }; }
  function recordAnswer(qi, ok, tag) {
    var s = getState();
    s.events.push({ qi: qi, ok: ok, ts: Date.now() });
    if (s.events.length > 500) s.events = s.events.slice(-500);
    var b = s.boxes[qi] = s.boxes[qi] || { box: 0, lastTs: 0, lastOk: null, tag: tag || null };
    b.lastTs = Date.now(); b.lastOk = ok; b.tag = tag || b.tag || null;
    b.box = ok ? Math.min(b.box + 1, LADDER.length) : 0;
    store(logKey(), s);
  }
  function dueQuestions(total) {
    var s = getState(), due = [], now = Date.now();
    for (var qi = 0; qi < total; qi++) {
      var b = s.boxes[qi];
      if (b && b.lastOk === false) {
        var days = (now - b.lastTs) / 86400000;
        var wait = LADDER[Math.min(b.box, LADDER.length - 1)];
        if (days >= wait) due.push(qi);
      }
    }
    return due;
  }
  function recordSession(correct, total) {
    var sum = store(sumKey()) || { runs: 0, best: 0, lastScore: 0, lastTotal: 0, lastTs: 0 };
    sum.runs++; sum.best = Math.max(sum.best, correct);
    sum.lastScore = correct; sum.lastTotal = total; sum.lastTs = Date.now();
    store(sumKey(), sum);
  }
  /* 总览页/外部聚合用 */
  window.KbarQuizLog = {
    lessonId: lessonId,
    state: getState,
    summary: function () { return store(sumKey()); },
    allLessons: function () {
      var out = { logs: {}, sums: {} };
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (!k) continue;
          if (k.indexOf('kbar-quizlog::') === 0) out.logs[k.slice(14)] = JSON.parse(localStorage.getItem(k));
          if (k.indexOf('kbar-quizsum::') === 0) out.sums[k.slice(14)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) {}
      return out;
    },
    clear: function () { try { localStorage.removeItem(logKey()); localStorage.removeItem(sumKey()); } catch (e) {} }
  };

  function mount(sel, cfg) {
    var root = document.querySelector(sel);
    if (!root) return;
    root.classList.add('quiz');
    /* 触控目标 ≥44×44px（WCAG 2.5.5）：quiz.js 可独立于 candles.js 加载，样式自带注入 */
    if (document.head && !document.getElementById('kbar-quiz-style')) {
      var st = document.createElement('style');
      st.id = 'kbar-quiz-style';
      st.textContent = '.quiz button{min-height:44px;min-width:44px}';
      document.head.appendChild(st);
    }
    var order = shuffle(cfg.questions.map(function (_, i) { return i; }));
    var idx = 0, correct = 0, reviewing = !!cfg.review;
    var advanced = false; // 本次重渲染是否由交互触发（首渲染/重挂载不抢页面焦点）

    function render() {
      if (idx >= order.length) return finish();
      var q = cfg.questions[order[idx]];
      var opts = shuffle(q.options.map(function (label, i) { return { label: label, ok: i === q.answer }; }));
      root.innerHTML =
        '<div class="q-meta">' + (cfg.title || '训练') + ' · 第 ' + (idx + 1) + ' / ' + order.length + ' 题' + (reviewing ? '（错题重练）' : '') + '</div>' +
        '<div class="q-text">' + q.q + '</div>' +
        (q.stage ? '<div class="q-stage">' + q.stage + '</div>' : '') +
        '<div class="opts">' + opts.map(function (o, i) {
          return '<button class="opt" data-i="' + i + '">' + o.label + '</button>';
        }).join('') + '</div>' +
        '<div class="explain" aria-live="polite"></div>' +
        '<div class="quiz-foot"><span class="score">已答对 ' + correct + ' / ' + order.length + '</span><button class="next" hidden>下一题 →</button></div>';

      var explain = root.querySelector('.explain');
      var next = root.querySelector('.next');
      root.querySelectorAll('.opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!root.querySelector('.opt:disabled')) {
            recordAnswer(order[idx], opts[+btn.dataset.i].ok, q.tag);
          }
          var pick = opts[+btn.dataset.i];
          root.querySelectorAll('.opt').forEach(function (b) { b.disabled = true; });
          root.querySelectorAll('.opt').forEach(function (b, i) {
            if (opts[i].ok) b.classList.add('correct');
          });
          if (!pick.ok) btn.classList.add('wrong'); else correct++;
          explain.innerHTML = (pick.ok ? '✓ 对了。' : '✗ 不对。') + (q.explain || '');
          explain.classList.add('show');
          root.querySelector('.score').textContent = '已答对 ' + correct + ' / ' + order.length;
          next.hidden = false;
          next.textContent = idx === order.length - 1 ? '看成绩 →' : '下一题 →';
          next.focus(); // 答完即把焦点交给"下一题"：键盘流不必在页面里重新 Tab
        });
      });
      next.addEventListener('click', function () { idx++; advanced = true; render(); });
      if (advanced) { advanced = false; var fo = root.querySelector('.opt'); if (fo) fo.focus(); } // 重渲染后焦点落到新题第一项
    }

    function finish() {
      var v = (cfg.verdicts || []).find(function (x) { return correct >= x[0]; });
      if (!reviewing) recordSession(correct, order.length);
      var due = dueQuestions(cfg.questions.length);
      root.innerHTML =
        '<div class="verdict">' +
        '<div class="big">' + correct + ' / ' + order.length + '</div>' +
        '<p>' + (v ? v[1] : '') + '</p><p>以上是课内检索练习结果，不授予核心能力或实盘资格。里程碑依据另见本阶段能力验收与专门实作。</p>' +
        (due.length && !reviewing
          ? '<button class="next review-start">错题重练（今日到期 ' + due.length + ' 题，答对升档 1→3→7→21 天）</button>'
          : '') +
        '<button class="next">' + (reviewing ? '返回正常练习' : '再练一遍（重排顺序）') + '</button></div>';
      var rs = root.querySelector('.review-start');
      if (rs) rs.addEventListener('click', function () {
        mount(sel, {
          title: (cfg.title || '训练') + ' · 错题重练',
          questions: due.map(function (qi) { return cfg.questions[qi]; }),
          review: true
        });
      });
      root.querySelector('.next:not(.review-start)').addEventListener('click', function () {
        mount(sel, { title: cfg.title, questions: cfg.questions, verdicts: cfg.verdicts });
      });
      if (advanced) { advanced = false; var fb = root.querySelector('.review-start') || root.querySelector('.next'); if (fb) fb.focus(); } // 交卷页焦点落在首要动作
    }

    render();
  }

  window.Quiz = { mount: mount };
})();
