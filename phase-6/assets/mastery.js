/* Mastery v1: frozen tasks, per-criterion grading and portable private records.
 * No requests, credentials, eval or AI grading. Same API under file:// and HTTP. */
(function (global) {
  'use strict';
  const VERSION = 1;
  const clone = value => JSON.parse(JSON.stringify(value));
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new Error(message); };
  const now = () => new Date().toISOString();
  const uid = () => 'a-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const stringify = value => JSON.stringify(value);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(value, field) {
    if (field.type === 'number') return String(value).trim() === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
    if (field.type === 'set') {
      const items = Array.isArray(value) ? value : String(value || '').split(/[，,、\s]+/).filter(Boolean);
      if (!items.length || items.some(v => String(v).trim() === '' || !Number.isFinite(Number(v)))) return null;
      return [...new Set(items.map(Number))].sort((a,b) => a-b);
    }
    return String(value == null ? '' : value).trim();
  }
  function matches(value, expected, field) {
    const a = normalize(value, field), b = normalize(expected, field);
    if (a === null || b === null) return false;
    if (field.type === 'number') return Math.abs(a-b) <= (field.tolerance || 0) + 1e-9;
    return stringify(a) === stringify(b);
  }
  function grade(task, answers, unknown) {
    if (unknown) return {status:'unresolved', checks:[], passed:false};
    const checks = task.fields.map(f => ({id:f.id, category:f.category,
      passed:[f.answer].concat(f.alternatives || []).some(a => matches(answers[f.id], a, f)),
      explain:f.explain, remedy:f.remedy}));
    return {status:checks.every(c => c.passed) ? 'passed':'remedy', passed:checks.every(c => c.passed), checks};
  }
  function validateTask(task) {
    if (!plain(task) || typeof task.id !== 'string' || !task.id || typeof task.scenario !== 'string' || !plain(task.source)) fail('任务缺少标识、题面或来源');
    ['kind','citation','instrument','timeframe','session','priceBasis','volumeBasis','cutoff','overlapGroup'].forEach(k => { if (typeof task.source[k] !== 'string' || !task.source[k]) fail('案例来源字段缺失：' + k); });
    if (!Array.isArray(task.fields) || task.fields.length < 3) fail('每个任务至少需要三个核心检查');
    const ids = new Set();
    task.fields.forEach(f => {
      if (!plain(f) || typeof f.id !== 'string' || ids.has(f.id) || !['number','select','set'].includes(f.type)) fail('字段类型或标识错误');
      ids.add(f.id);
      if (typeof f.label !== 'string' || !f.explain || !f.remedy || !f.category) fail('字段缺少反馈与补练');
      if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length < 2 || !f.options.includes(f.answer))) fail('选择题答案不在选项中');
      if (f.type === 'number' && (!Number.isFinite(f.answer) || (f.tolerance !== undefined && (!Number.isFinite(f.tolerance) || f.tolerance < 0)))) fail('数值答案非法');
      if (f.type === 'set' && (!Array.isArray(f.answer) || normalize(f.answer,f) === null)) fail('证据集合非法');
      if (f.alternatives !== undefined && !Array.isArray(f.alternatives)) fail('替代答案必须是数组');
    });
    if (task.bars && task.bars.length) {
      if (!Array.isArray(task.bars) || !task.bars.length) fail('行情为空');
      task.bars.forEach(b => { if (!['o','h','l','c'].every(k => Number.isFinite(b[k])) || b.l > Math.min(b.o,b.c) || b.h < Math.max(b.o,b.c)) fail('OHLC非法'); });
    }
    return true;
  }
  function validateCatalog(catalog) {
    if (!Array.isArray(catalog)) fail('任务目录必须是数组');
    const mids = new Set(), tids = new Set(), groups = new Set();
    catalog.forEach(m => {
      if (!plain(m) || !/^M[0-5]\.[1-4]$/.test(m.id) || mids.has(m.id) || !m.title || !m.objective || !m.prerequisites || !Array.isArray(m.rubric) || !m.rubric.length || !plain(m.example)) fail('教学卡缺少必需项或ID重复');
      mids.add(m.id);
      ['prompt','answer','counterexample','failure','unknown'].forEach(k => { if (!m.example[k]) fail('教学示范缺少 ' + k); });
      if (!Array.isArray(m.tasks) || m.tasks.length < 5) fail(m.id + ' 任务池不足五包');
      m.tasks.forEach(t => { validateTask(t); if (tids.has(t.id) || groups.has(t.source.overlapGroup)) fail('任务标识或曝光组重复：'+t.id); tids.add(t.id); groups.add(t.source.overlapGroup); });
    });
    return true;
  }
  function emptyArchive(courseVersion) {
    return {kind:'kbar-mastery-archive',version:VERSION,courseVersion,attempts:[],drafts:{},exposure:{},feedback:[],legacy:[]};
  }
  function safeTree(value,depth=0) {
    if(depth>40)fail('档案嵌套过深');
    if(value&&typeof value==='object') Object.entries(value).forEach(([k,v])=>{if(['__proto__','constructor','prototype'].includes(k))fail('不支持的档案字段');safeTree(v,depth+1);});
  }
  function validateArchive(data) {
    safeTree(data);

    if (!plain(data) || data.kind !== 'kbar-mastery-archive' || data.version !== VERSION || typeof data.courseVersion !== 'string') fail('不支持的档案结构或版本；请保留原文件');
    if (!Array.isArray(data.attempts) || !plain(data.drafts) || !plain(data.exposure) || !Array.isArray(data.feedback) || !Array.isArray(data.legacy)) fail('档案字段损坏，未覆盖当前记录');
    const ids = new Set();
    data.attempts.forEach(a => {
      if (!plain(a) || typeof a.id !== 'string' || !a.id || ids.has(a.id) || typeof a.milestone !== 'string' || typeof a.task !== 'string' || typeof a.taskFingerprint !== 'string' || typeof a.submittedAt !== 'string' || !Number.isFinite(Date.parse(a.submittedAt)) || !plain(a.answers) || Object.values(a.answers).some(v => !['string','number'].includes(typeof v) && !Array.isArray(v)) || typeof a.independent !== 'boolean' || typeof a.hinted !== 'boolean' || typeof a.unknown !== 'boolean' || typeof a.revealed !== 'boolean' || typeof a.report !== 'string' || !Array.isArray(a.selfAssessment) || a.selfAssessment.some(v => !['未成立','待补证','已自评'].includes(v))) fail('答卷损坏或重复ID，未覆盖当前记录');
      ids.add(a.id);
    });
    Object.values(data.drafts).forEach(d => { if (!plain(d) || !plain(d.answers) || typeof d.report !== 'string' || typeof d.hinted !== 'boolean') fail('草稿损坏'); });
    Object.values(data.exposure).forEach(e => { if (!plain(e) || typeof e.firstSeen !== 'string' || !Number.isFinite(Date.parse(e.firstSeen))) fail('曝光记录损坏'); });
    data.feedback.forEach(f => { if (!plain(f) || typeof f.text !== 'string' || typeof f.source !== 'string' || typeof f.at !== 'string') fail('反馈记录损坏'); });
    return true;
  }
  // Stable content identity, not a security signature. Different data/rubrics require new evidence.
  function fingerprint(value) {
    let h = 2166136261;
    for (const ch of stringify(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h,16777619); }
    return (h >>> 0).toString(16);
  }
  function mergeArchive(current, incoming) {
    validateArchive(current); validateArchive(incoming);
    const result = clone(current), byId = new Map(result.attempts.map(a => [a.id,a]));
    incoming.attempts.forEach(a => {
      if (byId.has(a.id) && stringify(byId.get(a.id)) !== stringify(a)) fail('同一答卷ID内容冲突，未导入：' + a.id);
      if (!byId.has(a.id)) { result.attempts.push(clone(a)); byId.set(a.id,a); }
    });
    result.attempts.sort((a,b) => a.submittedAt.localeCompare(b.submittedAt));
    Object.entries(incoming.exposure).forEach(([k,v]) => { if (!result.exposure[k] || v.firstSeen < result.exposure[k].firstSeen) result.exposure[k] = clone(v); });
    // Preserve both incompatible versions and both drafts rather than overwrite work.
    Object.entries(incoming.drafts).forEach(([k,v]) => {
      if (!result.drafts[k]) result.drafts[k] = clone(v);
      else if (stringify(result.drafts[k]) !== stringify(v)) result.legacy.push({kind:'imported-draft',task:k,data:clone(v)});
    });
    incoming.feedback.forEach(f => { if (!result.feedback.some(x => stringify(x) === stringify(f))) result.feedback.push(clone(f)); });
    if (incoming.courseVersion !== current.courseVersion) result.legacy.push({kind:'previous-version',courseVersion:incoming.courseVersion,importedAt:now()});
    incoming.legacy.forEach(v => { if (!result.legacy.some(x => stringify(x) === stringify(v))) result.legacy.push(clone(v)); });
    return result;
  }
  function mergeForSave(local, remote, baseline) {
    const left=clone(local),right=clone(remote);left.drafts={};right.drafts={};
    const merged=mergeArchive(right,left);merged.drafts=clone(remote.drafts);
    Object.entries(local.drafts).forEach(([k,v])=>{
      if(stringify(v)!==stringify(baseline[k])) {
        if(remote.drafts[k] && stringify(remote.drafts[k])!==stringify(baseline[k]) && stringify(remote.drafts[k])!==stringify(v)) merged.legacy.push({kind:'concurrent-draft',task:k,data:clone(remote.drafts[k])});
        merged.drafts[k]=clone(v);
      }
    });
    Object.keys(baseline).forEach(k=>{if(!(k in local.drafts))delete merged.drafts[k];});
    return merged;
  }
  function evidence(milestone, archive) {
    const tasks = new Map(milestone.tasks.map(t => [t.id,t]));
    const valid = archive.attempts.filter(a => {
      const task = tasks.get(a.task);
      return a.milestone === milestone.id && task && a.taskFingerprint === fingerprint(task) && a.independent && !a.hinted && !a.unknown && grade(task,a.answers,false).passed;
    });
    const firstByTask = new Map();
    valid.slice().sort((a,b)=>a.submittedAt.localeCompare(b.submittedAt)).forEach(a=>{if(!firstByTask.has(a.task))firstByTask.set(a.task,a);});
    const distinct = [...firstByTask.values()];
    const dates = distinct.map(a => Date.parse(a.submittedAt)).sort((a,b) => a-b);
    return {core:distinct.length > 0, retest:distinct.length > 1, delayed:dates.length > 1 && dates[dates.length-1]-dates[0] >= 86400000,
      tasks:distinct.map(a => a.task), selfAssessed:archive.attempts.some(a => a.milestone === milestone.id && a.report.trim() && a.selfAssessment.length === milestone.rubric.length && a.selfAssessment.every(v => v === '已自评')),
      needsRecheck:archive.attempts.filter(a => a.milestone === milestone.id && (!tasks.has(a.task) || a.taskFingerprint !== fingerprint(tasks.get(a.task)))).length,
      weakness:(()=>{ const cnt={}; archive.attempts.filter(a => a.milestone === milestone.id && tasks.has(a.task) && a.taskFingerprint === fingerprint(tasks.get(a.task))).forEach(a => { const g=grade(tasks.get(a.task),a.answers,false); g.checks.forEach(c => { if(!c.passed){ const k=c.category || c.id; cnt[k]=(cnt[k]||0)+1; } }); }); return Object.entries(cnt).sort((x,y)=>y[1]-x[1]).map(([category,count])=>({category,count})); })()};
  }
  function coachPack(milestone, task, draft, checks) {
    return {kind:'kbar-coach',version:1,goal:milestone.objective,task:task.id,known:{scenario:task.scenario,source:clone(task.source),bars:clone(task.bars || [])},
      questions:task.fields.map(f => ({id:f.id,label:f.label,type:f.type,options:f.options || []})),
      learner:clone(draft),rubric:clone(milestone.rubric),checks:checks ? checks.checks.map(c => ({id:c.id,passed:c.passed})) : [],
      instruction:'引用当前已知证据，区分事实、假设与未知；考虑另一种合理解释，不按后续盈亏改判过程。不替学习者写首次答卷；追问一项证据并给一项补练。不得更改日期、原答或本地通过状态。'};
  }
  function mount(root, catalog, courseVersion) {
    validateCatalog(catalog);
    root = typeof root === 'string' ? document.querySelector(root) : root;
    const KEY = 'kbar-mastery::v1', memory = emptyArchive(courseVersion);
    let baselineDrafts = {}, archive = memory, storage = null, storageOk = false, dirty = false, lastSave = '', message = '', milestone, task, ready = false;
    let pendingFocus = null; // 批次 D：全量 innerHTML 交换后把焦点还给触发动作对应的按钮（键盘流不回文档头）
    function applyPendingFocus() {
      if (!pendingFocus) return;
      const sel = pendingFocus; pendingFocus = null;
      try { const el = root.querySelector(sel); if (el && !el.disabled && typeof el.focus === 'function') el.focus(); } catch (e) {}
    }
    try { storage = global.localStorage; storage.setItem('__mastery_probe__','1'); storage.removeItem('__mastery_probe__'); storageOk = true;
      const raw = storage.getItem(KEY); if (raw) { const parsed = JSON.parse(raw); validateArchive(parsed); archive = mergeArchive(memory,parsed); }
    } catch(e) { message = '存储不可用或已有档案损坏：'+e.message+'。当前记录保留在本页内存，请导出。'; storageOk = false; }
    baselineDrafts=clone(archive.drafts);
    function save() {
      dirty = true;
      if (storage && storageOk) try { const latest=storage.getItem(KEY);if(latest){const other=JSON.parse(latest);validateArchive(other);archive=mergeForSave(archive,other,baselineDrafts);}storage.setItem(KEY,stringify(archive)); dirty = false; lastSave = now(); baselineDrafts=clone(archive.drafts); } catch(e) { storageOk = false; message = '自动保存失败（空间不足或权限限制），请立即导出；当前答卷仍在本页。'; }
      status();
    }
    function status() { const el = root.querySelector('#mastery-status'); if (el) el.textContent = message || (storageOk ? '' : '本浏览器无法自动保存：作答只保留在本页，关闭前请点下方「导出当前记录」。'); }
    /* 042：备份与恢复只在总览页；本页常态无任何数据操作，存储故障时提供唯一应急导出 */
    function emergency() { return storageOk ? '' : '<section class="mastery-warning" id="mastery-emergency"><b>本浏览器存储不可用：</b>作答只保留在本页，关闭前请先导出。<button id="mastery-export" class="kbtn dark">导出当前记录</button></section>'; }
    function bindEmergency() { const b = root.querySelector('#mastery-export'); if (b) b.onclick = () => { if (ready) collect(); download('kbar-mastery-archive.json', JSON.stringify(archive, null, 2)); dirty = false; message = '记录文件已生成下载，请确认已保存。'; status(); }; }
    function download(name,data,type) { const url = URL.createObjectURL(new Blob([data],{type:type || 'application/json'})); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
    function currentDraft() { return archive.drafts[task.id] || {answers:{},report:'',hinted:false,selfAssessment:[]}; }
    function collect() {
      const draft = currentDraft();
      root.querySelectorAll('[data-field]').forEach(el => { draft.answers[el.dataset.field] = el.value; });
      const report = root.querySelector('#mastery-report'); if(report) draft.report=report.value;
      draft.selfAssessment = [...root.querySelectorAll('[data-rubric]')].map(el => el.value);
      archive.drafts[task.id]=draft;
      return draft;
    }
    function history() {
      const list = archive.attempts.filter(a => a.milestone === milestone.id);
      if (!list.length) return '<p class="ms-note">还没有提交记录。</p>';
      return list.map(a => {
        const t = milestone.tasks.find(t => t.id === a.task), compatible=t && fingerprint(t)===a.taskFingerprint;
        const g = compatible ? grade(t,a.answers,a.unknown) : null;
        const verdict = !compatible ? '旧版题，需在新题下补证' : a.unknown ? '答案超出选项，未自动判定' : g.passed ? (a.independent&&!a.hinted?'独立通过':'练习通过（看过提示）') : '未通过';
        const rows = t ? t.fields.map(f => {
          const c = g && !a.unknown ? g.checks.find(x => x.id === f.id) : null;
          const v = a.answers[f.id];
          return '<div class="mastery-dl-row"><span class="k">'+esc(f.label)+'</span><span class="v">'+esc(Array.isArray(v)?v.join('、'):(v==null||v===''?'—':String(v)))+'</span>'+(c&&!c.passed?'<span class="miss">未过</span>':'')+'</div>';
        }).join('') : '';
        return '<details><summary>'+esc(a.task)+' · '+esc(String(a.submittedAt).slice(0,10))+' · '+verdict+'</summary>'+rows+(a.report?'<p class="ms-note">开放分析：'+esc(a.report)+'</p>':'')+(g&&!a.unknown?g.checks.filter(c=>!c.passed).map(c=>'<p class="ms-note" style="color:#b3541e">补练 '+esc(c.id)+'：'+esc(c.remedy)+'</p>').join(''):'')+'</details>';
      }).join('');
    }
    function teachingHtml(m) {
      const names={prompt:'示例',answer:'解释',counterexample:'近似反例',failure:'满足定义但失败',unknown:'信息不足',alternative:'另一种合格回答',unacceptable:'不可接受回答'};
      return '<p>'+esc(m.prerequisites)+'</p>'+Object.entries(m.example).map(([key,value])=>'<p><b>'+esc(names[key]||key)+'：</b>'+esc(value)+'</p>').join('')+'<ul>'+m.rubric.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>';
    }
    function chooseTask(m) {
      milestone=m;const e=evidence(m,archive);
      task=(e.retest&&e.delayed?m.tasks.find(t=>e.tasks.includes(t.id)):m.tasks.find(t=>!archive.exposure[t.source.overlapGroup]))||m.tasks[0];
      pendingFocus='#mastery-start';renderTask();
    }
    function renderLearning(m) {
      ready=false;
      const failed=archive.attempts.filter(a=>a.milestone===m.id).flatMap(a=>{
        const t=m.tasks.find(t=>t.id===a.task);
        return t&&fingerprint(t)===a.taskFingerprint?grade(t,a.answers,a.unknown).checks.filter(c=>!c.passed):[];
      });
      root.innerHTML='<section id="mastery-learning"><h2>'+esc(m.title)+' · 学习示范</h2><p>这里看通用示范，不消耗题库。之后的独立检验里，看过提示或用过 AI 的那次作答会记为练习，不作为独立证据。</p>'+teachingHtml(m)+(failed.length?'<h3>本次补练</h3><ul>'+[...new Set(failed.map(c=>c.remedy))].map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul>':'')+'<div class="ms-actions"><button id="mastery-check" class="kbtn dark">学习完成，去独立检验</button><button id="mastery-home" class="kbtn">返回阶段实操</button></div>'+emergency()+'</section>';
      root.querySelector('#mastery-check').onclick=()=>chooseTask(m);
      root.querySelector('#mastery-home').onclick=()=>{pendingFocus='[data-learn="'+m.id+'"]';renderHome();};
      bindEmergency();
      root.querySelector('#mastery-check').focus();
    }

    function cardState(m) {
      const e = evidence(m, archive);
      const started = archive.attempts.some(a => a.milestone === m.id);
      const hasDraft = m.tasks.some(t => archive.drafts[t.id]);
      let label;
      if (!e.core) label = hasDraft ? '继续作答' : !started ? '开始 · 先看示范' : (e.weakness.length ? '继续 · 先补错因' : '继续独立检验');
      else if (!e.retest) label = '换一题独立复测';
      else if (!e.delayed) label = '做跨日复测（隔天）';
      else label = '复核证据记录';
      return { e: e, started: started, hasDraft: hasDraft, label: label };
    }

    function renderHome() {
      ready=false;
      root.innerHTML='<p id="mastery-status" role="status" aria-live="polite"></p><div class="mastery-grid">'+catalog.map(m=>{const c=cardState(m),e=c.e;
        const chips=[['首次独立',e.core],['换题复测',e.retest],['跨日复测',e.delayed]].map(s=>'<span class="'+(s[1]?'on':'')+'">'+s[0]+'</span>').join('');
        const tags=[e.selfAssessed?'自评已交':'自评未交']; if(c.hasDraft) tags.push('有未交草稿');
        return '<article><h2>'+esc(m.id+' '+m.title)+'</h2><p>'+esc(m.objective)+'</p>'+
          '<div class="ms-steps" aria-label="证据进度">'+chips+'</div><p class="ms-tags">'+tags.map(esc).join(' · ')+'</p>'+
          (e.weakness.length?'<p class="ms-weak">常错：'+e.weakness.slice(0,3).map(w=>esc(w.category)+' ×'+w.count).join(' · ')+'</p>':'')+
          '<div class="ms-actions"><button class="kbtn dark" data-mid="'+esc(m.id)+'">'+esc(c.label)+' →</button><button class="kbtn" data-learn="'+esc(m.id)+'">学习示范</button></div>'+
          '<details class="ms-evidence"><summary>证据明细</summary><p>核心初次通过：'+(e.core?'是':'否')+'；独立换题通过：'+(e.retest?'是':'否')+'；跨日记录：'+(e.delayed?'已有':'待补')+'；开放报告自评：'+(e.selfAssessed?'已交':'未交')+(e.needsRecheck?'；'+e.needsRecheck+' 份历史答卷需在新版题下补证':'')+(e.weakness.length?'<br>常错项：'+e.weakness.map(w=>esc(w.category)+' ×'+w.count).join(' · '):'')+'</p></details></article>';}).join('')+'</div>'+
        '<p class="ms-note">三步证据齐备，这个里程碑才算拿到结构化证据；开放自评与 AI 反馈单独记录、不互相替代。状态只证明练过，不证明盈利能力；连续推理、作图研究与执行记录在专题任务中完成。记录的备份与恢复统一在<a href="https://chevywang.github.io/kbar/progress.html#backup">学习进度总览</a>页。</p>'+
        emergency();
      root.querySelectorAll('[data-learn]').forEach(b=>b.onclick=()=>renderLearning(catalog.find(m=>m.id===b.dataset.learn)));
      root.querySelectorAll('[data-mid]').forEach(b=>b.onclick=()=>{
        const m=catalog.find(x=>x.id===b.dataset.mid), c=cardState(m);
        if (!c.e.core && !c.started && !c.hasDraft) { renderLearning(m); return; }
        if (!c.e.core && c.started && c.e.weakness.length) { renderLearning(m); return; }
        chooseTask(m);
      });
      bindEmergency();status();applyPendingFocus();
    }
    function renderTask() {
      ready=false;
      const m=milestone,t=task,d=currentDraft(), attempts=archive.attempts.filter(a=>a.task===t.id), exposed=!!archive.exposure[t.source.overlapGroup];
      const exhausted=m.tasks.every(t=>archive.exposure[t.source.overlapGroup]);
      root.innerHTML='<p><button id="mastery-home" class="kbtn">← 阶段实操</button></p><h2>'+esc(m.id+' '+m.title)+'</h2><p>'+esc(m.objective)+'</p>'+
        '<details><summary>学习示范与量规——打开后，本次作答会记为练习（不作独立检验）</summary>'+teachingHtml(m)+'<p>作答路径：先独立作答 → 看反馈补错 → 换未看过的题 → 隔天再测一次。原答永久保留，复习不改写首次记录。</p></details>'+
        '<nav class="mastery-pool" aria-label="任务池"><span class="mastery-pool-label">题目（打开即标记为已看）：</span>'+m.tasks.map(x=>{const role={initial:'首次',remedy:'补救',delayed:'延迟',reserve1:'备用',reserve2:'备用'}[x.role]||x.role;return '<button data-task="'+esc(x.id)+'" '+(x.id===task.id?'aria-current="true"':'')+'>'+esc(x.id.slice(-1)+' · '+role)+(archive.exposure[x.source.overlapGroup]?' · 已看':' · 未看')+'</button>';}).join('')+'</nav>'+
        (exhausted?'<p class="mastery-warning">这套题库的题你都看过了：复习不再计为新证据；等课程扩充题库后可继续加证。</p>':'')+
        '<p id="mastery-status" role="status" aria-live="polite"></p>'+
        '<section><h3>'+esc(t.id)+'</h3><div id="mastery-task-preview" hidden><p class="mastery-scenario">'+esc(t.scenario)+'</p><details><summary>数据与截至时点</summary><p>'+Object.entries(t.source).map(([k,v])=>esc(k+': '+v)).join('<br>')+'</p></details><div id="mastery-chart"></div></div>'+
        (attempts.length?'<p class="ms-note">本题已交过卷：再答属于复习或修订，不会改写首次记录。</p>':'')+
        '<button id="mastery-start" class="kbtn dark">'+(exposed?'继续本题':'开始作答')+'</button>'+
        '<div id="mastery-form" hidden>'+t.fields.map(f=>'<label class="mastery-field">'+esc(f.label)+(f.type==='select'?'<select data-field="'+esc(f.id)+'"><option value="">请选择</option>'+f.options.map(o=>'<option '+(d.answers[f.id]===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select>':'<input data-field="'+esc(f.id)+'" type="'+(f.type==='number'?'number':'text')+'" step="any" value="'+esc(d.answers[f.id] == null ? '' : d.answers[f.id])+'">')+'</label>').join('')+'<label class="mastery-field">开放分析（不计入自动评分）：'+esc(t.reflection)+'<textarea id="mastery-report" rows="7">'+esc(d.report)+'</textarea></label>'+m.rubric.map((r,i)=>'<label class="mastery-field">自评：'+esc(r)+'<select data-rubric="'+i+'">'+['未成立','待补证','已自评'].map(v=>'<option '+((d.selfAssessment||[])[i]===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label>').join('')+'<div class="ms-actions"><button id="mastery-submit" class="kbtn dark">提交答卷</button><button id="mastery-unknown" class="kbtn">我的答案不在选项里</button></div></div></section>'+
        '<div id="mastery-result" role="status"></div>'+
        '<section class="ms-history"><h3>作答记录</h3>'+history()+'</section>'+
        '<details id="mastery-ai"><summary><b>AI 辅助（可选）</b><span class="ms-sum-sub">使用后本题记为辅助练习</span></summary><p>把本题材料交给你的 AI 工具求辅导；AI 建议单独保存，不改变原答与判定。</p><div class="ms-actions"><button id="mastery-coach-json" class="kbtn">生成辅导材料 JSON</button><button id="mastery-coach-md" class="kbtn">生成辅导材料 Markdown</button></div><label>来源<input id="mastery-ai-source" placeholder="模型 / 工具与版本"></label><label>收到的建议<textarea id="mastery-ai-feedback" rows="4"></textarea></label><button id="mastery-ai-save" class="kbtn">保存建议</button></details>'+
        emergency();
      root.querySelector('#mastery-home').onclick=()=>{if(ready)collect();save();pendingFocus='[data-mid="'+milestone.id+'"]';renderHome();};
      root.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>{if(ready)collect();save();task=m.tasks.find(t=>t.id===b.dataset.task);pendingFocus='[data-task="'+task.id+'"]';renderTask();});
      const teaching=root.querySelector('details');teaching.addEventListener('toggle',()=>{if(teaching.open){d.hinted=true;archive.drafts[t.id]=d;save();}});
      root.querySelector('#mastery-start').onclick=()=>{
        ready=true;root.querySelector('#mastery-task-preview').hidden=false;root.querySelector('#mastery-form').hidden=false;root.querySelector('#mastery-start').hidden=true;
        if(!archive.exposure[t.source.overlapGroup]) archive.exposure[t.source.overlapGroup]={firstSeen:now(),task:t.id};
        archive.drafts[t.id]=d;save();
        if(t.bars && t.bars.length && global.Kbar) root.querySelector('#mastery-chart').innerHTML=global.Kbar.chart(t.bars,{w:720,h:300,yLabels:true,asOf:t.bars.length-1,span:t.bars.length,vol:t.bars.map(b=>b.v||0),title:t.source.instrument});
        root.querySelector('[data-field]').focus();
      };
      root.querySelectorAll('[data-field],#mastery-report,[data-rubric]').forEach(el=>el.addEventListener('input',()=>{collect();save();}));
      function submit(unknown){
        if(!ready)return;
        const draft=collect();
        if(!unknown && t.fields.some(f=>draft.answers[f.id]===undefined||String(draft.answers[f.id]).trim()==='')){message='请完成每个核心字段后提交。';status();return;}
        const prev=archive.attempts.some(a=>a.task===t.id), result=grade(t,draft.answers,unknown);
        const a={id:uid(),milestone:m.id,task:t.id,taskFingerprint:fingerprint(t),submittedAt:now(),answers:clone(draft.answers),independent:!prev&&!draft.hinted,hinted:!!draft.hinted,unknown:!!unknown,revealed:true,report:draft.report,selfAssessment:clone(draft.selfAssessment||[])};
        archive.attempts.push(a);delete archive.drafts[t.id];ready=false;save();pendingFocus='#mastery-start';renderTask();
        root.querySelector('#mastery-result').textContent=unknown?'当前自动规则无法判断此解释；原答已保留，请选未曝光的同能力任务。':result.passed?(a.independent?'本次全部核心检查通过。开放报告和实际迁移另行记录。':'本次练习通过，不能替代新任务的独立证据。'):'尚有核心项未通过，请按记录中的微任务补练后换题。';
        const next=m.tasks.find(t=>!archive.exposure[t.source.overlapGroup]), e=evidence(m,archive);
        const waiting=e.retest&&!e.delayed;
        const action=document.createElement('button');action.id='mastery-next-step';
        action.textContent=!result.passed?'看错因与补练':e.delayed?'回到总览，补开放自评':waiting?'间隔至少 24 小时后做跨日复测':next?'换一题继续':'题库已用完：看补练建议';
        action.onclick=()=>{
          if(!result.passed){renderLearning(m);return;}
          if(e.delayed){pendingFocus='[data-mid="'+m.id+'"]';renderHome();return;}
          if(!next){renderLearning(m);return;}
          const first=archive.attempts.filter(a=>e.tasks.includes(a.task)&&a.independent&&!a.hinted).map(a=>Date.parse(a.submittedAt)).sort((a,b)=>a-b)[0];
          if(waiting&&Date.now()-first<86400000){message='距离首次独立通过不足24小时；现在可复习，延迟检验请稍后换未曝光材料。';status();return;}
          task=next;pendingFocus='#mastery-start';renderTask();
        };
        root.querySelector('#mastery-result').appendChild(action);action.focus();
      }
      root.querySelector('#mastery-submit').onclick=()=>submit(false);
      root.querySelector('#mastery-unknown').onclick=()=>submit(true);
      function coach(md){const draft=collect();draft.hinted=true;save();const pack=coachPack(m,t,draft,null);download('coach-'+t.id+(md?'.md':'.json'),md?'# AI教练材料\n\n'+pack.instruction+'\n\n```json\n'+JSON.stringify(pack,null,2)+'\n```':JSON.stringify(pack,null,2),md?'text/markdown':'application/json');}
      root.querySelector('#mastery-coach-json').onclick=()=>coach(false);root.querySelector('#mastery-coach-md').onclick=()=>coach(true);
      root.querySelector('#mastery-ai-save').onclick=()=>{const text=root.querySelector('#mastery-ai-feedback').value.trim();if(!text)return;d.hinted=true;const active=currentDraft();active.hinted=true;archive.drafts[t.id]=active;archive.feedback.push({milestone:m.id,source:root.querySelector('#mastery-ai-source').value||'学习者导入，未验证',text,at:now()});save();message='AI建议已单独保存；原答与核心判定未改变。';status();};
      bindEmergency();status();applyPendingFocus();
    }
    // Replay imported static data after reopening; imported JS is never executed.
    try{catalog=replayPacks(catalog,archive.legacy);}catch(e){message='已保存任务包需复核：'+e.message;}
    global.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='作答尚未保存（本浏览器存储不可用），请先导出';}});
    renderHome();
  }
  function replayPacks(catalog, legacy) {
    let next=catalog;
    legacy.filter(v=>v.kind==='installed-pack').forEach(v=>{
      const pack=clone(v.pack);
      if(!pack || !Array.isArray(pack.milestones))fail('保存的静态包损坏');
      pack.milestones.forEach(m=>{m.tasks=m.tasks.filter(t=>{const old=next.flatMap(m=>m.tasks).find(x=>x.id===t.id);if(old&&stringify(old)!==stringify(t))fail('静态包同ID内容冲突');return !old;});});
      next=importPack(next,pack);
    });
    return next;
  }
  function overlaps(a,b) {
    if(a.source.kind!=='historical'||b.source.kind!=='historical')return false;
    const bars=t=>(t.bars||[]).map(x=>stringify([x.o,x.h,x.l,x.c,x.v]));
    const left=new Set(bars(a)),right=bars(b);
    const shared=right.filter(x=>left.has(x)).length;
    return shared>=Math.min(3,left.size,right.length)&&shared>0;
  }
  function importPack(catalog, pack) {
    safeTree(pack);
    if (!plain(pack) || pack.kind !== 'kbar-static-task-pack' || pack.version !== 1 || !Array.isArray(pack.milestones)) fail('任务包格式或版本不支持');
    const next=clone(catalog), ids=new Set(next.flatMap(m=>m.tasks.map(t=>t.id))), groups=new Set(next.flatMap(m=>m.tasks.map(t=>t.source.overlapGroup)));
    pack.milestones.forEach(add=>{const m=next.find(m=>m.id===add.id);if(!m || !Array.isArray(add.tasks))fail('任务包必须扩展现有能力');add.tasks.forEach(t=>{validateTask(t);if(ids.has(t.id)||groups.has(t.source.overlapGroup))fail('任务或曝光区间重复：'+t.id);ids.add(t.id);groups.add(t.source.overlapGroup);if(next.flatMap(m=>m.tasks).concat(global.KBAR_CASE_REGISTRY||[]).some(old=>overlaps(old,t)))fail('历史行情与现有任务重叠，不能换标识冒充新案例：'+t.id);m.tasks.push(clone(t));});});
    validateCatalog(next);return next;
  }
  const api={VERSION,grade,validateTask,validateCatalog,emptyArchive,validateArchive,mergeArchive,mergeForSave,fingerprint,evidence,coachPack,importPack,replayPacks,overlaps,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.KbarMastery=api;
})(typeof window!=='undefined'?window:globalThis);
