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
    function status() { const el = root.querySelector('#mastery-status'); if (el) el.textContent = message || (storageOk ? '上次成功保存：'+(lastSave || '尚无修改') : '本地存储不可用：本页可继续作答；关闭前请导出，重开后导入。'); }
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
      return archive.attempts.filter(a => a.milestone === milestone.id).map(a => {
        const t = milestone.tasks.find(t => t.id === a.task), compatible=t && fingerprint(t)===a.taskFingerprint;
        const g = compatible ? grade(t,a.answers,a.unknown) : null;
        return '<details><summary>'+esc(a.task)+' · '+esc(a.submittedAt)+' · '+(!compatible?'旧版，需补证':g.status==='unresolved'?'无法自动判定':g.passed?(a.independent&&!a.hinted?'本次核心通过':'复习/提示后完成，非独立证据'):'待补练')+'</summary><pre>'+esc(JSON.stringify(a.answers,null,2))+'</pre><p>'+esc(a.report)+'</p>'+(g?g.checks.map(c=>'<p>'+ (c.passed?'✓':'待补练')+' '+esc(c.id)+'：'+esc(c.explain)+(c.passed?'':'<br>补练：'+esc(c.remedy))+'</p>').join(''):'')+'</details>';
      }).join('');
    }
    function renderHome() {
      ready=false;
      root.innerHTML='<p id="mastery-status" role="status" aria-live="polite"></p><div class="mastery-toolbar">'+toolbar()+'</div><div class="mastery-grid">'+catalog.map(m=>{const e=evidence(m,archive);return '<article><h2>'+esc(m.id+' '+m.title)+'</h2><p>'+esc(m.objective)+'</p><p>'+(e.core?'核心初次通过':'核心待验证')+' · '+(e.retest?'独立换题通过':'独立换题待验证')+' · '+(e.delayed?'跨日记录已有':'跨日记录待补')+' · 开放报告'+(e.selfAssessed?'已自评':'未自评')+(e.needsRecheck?' · '+e.needsRecheck+'份旧版待补证':'')+'</p>'+(e.weakness.length?'<p>待补练集中：'+e.weakness.slice(0,3).map(w=>esc(w.category)+' ×'+w.count).join(' · ')+'</p>':'')+'<button data-mid="'+esc(m.id)+'">进入任务</button></article>';}).join('')+'</div><p>本页验证指定结构化检查；连续推理、作图研究及执行档案还须在专门实作中完成，并保留其证据。结构化证据、独立复测、开放自评与AI反馈分别记录；当前不自动授予完整里程碑或阶段结业。以上状态不证明实际盈利能力；跨日间隔是设计参数，尚待试学校准。</p>';
      root.querySelectorAll('[data-mid]').forEach(b=>b.onclick=()=>{milestone=catalog.find(m=>m.id===b.dataset.mid);task=milestone.tasks.find(t=>!archive.exposure[t.source.overlapGroup])||milestone.tasks[0];pendingFocus='#mastery-start';renderTask();});
      bindToolbar();status();applyPendingFocus();
    }
    function toolbar() {return '<button id="mastery-export">导出全部学习档案</button><label class="mastery-file">导入学习档案<input id="mastery-import" type="file" accept="application/json"></label><label class="mastery-file">导入新静态任务包<input id="mastery-pack" type="file" accept="application/json"></label><button id="mastery-print">打印</button>';}
    function bindToolbar() {
      root.querySelector('#mastery-export').onclick=()=>{if(ready) collect();download('kbar-learning-archive.json',JSON.stringify(archive,null,2));dirty=false;message='学习档案已生成下载；请确认文件已保存。';status();};
      root.querySelector('#mastery-print').onclick=()=>global.print();
      root.querySelector('#mastery-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return; const incoming=JSON.parse(await file.text()); const merged=mergeArchive(archive,incoming);const restored=replayPacks(catalog,merged.legacy);catalog=restored;archive=merged;message='导入成功；原答按ID合并，冲突草稿保留，旧版证据须补证。';save();renderHome();}catch(err){message='导入失败：'+err.message;status();}};
      root.querySelector('#mastery-pack').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const pack=JSON.parse(await file.text());const next=importPack(catalog,pack);catalog=next;archive.legacy.push({kind:'installed-pack',pack:clone(pack)});save();message='新静态任务包已通过结构检查，可继续验证。来源正确性须以课程发布说明核对。';renderHome();}catch(err){message='任务包未导入：'+err.message;status();}};
    }
    function renderTask() {
      ready=false;
      const m=milestone,t=task,d=currentDraft(), attempts=archive.attempts.filter(a=>a.task===t.id), exposed=!!archive.exposure[t.source.overlapGroup];
      const exhausted=m.tasks.every(t=>archive.exposure[t.source.overlapGroup]);
      root.innerHTML='<p><button id="mastery-home">← 能力档案</button></p><h1>'+esc(m.id+' '+m.title)+'</h1><p>'+esc(m.objective)+'</p><details><summary>教学卡：先修、示范、反例与量规（使用后本任务计提示练习）</summary><p>'+esc(m.prerequisites)+'</p>'+Object.entries(m.example).map(([k,v])=>'<p><b>'+esc({prompt:'示例',answer:'解释',counterexample:'近似反例',failure:'满足定义但失败',unknown:'信息不足'}[k])+':</b> '+esc(v)+'</p>').join('')+'<p>首次独立作答→反馈与补练→未曝光换题→跨日复测；每项核心均需通过。原答永久保留，复习不重新计为陌生证据。</p></details><nav class="mastery-toolbar">'+m.tasks.map(t=>'<button data-task="'+esc(t.id)+'" '+(t.id===task.id?'aria-current="true"':'')+'>'+esc(t.id)+' · '+esc({initial:'首次',remedy:'补救',delayed:'延迟',reserve1:'备用一',reserve2:'备用二'}[t.role]||t.role)+(archive.exposure[t.source.overlapGroup]?' · 已曝光':' · 未曝光')+'</button>').join('')+'</nav>'+(exhausted?'<p class="mastery-warning">当前离线包没有未曝光案例。可以复习并保留记录；导入新的静态任务包后增加独立证据。</p>':'')+'<p id="mastery-status" role="status" aria-live="polite"></p><div class="mastery-toolbar">'+toolbar()+'</div><section><h2>'+esc(t.id)+'</h2><p class="mastery-scenario">'+esc(t.scenario)+'</p><details><summary>数据与截至时点</summary><p>'+Object.entries(t.source).map(([k,v])=>esc(k)+': '+esc(v)).join('<br>')+'</p></details><div id="mastery-chart"></div>'+(attempts.length?'<p>本任务已有提交；再次作答属于修订/复习，不会改写首次证据。</p>':'')+'<button id="mastery-start">'+(exposed?'继续草稿或复习':'开始本任务（记录曝光）')+'</button><div id="mastery-form" hidden>'+t.fields.map(f=>'<label class="mastery-field">'+esc(f.label)+(f.type==='select'?'<select data-field="'+esc(f.id)+'"><option value="">请选择</option>'+f.options.map(o=>'<option '+(d.answers[f.id]===o?'selected':'')+'>'+esc(o)+'</option>').join('')+'</select>':'<input data-field="'+esc(f.id)+'" type="'+(f.type==='number'?'number':'text')+'" step="any" value="'+esc(d.answers[f.id] == null ? '' : d.answers[f.id])+'">')+'</label>').join('')+'<label class="mastery-field">开放分析（与自动评分分开）：'+esc(t.reflection)+'<textarea id="mastery-report" rows="7">'+esc(d.report)+'</textarea></label>'+m.rubric.map((r,i)=>'<label class="mastery-field">自评：'+esc(r)+'<select data-rubric="'+i+'">'+['未成立','待补证','已自评'].map(v=>'<option '+((d.selfAssessment||[])[i]===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label>').join('')+'<div class="mastery-toolbar"><button id="mastery-submit">提交并揭晓（保留原答）</button><button id="mastery-unknown">我的解释超出选项：转替代任务</button><button id="mastery-coach-json">导出AI教练包 JSON（计辅助）</button><button id="mastery-coach-md">导出AI教练包 Markdown（计辅助）</button></div></div></section><div id="mastery-result" role="status"></div><section><h2>提交与补练记录</h2>'+history()+'</section><details><summary>保存可选AI反馈（不影响核心成绩）</summary><label>来源<input id="mastery-ai-source" placeholder="模型/工具与版本"></label><label>反馈<textarea id="mastery-ai-feedback" rows="4"></textarea></label><button id="mastery-ai-save">保存反馈</button></details>';
      root.querySelector('#mastery-home').onclick=()=>{if(ready)collect();save();pendingFocus='[data-mid="'+milestone.id+'"]';renderHome();};
      root.querySelectorAll('[data-task]').forEach(b=>b.onclick=()=>{if(ready)collect();save();task=m.tasks.find(t=>t.id===b.dataset.task);pendingFocus='[data-task="'+task.id+'"]';renderTask();});
      const teaching=root.querySelector('details');teaching.addEventListener('toggle',()=>{if(teaching.open){d.hinted=true;archive.drafts[t.id]=d;save();}});
      root.querySelector('#mastery-start').onclick=()=>{
        ready=true;root.querySelector('#mastery-form').hidden=false;root.querySelector('#mastery-start').hidden=true;
        if(!archive.exposure[t.source.overlapGroup]) archive.exposure[t.source.overlapGroup]={firstSeen:now(),task:t.id};
        archive.drafts[t.id]=d;save();
        if(t.bars && t.bars.length && global.Kbar) root.querySelector('#mastery-chart').innerHTML=global.Kbar.chart(t.bars,{w:780,h:300,yLabels:true,asOf:t.bars.length-1,span:t.bars.length,vol:t.bars.map(b=>b.v||0),title:t.source.instrument});
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
      }
      root.querySelector('#mastery-submit').onclick=()=>submit(false);
      root.querySelector('#mastery-unknown').onclick=()=>submit(true);
      function coach(md){const draft=collect();draft.hinted=true;save();const pack=coachPack(m,t,draft,null);download('coach-'+t.id+(md?'.md':'.json'),md?'# AI教练材料\n\n'+pack.instruction+'\n\n```json\n'+JSON.stringify(pack,null,2)+'\n```':JSON.stringify(pack,null,2),md?'text/markdown':'application/json');}
      root.querySelector('#mastery-coach-json').onclick=()=>coach(false);root.querySelector('#mastery-coach-md').onclick=()=>coach(true);
      root.querySelector('#mastery-ai-save').onclick=()=>{const text=root.querySelector('#mastery-ai-feedback').value.trim();if(!text)return;d.hinted=true;const active=currentDraft();active.hinted=true;archive.drafts[t.id]=active;archive.feedback.push({milestone:m.id,source:root.querySelector('#mastery-ai-source').value||'学习者导入，未验证',text,at:now()});save();message='AI建议已单独保存；原答与核心判定未改变。';status();};
      bindToolbar();status();applyPendingFocus();
    }
    // Replay imported static data after reopening; imported JS is never executed.
    try{catalog=replayPacks(catalog,archive.legacy);}catch(e){message='已保存任务包需复核：'+e.message;}
    global.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='学习档案未保存，请先导出';}});
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
  const api={VERSION,grade,validateTask,validateCatalog,emptyArchive,validateArchive,mergeArchive,mergeForSave,fingerprint,evidence,coachPack,importPack,overlaps,mount};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.KbarMastery=api;
})(typeof window!=='undefined'?window:globalThis);
