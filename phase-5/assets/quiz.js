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
 *   交卷页显示「错题重练」——按 1/3/7/21 天间隔复习到期题（含已纠正题）（答对升档、再错归零）。
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
  function getState() { return store(logKey()) || { schema: 2, events: [], boxes: {}, archives: [] }; }
  // Fingerprint source templates, never randomized question text or chart instances.
  function templateVersion() {
    var text = Array.from(document.scripts).filter(function (s) { return !s.src; }).map(function (s) { return s.textContent; }).join('\n');
    return 'template-' + fingerprint(text);
  }
  function fingerprint(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16);
  }
  function prepare(version) {
    var s = getState();
    if (s.schema !== 2 || (s.version && s.version !== version)) {
      var archives = (s.archives || []).slice();
      archives.push({ version: s.version || 'legacy-unmapped', events: s.events || [], boxes: s.boxes || {}, archivedAt: Date.now() });
      s = { schema: 2, events: [], boxes: {}, archives: archives };
    }
    s.version = version;
    store(logKey(), s);
  }
  function isDue(b, now) {
    return !!b && Number.isFinite(b.lastTs) && (now === undefined ? Date.now() : now) - b.lastTs >= LADDER[Math.min(Math.max(b.box || 0, 0), LADDER.length - 1)] * 86400000;
  }
  function dueCount(s) {
    return s && s.schema === 2 && s.boxes ? Object.keys(s.boxes).filter(function (key) { return isDue(s.boxes[key]); }).length : 0;
  }
  function recordAnswer(qi, ok, tag, question, choice) {
    var s = getState();
    var variant = fingerprint(JSON.stringify(question));
    s.events.push({ qi: qi, variant: variant, choice: choice, ok: ok, ts: Date.now() });
    if (s.events.length > 500) s.events = s.events.slice(-500);
    var b = s.boxes[qi] = s.boxes[qi] || { box: 0, lastTs: 0, lastOk: null, tag: tag || null };
    if (!b.first) b.first = { ok: ok, choice: choice, question: question, variant: variant, ts: Date.now() };
    b.question = question; b.variant = variant;
    b.lastTs = Date.now(); b.lastOk = ok; b.tag = tag || b.tag || null;
    b.box = ok ? Math.min(b.box + 1, LADDER.length) : 0;
    store(logKey(), s);
  }
  function dueQuestions(questions) {
    var s = getState();
    return questions.map(function (_, i) { return i; }).filter(function (i) {
      return isDue(s.boxes[questionId(questions[i], i)]);
    });
  }
  function questionId(q, i) { return q.id === undefined ? String(i) : String(q.id); }
  function recordSession(correct, total) {
    var sum = store(sumKey()) || { runs: 0, best: 0, lastScore: 0, lastTotal: 0, lastTs: 0 };
    sum.runs++; sum.best = Math.max(sum.best, correct);
    sum.lastScore = correct; sum.lastTotal = total; sum.lastTs = Date.now();
    store(sumKey(), sum);
  }
  function exportArchive() {
    var records = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (/^kbar-quiz(log|sum)::/.test(key)) records[key] = localStorage.getItem(key);
    }
    return { kind: 'kbar-quiz-archive', version: 1, records: records };
  }
  function restoreArchive(data) {
    function plain(v) { return v && typeof v === 'object' && !Array.isArray(v); }
    function tree(v, depth) {
      if (depth > 40) throw Error('档案嵌套过深');
      if (v && typeof v === 'object') Object.keys(v).forEach(function (k) {
        if (['__proto__','constructor','prototype'].includes(k)) throw Error('不安全字段');
        tree(v[k], depth + 1);
      });
    }
    function log(v) {
      if (!plain(v) || !Array.isArray(v.events) || !plain(v.boxes)) throw Error('训练记录损坏');
      if (v.schema !== undefined && v.schema !== 2) throw Error('不支持的记录版本');
      if (v.schema === 2 && (typeof v.version !== 'string' || !Array.isArray(v.archives))) throw Error('记录版本或历史档案损坏');
      Object.values(v.boxes).forEach(function (b) {
        if (!plain(b) || !Number.isInteger(b.box) || b.box < 0 || b.box > 4 || !Number.isFinite(b.lastTs) || typeof b.lastOk !== 'boolean') throw Error('复习记录损坏');
        if (b.question && (!plain(b.question) || typeof b.question.q !== 'string' || !Array.isArray(b.question.options) || b.question.options.some(function (o) { return typeof o !== 'string'; }) || !Number.isInteger(b.question.answer) || b.question.answer < 0 || b.question.answer >= b.question.options.length)) throw Error('题面记录损坏');
      });
      if (v.archives) v.archives.forEach(log);
    }
    tree(data, 0);
    if (!plain(data) || data.kind !== 'kbar-quiz-archive' || data.version !== 1 || !plain(data.records)) throw Error('不支持的训练场档案');
    var entries = Object.entries(data.records), pending = [];
    entries.forEach(function (entry) {
      var key = entry[0], raw = entry[1];
      if (!/^kbar-quiz(log|sum)::[A-Za-z0-9_.-]+$/.test(key) || typeof raw !== 'string') throw Error('非课程记录键');
      var value = JSON.parse(raw); tree(value, 0);
      if (key.startsWith('kbar-quizlog::')) log(value);
      else if (!plain(value) || !['runs','best','lastScore','lastTotal','lastTs'].every(function (k) { return Number.isFinite(value[k]) && value[k] >= 0; })) throw Error('总分记录损坏');
      var previous = localStorage.getItem(key);
      if (previous !== null && previous !== raw) throw Error('记录冲突：原答未覆盖，请保留两份备份，在空白浏览器档案中恢复另一份');
      if (previous === null) pending.push(entry);
    });
    var written = [];
    try { pending.forEach(function (entry) { localStorage.setItem(entry[0], entry[1]); written.push(entry[0]); }); }
    catch (e) { written.forEach(function (key) { localStorage.removeItem(key); }); throw Error('存储空间或权限不足，恢复已撤销'); }
    return pending.length;
  }
  // Imported snapshots remain data: permit formatting and static SVG only.
  function snapshotHTML(value) {
    var fragment = document.createElement('template');
    fragment.innerHTML = String(value || '');
    var allowed = /^(b|strong|i|em|br|p|div|span|ul|ol|li|table|thead|tbody|tr|td|th|caption|code|pre|sup|sub|small|svg|g|defs|clippath|lineargradient|radialgradient|stop|rect|line|path|polyline|polygon|circle|ellipse|text|tspan|title|desc)$/i;
    fragment.content.querySelectorAll('*').forEach(function (el) {
      if (!allowed.test(el.tagName)) { el.remove(); return; }
      Array.from(el.attributes).forEach(function (attr) {
        if (/^on|href|src|style/i.test(attr.name) || /url\s*\(\s*[^#]/i.test(attr.value)) el.removeAttribute(attr.name);
      });
    });
    return fragment.innerHTML;
  }

  function mountBackup(target) {
    var root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return;
    var section = document.createElement('details');
    section.className = 'quiz-backup';
    section.innerHTML = '<summary>备份训练场记录</summary><p>只包含本来源训练场的作答、复习与历史，训练场之外的学习记录不在内。全部学习记录的完整备份与恢复，在<a href="https://chevywang.github.io/kbar/progress.html#backup">学习进度总览</a>页一次完成。</p><button id="quiz-export" type="button">导出训练场记录</button><label>恢复训练场记录 <input id="quiz-import" type="file" accept="application/json"></label><p id="quiz-backup-status" role="status">冲突时整份停止，原答不覆盖；请保留两份备份文件。</p>';
    root.appendChild(section);
    section.querySelectorAll('button,input,summary').forEach(function (el) { el.style.minHeight='44px'; });
    section.querySelector('summary').style.cursor='pointer';
    var status=section.querySelector('[role=status]');
    section.querySelector('button').onclick=function () {
      try {
        var url=URL.createObjectURL(new Blob([JSON.stringify(exportArchive(),null,2)],{type:'application/json'}));
        var link=document.createElement('a');link.href=url;link.download='kbar-quiz-archive.json';link.click();
        setTimeout(function () {URL.revokeObjectURL(url);},1000);
        status.textContent='备份已生成，请确认文件已保存。';
      } catch(e) {status.textContent='导出失败：'+e.message;}
    };
    section.querySelector('input').onchange=async function (event) {
      var file=event.target.files[0];if(!file)return;
      try {
        var count=restoreArchive(JSON.parse(await file.text()));
        status.textContent='已恢复 '+count+' 项记录；刷新页面后继续练习。';
      } catch(e) {status.textContent='恢复失败：'+e.message+'；原记录未覆盖。';}
      event.target.value='';
    };
  }

  /* 总览页/外部聚合用 */
  window.KbarQuizLog = {
    lessonId: lessonId,
    exportArchive: exportArchive,
    restoreArchive: restoreArchive,
    state: getState,
    isDue: isDue,
    dueCount: dueCount,
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
    prepare(String(cfg.version || templateVersion()));
    var order = shuffle(cfg.reviewIndices || cfg.roundIndices || cfg.questions.map(function (_, i) { return i; }));
    var idx = 0, correct = 0, reviewing = !!cfg.review;
    var advanced = false; // 本次重渲染是否由交互触发（首渲染/重挂载不抢页面焦点）

    function render() {
      if (idx >= order.length) return finish();
      var q = cfg.questions[order[idx]];
      var saved = getState().boxes[questionId(q, order[idx])];
      if (reviewing && saved && saved.question) {
        q = Object.assign({}, saved.question);
        ['q','stage','explain'].forEach(function (key) { q[key] = snapshotHTML(q[key]); });
        q.options = q.options.map(snapshotHTML);
      }
      var opts = shuffle(q.options.map(function (label, i) { return { label: label, ok: i === q.answer }; }));
      root.innerHTML =
        ((getState().archives || []).length ? '<p class="quiz-archive">历史归档已保留；题库版本或题号无法可靠映射，请重新作答补证。</p>' : '') +
        (!reviewing && idx === 0 && dueQuestions(cfg.questions).length ? '<button class="review-due">到期复习（含已纠正题）</button>' : '') +
        '<div class="q-meta">' + (cfg.title || '训练') + ' · 第 ' + (idx + 1) + ' / ' + order.length + ' 题' + (reviewing ? '（错题重练）' : '') + '</div>' +
        '<div class="q-text">' + q.q + '</div>' +
        (q.stage ? '<div class="q-stage">' + q.stage + '</div>' : '') +
        '<div class="opts">' + opts.map(function (o, i) {
          return '<button class="opt" data-i="' + i + '">' + o.label + '</button>';
        }).join('') + '</div>' +
        '<div class="explain" aria-live="polite"></div>' +
        '<div class="quiz-foot"><span class="score">已答对 ' + correct + ' / ' + order.length + '</span><button class="next" hidden>下一题 →</button></div>';

      mountBackup(root);
      var reviewDue = root.querySelector('.review-due');
      if (reviewDue) reviewDue.onclick = function () { mount(sel, Object.assign({}, cfg, { reviewIndices: dueQuestions(cfg.questions), review: true, focus: true })); };
      var explain = root.querySelector('.explain');
      var next = root.querySelector('.next');
      root.querySelectorAll('.opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!root.querySelector('.opt:disabled')) {
            recordAnswer(questionId(q, order[idx]), opts[+btn.dataset.i].ok, q.tag, q, opts[+btn.dataset.i].label);
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
      var due = dueQuestions(cfg.questions);
      root.innerHTML =
        '<div class="verdict">' +
        '<div class="big">' + correct + ' / ' + order.length + '</div>' +
        '<p>' + (v ? v[1] : '') + '</p><p>以上是课内检索练习结果，不授予核心能力或实盘资格。里程碑依据另见本阶段实操与专题任务。</p>' +
        (due.length && !reviewing
          ? '<button class="next review-start">错题重练（今日到期 ' + due.length + ' 题，答对升档 1→3→7→21 天）</button>'
          : '') +
        '<button class="next">' + (reviewing ? '返回正常练习' : '再练一遍（重排顺序）') + '</button></div>';
      mountBackup(root);
      var rs = root.querySelector('.review-start');
      if (rs) rs.addEventListener('click', function () {
        mount(sel, Object.assign({}, cfg, { reviewIndices: due, review: true, focus: true }));
      });
      root.querySelector('.next:not(.review-start)').addEventListener('click', function () {
        mount(sel, Object.assign({}, cfg, { reviewIndices: null, review: false, focus: true }));
      });
      if (advanced) { advanced = false; var fb = root.querySelector('.review-start') || root.querySelector('.next'); if (fb) fb.focus(); } // 交卷页焦点落在首要动作
    }

    render();
    if (cfg.focus) { var focus = root.querySelector('.opt') || root.querySelector('.next'); if (focus) focus.focus(); }
  }

  window.Kbar = window.Kbar || {};
  window.Kbar.quizBackup = mountBackup;
  window.Quiz = { mount: mount };
})();
