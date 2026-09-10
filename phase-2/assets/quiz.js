/* quiz.js — 即时反馈选择题组件（kbar 训练营共享资产）
 * 用法: Quiz.mount('#selector', {
 *   title: '训练场',
 *   questions: [
 *     { stage: 可选SVG字符串, q: '题干', options: ['A','B','C'], answer: 0, explain: '解析' },
 *   ],
 *   verdicts: [[9,'全对'], [7,'不错'], [0,'再练']]  // [最低分, 判词] 降序
 * })
 * 规则: 选项顺序打乱；点击立即判分并给解析；结束给总分与判词、可重练（重开时再洗牌）。
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

  function mount(sel, cfg) {
    var root = document.querySelector(sel);
    if (!root) return;
    root.classList.add('quiz');
    var order = shuffle(cfg.questions.map(function (_, i) { return i; }));
    var idx = 0, correct = 0;

    function render() {
      if (idx >= order.length) return finish();
      var q = cfg.questions[order[idx]];
      var opts = shuffle(q.options.map(function (label, i) { return { label: label, ok: i === q.answer }; }));
      root.innerHTML =
        '<div class="q-meta">' + (cfg.title || '训练') + ' · 第 ' + (idx + 1) + ' / ' + order.length + ' 题</div>' +
        '<div class="q-text">' + q.q + '</div>' +
        (q.stage ? '<div class="q-stage">' + q.stage + '</div>' : '') +
        '<div class="opts">' + opts.map(function (o, i) {
          return '<button class="opt" data-i="' + i + '">' + o.label + '</button>';
        }).join('') + '</div>' +
        '<div class="explain"></div>' +
        '<div class="quiz-foot"><span class="score">已答对 ' + correct + ' / ' + order.length + '</span><button class="next" hidden>下一题 →</button></div>';

      var explain = root.querySelector('.explain');
      var next = root.querySelector('.next');
      root.querySelectorAll('.opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
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
        });
      });
      next.addEventListener('click', function () { idx++; render(); });
    }

    function finish() {
      var v = (cfg.verdicts || []).find(function (x) { return correct >= x[0]; });
      root.innerHTML =
        '<div class="verdict">' +
        '<div class="big">' + correct + ' / ' + order.length + '</div>' +
        '<p>' + (v ? v[1] : '') + '</p><p>以上是课内检索练习结果，不授予核心能力或实盘资格。里程碑依据另见本阶段能力验收与专门实作。</p>' +
        '<button class="next">再练一遍（重排顺序）</button></div>';
      root.querySelector('.next').addEventListener('click', function () {
        order = shuffle(order); idx = 0; correct = 0; render();
      });
    }

    render();
  }

  window.Quiz = { mount: mount };
})();
