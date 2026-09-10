/* answer.js — K线训练营共享答卷组件（v1，批次二"共享答卷基础"）
 * 契约（context-statistics 工作包 §3.4 / 主计划 §4.2 的最小实现）：
 *   - 草稿可编辑、自动保存、刷新恢复；本地存储不可用时显式提示并依赖导出。
 *   - 提交后原答锁定保留；后续只能新建"修订"（新 attempt），不改写历史。
 *   - 记录键：(taskId, caseId, attemptId)；重复提交不增加分母。
 *   - 导出 JSON（全部 attempt + 元数据）；导入校验 taskId/caseId/字段，按 attemptId 去重合入。
 *   - 无账号、无网络、无评分后端；课程不发送任何数据。
 * 用法：
 *   KbarAnswer.mount('#box', {
 *     taskId:'M0.1-A', caseId:'P0-A-2026a', packId:'p0-pack-1', courseVersion:'2026-09-10',
 *     title:'M0.1 首次验收 · A 窗',
 *     fields:[
 *       {id:'dir',   type:'radio',   label:'最后一根的方向', options:['阳线','阴线','无法判定']},
 *       {id:'note',  type:'text',    label:'你的观察依据（一句话）', placeholder:'只写这根K线能支持的事实'},
 *       {id:'risk',  type:'number',  label:'收盘位置（0–100）'}
 *     ],
 *     onState: function(state){}  // 可选：状态回调（进度组件用）
 *   });
 * 状态 state = { attempts:[{attemptId,submittedAt,answers}], draftSaved:bool, storageOk:bool }
 */
(function () {
  'use strict';
  var SANS = '-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

  function store() {
    try { var t = window.localStorage; t.setItem('__kba__', '1'); t.removeItem('__kba__'); return t; }
    catch (e) { return null; }
  }
  function keyOf(cfg, suffix) { return 'kbar-answer::' + cfg.taskId + '::' + cfg.caseId + '::' + suffix; }
  function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function val(v) { return v == null ? '' : v; }

  function mount(sel, cfg) {
    var root = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!root || !cfg || !cfg.taskId || !cfg.caseId) return;
    var ls = store();
    var fields = cfg.fields || [];
    var state = { attempts: [], draft: {}, storageOk: !!ls };
    function validateAttempts(list) {
      if (!Array.isArray(list)) throw new Error('attempts 必须是数组');
      list.forEach(function(a) { if (!a || typeof a.attemptId !== 'string' || !a.attemptId || typeof a.submittedAt !== 'string' || !a.answers || typeof a.answers !== 'object' || Array.isArray(a.answers)) throw new Error('答卷结构损坏');
        fields.forEach(function(f) { if (a.answers[f.id] !== undefined && typeof a.answers[f.id] !== 'string' && typeof a.answers[f.id] !== 'number') throw new Error('答案字段损坏'); });
      });
    }

    function emit() { if (cfg.onState) try { cfg.onState({ attempts: state.attempts.slice(), draftSaved: !!state.draftSaved, storageOk: state.storageOk }); } catch (e) {} }

    function load() {
      if (!ls) return;
      try { var loaded = JSON.parse(ls.getItem(keyOf(cfg, 'attempts')) || '[]'); validateAttempts(loaded); state.attempts = loaded; } catch (e) { state.attempts = []; }
      try { state.draft = JSON.parse(ls.getItem(keyOf(cfg, 'draft')) || '{}') || {}; } catch (e) { state.draft = {}; }
    }
    function persist() {
      if (!ls) return;
      try {
        ls.setItem(keyOf(cfg, 'attempts'), JSON.stringify(state.attempts));
      } catch (e) { state.storageOk = false; }
    }

    function fieldHtml(f) {
      var v = val(state.draft[f.id]);
      if (f.type === 'radio') {
        return (f.options || []).map(function (o, i) {
          return '<label class="kba-opt"><input type="radio" name="' + esc(f.id) + '" value="' + esc(o) + '"' + (v === o ? ' checked' : '') + '> ' + esc(o) + '</label>';
        }).join('');
      }
      if (f.type === 'select') {
        return '<select data-kba="' + esc(f.id) + '">' + (f.options || []).map(function (o) {
          return '<option value="' + esc(o) + '"' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>';
      }
      if (f.type === 'number') {
        return '<input type="number" data-kba="' + esc(f.id) + '" value="' + esc(v) + '" step="any">';
      }
      var rows = f.rows || (f.type === 'longtext' ? 6 : 2);
      return '<textarea data-kba="' + esc(f.id) + '" rows="' + rows + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(v) + '</textarea>';
    }

    function collect() {
      var ans = {};
      fields.forEach(function (f) {
        if (f.type === 'radio') {
          var el = root.querySelector('input[name="' + f.id + '"]:checked');
          ans[f.id] = el ? el.value : '';
        } else {
          var el2 = root.querySelector('[data-kba="' + f.id + '"]');
          ans[f.id] = el2 ? el2.value : '';
        }
      });
      return ans;
    }

    var saveTimer = null;
    function scheduleDraftSave() {
      state.draft = collect(); state.draftSaved = false;
      if (!ls) { renderStatus(); return; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try { ls.setItem(keyOf(cfg, 'draft'), JSON.stringify(collect())); state.draftSaved = true; }
        catch (e) { state.storageOk = false; }
        renderStatus(); emit();
      }, 400);
    }

    function attemptHtml(a, idx) {
      var rows = fields.map(function (f) {
        return '<div class="kba-row"><span class="kba-l">' + esc(f.label) + '</span><span class="kba-v">' + esc(val(a.answers[f.id]) || '—') + '</span></div>';
      }).join('');
      return '<details class="kba-att"' + (idx === state.attempts.length - 1 ? ' open' : '') + '><summary>第 ' + (idx + 1) + ' 次提交 · ' + esc(a.submittedAt) + (idx === 0 ? '（首次）' : '（修订）') + '</summary>' + rows + '</details>';
    }

    function renderStatus(msg, warn) {
      var el = root.querySelector('.kba-status');
      if (!el) return;
      var t = msg;
      if (!t) t = !state.storageOk ? '本地存储不可用：刷新会丢失草稿——请用"导出"或在外部作答'
        : state.draftSaved ? '草稿已自动保存 ' + new Date().toTimeString().slice(0, 5)
        : '草稿未保存';
      el.textContent = t;
      el.style.color = (warn || !state.storageOk) ? '#b3541e' : '#6e6c64';
    }

    function render() {
      var locked = state.attempts.length > 0;
      var html = '<div class="kba" style="font-family:' + SANS + ';font-size:.92rem;line-height:1.7">';
      html += '<div class="kba-head" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.4rem;align-items:baseline">';
      html += '<b style="font-size:1.02rem">' + esc(cfg.title || cfg.taskId) + '</b>';
      html += '<span style="font-size:.76rem;color:#6e6c64">' + esc(cfg.taskId) + ' · ' + esc(cfg.caseId) + ' · v' + esc(cfg.courseVersion || '?') + '</span></div>';
      html += '<div class="kba-status" style="font-size:.8rem;margin:.35rem 0"></div>';

      state.attempts.forEach(function (a, i) { html += attemptHtml(a, i); });

      html += '<div class="kba-form"><fieldset' + (locked ? ' disabled style="opacity:.55"' : '') + '><legend>' + (locked ? '已提交——如需修改请用下方"开始修订"' : '作答区') + '</legend>';
      fields.forEach(function (f) {
        html += '<div class="kba-f" style="margin:.55rem 0"><div style="font-size:.85rem;font-weight:600">' + esc(f.label) + (f.hint ? ' <span style="font-weight:400;color:#6e6c64">' + esc(f.hint) + '</span>' : '') + '</div>' + fieldHtml(f) + '</div>';
      });
      html += '</fieldset>';
      html += '<div style="display:flex;gap:.6rem;flex-wrap:wrap;margin:.6rem 0">';
      if (!locked) html += '<button type="button" class="kba-submit" style="border:1.5px solid #1c1c1a;border-radius:8px;padding:.45rem 1.1rem;background:#1c1c1a;color:#fff;cursor:pointer">提交（锁定本次作答）</button>';
      else html += '<button type="button" class="kba-revise" style="border:1.5px solid #1c1c1a;border-radius:8px;padding:.45rem 1.1rem;background:#fff;cursor:pointer">开始修订（新建一次作答，不改历史）</button>';
      html += '<button type="button" class="kba-export" style="border:1.5px solid #a3a198;border-radius:8px;padding:.45rem 1rem;background:#fff;cursor:pointer">导出 JSON</button>';
      html += '<label class="kba-import" style="border:1.5px solid #a3a198;border-radius:8px;padding:.45rem 1rem;background:#fff;cursor:pointer">导入 JSON<input type="file" accept="application/json" style="display:none"></label>';
      html += '</div></div>';
      html += '<div class="kba-note" style="font-size:.76rem;color:#6e6c64">提交后原答保留；修订另存新记录。导出文件是可迁移的学习档案；课程不发送任何数据。</div>';
      html += '</div>';
      root.innerHTML = html;

      // 样式（只注入一次）
      if (!document.getElementById('kba-style')) {
        var st = document.createElement('style');
        st.id = 'kba-style';
        st.textContent = '.kba textarea,.kba select,.kba input[type=number]{width:100%;box-sizing:border-box;border:1px solid #d8d5cc;border-radius:8px;padding:.5rem .7rem;font:inherit;background:#fff}.kba .kba-opt{display:inline-block;margin:.15rem .8rem .15rem 0;cursor:pointer}.kba fieldset{border:1px solid #e4e2d9;border-radius:10px;padding:.7rem .9rem}.kba legend{font-size:.8rem;color:#6e6c64;padding:0 .4rem}.kba .kba-att{border:1px dashed #d8d5cc;border-radius:8px;padding:.5rem .8rem;margin:.5rem 0;background:#faf9f6}.kba .kba-att summary{cursor:pointer;font-size:.85rem;color:#1c1c1a}.kba .kba-row{display:flex;gap:.8rem;font-size:.85rem;margin:.2rem 0}.kba .kba-l{min-width:9em;color:#6e6c64}.kba .kba-v{flex:1}';
        document.head.appendChild(st);
      }

      // 事件
      root.querySelectorAll('[data-kba]').forEach(function (el) { el.addEventListener('input', scheduleDraftSave); el.addEventListener('change', scheduleDraftSave); });
      root.querySelectorAll('input[type=radio]').forEach(function (el) { el.addEventListener('change', scheduleDraftSave); });

      var submitBtn = root.querySelector('.kba-submit');
      if (submitBtn) submitBtn.onclick = function () {
        var ans = collect();
        var missing = fields.filter(function (f) { return f.required && !ans[f.id]; });
        if (missing.length) { renderStatus('还有必填项未完成：' + missing.map(function (f) { return f.label; }).join('、'), true); return; }
        state.attempts.push({ attemptId: uid(), submittedAt: new Date().toLocaleString(), answers: ans });
        clearTimeout(saveTimer); state.draft = {}; state.draftSaved = false; persist();
        if (ls) { try { ls.removeItem(keyOf(cfg, 'draft')); } catch (e) {} }
        render(); emit();
      };
      var reviseBtn = root.querySelector('.kba-revise');
      if (reviseBtn) reviseBtn.onclick = function () {
        var el = root.querySelector('.kba-form fieldset');
        if (el) { el.disabled = false; el.style.opacity = '1'; var leg = el.querySelector('legend'); if (leg) leg.textContent = '修订作答区（新的一次提交）'; }
        reviseBtn.textContent = '提交修订（锁定）';
        reviseBtn.className = 'kba-submit2';
        reviseBtn.onclick = function () {
          var ans = collect();
          state.attempts.push({ attemptId: uid(), submittedAt: new Date().toLocaleString(), answers: ans });
          clearTimeout(saveTimer); state.draft = {}; state.draftSaved = false; persist();
          if (ls) { try { ls.removeItem(keyOf(cfg, 'draft')); } catch (e) {} }
          render(); emit();
        };
      };
      var exportBtn = root.querySelector('.kba-export');
      if (exportBtn) exportBtn.onclick = function () {
        var payload = {
          kind: 'kbar-answer-export', version: 1,
          taskId: cfg.taskId, caseId: cfg.caseId, packId: cfg.packId || '', courseVersion: cfg.courseVersion || '',
          exportedAt: new Date().toISOString(), attempts: state.attempts, draft: collect()
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'answer-' + cfg.taskId + '-' + cfg.caseId + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      };
      var importInput = root.querySelector('.kba-import input');
      if (importInput) importInput.onchange = function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        var fr = new FileReader();
        fr.onload = function () {
          var data, added = 0, skipped = 0, err = null;
          try { data = JSON.parse(fr.result); } catch (e) { err = '文件不是合法 JSON'; }
          if (!err && (!data || data.kind !== 'kbar-answer-export')) err = '不是本课程的答卷导出文件';
          if (!err && (data.taskId !== cfg.taskId || data.caseId !== cfg.caseId)) err = '任务/案例不匹配：' + data.taskId + '/' + data.caseId;
          if (!err && (data.version !== 1 || data.courseVersion !== (cfg.courseVersion || '') || data.packId !== (cfg.packId || ''))) err = '档案版本或题包不匹配；请保留原文件，旧成绩不可自动映射';
          if (!err) try {
            validateAttempts(data.attempts);
            if (data.draft !== undefined && (!data.draft || typeof data.draft !== 'object' || Array.isArray(data.draft))) throw new Error('草稿结构损坏');
            var next = state.attempts.slice(), have = {};
            next.forEach(function (a) { have[a.attemptId] = a; });
            data.attempts.forEach(function (a) {
              if (have[a.attemptId]) { if (JSON.stringify(have[a.attemptId]) !== JSON.stringify(a)) throw new Error('同一答卷ID冲突，未覆盖'); skipped++; }
              else { next.push(a); have[a.attemptId] = a; added++; }
            });
            state.attempts = next;
            if (data.draft && !Object.keys(state.draft).length) state.draft = data.draft;
            persist();
            if (ls) try { ls.setItem(keyOf(cfg, 'draft'), JSON.stringify(state.draft)); } catch (e) { state.storageOk = false; }
            render(); emit();
          } catch (e) { err = e.message; }
          renderStatus(err ? ('导入失败：' + err) : ('导入完成：新增 ' + added + ' 条，跳过重复 ' + skipped + ' 条'), !!err);
        };
        fr.readAsText(file);
        importInput.value = '';
      };

      renderStatus();
      emit();
    }

    load();
    render();
  }

  window.KbarAnswer = { mount: mount, version: 1 };
})();
