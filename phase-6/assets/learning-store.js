/* Shared resilient storage for legacy specialist exercises. Never sends records. */
(function(global){
'use strict';
const cache=new Map();let backing=null,healthy=false,lastExport=0;
try{backing=global.localStorage;backing.setItem('__kbar_store_probe__','1');backing.removeItem('__kbar_store_probe__');healthy=true;}catch(e){}
const prefix='kbar-answer::';
const api={getItem(k){if(cache.has(k))return cache.get(k);if(backing)try{const v=backing.getItem(k);if(v!==null)cache.set(k,v);return v;}catch(e){healthy=false;}return null;},setItem(k,v){cache.set(k,String(v));if(backing&&healthy)try{backing.setItem(k,String(v));}catch(e){healthy=false;notice();}},removeItem(k){cache.delete(k);if(backing&&healthy)try{backing.removeItem(k);}catch(e){healthy=false;notice();}}};
function notice(text){const el=document.getElementById('kbar-legacy-status');if(el)el.textContent=text||(healthy?'答卷保存在此浏览器；跨设备请导出，包含草稿与首次提交。':'本地存储不可用或已满：可继续作答，记录仅在当前页内存。关闭前请导出。');}
function parseRecord(k,v){if((/::lastPack(?:::import-\d+)?$/.test(k)))return v;return JSON.parse(v);}
function entries(){const data={};if(backing)try{for(let i=0;i<backing.length;i++){const k=backing.key(i);if(k&&k.startsWith(prefix)){const v=api.getItem(k);if(v!==null)data[k]=parseRecord(k,v);}}}catch(e){healthy=false;}
cache.forEach((v,k)=>{if(k.startsWith(prefix))data[k]=parseRecord(k,v);});return data;}
function valid(value,depth=0){if(depth>50)throw Error('记录嵌套过深');if(value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value))return;if(Array.isArray(value)){value.forEach(v=>valid(v,depth+1));return;}if(value&&typeof value==='object'){Object.keys(value).forEach(k=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('不安全字段');if(['attempts','snaps','results','submissions'].includes(k)&&(!Array.isArray(value[k])||value[k].some(x=>!x||typeof x!=='object'||Array.isArray(x))))throw Error('答卷列表损坏');valid(value[k],depth+1);});return;}throw Error('记录格式非法');}
function restore(payload){if(!payload||payload.kind!=='kbar-specialist-archive'||payload.version!==1||!payload.records||Array.isArray(payload.records)||typeof payload.records!=='object')throw Error('不支持的专门练习档案版本');
const all=Object.entries(payload.records);all.forEach(([k,v])=>{if(!/^kbar-answer::[A-Za-z0-9.:-]+$/.test(k))throw Error('档案含非课程键');valid(v);
 if(k.includes('::import-'))return;
 if(k.endsWith('::lastPack')){if(typeof v!=='string'||!['A','B','C','D','E','T'].includes(v))throw Error('题包选择值无效');return;}
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('任务记录必须是对象');
 if(/::M(?:0\.1|1\.4|4\.3|5\.2)::[A-Z](?:-[A-Za-z0-9]+)?$/.test(k)&&!Array.isArray(v.attempts))throw Error('任务缺少attempts列表');
 if(/::M2\.4(?:-v2)?::[A-Z](?:-[A-Za-z0-9]+)?$/.test(k)&&(!Array.isArray(v.snaps)||typeof v.done!=='boolean'))throw Error('日型任务缺少snaps/done');
 if(k.includes('::M3.3')&&(!Array.isArray(v.attempts)||!['taskA','taskB','taskC'].every(x=>x in v)))throw Error('统计任务结构不完整');
 });
// No overwrite of divergent original work. Save import under conflict key for export/review.
let conflicts=0;all.forEach(([k,v])=>{const old=api.getItem(k),raw=k.endsWith('::lastPack')?v:JSON.stringify(v);if(old!==null&&old!==raw){api.setItem(k+'::import-'+Date.now(),raw);conflicts++;}else api.setItem(k,raw);});return conflicts;}
function install(){if(document.getElementById('kbar-legacy-tools'))return;const root=document.createElement('section');root.id='kbar-legacy-tools';root.style.cssText='margin:2rem auto;padding:1rem;max-width:900px;border:1px solid #aaa;font:15px/1.7 sans-serif';root.innerHTML='<h2>专门练习档案</h2><p id="kbar-legacy-status" role="status"></p><button type="button" id="kbar-legacy-export">导出全部专门练习（含未提交草稿）</button> <label>恢复专门练习档案 <input id="kbar-legacy-import" type="file" accept="application/json"></label><p>与新版能力档案分别保留。导入不会覆盖不同内容的原答；冲突副本可再次导出。关闭后重开仍需使用原页面或导入备份。</p>';document.body.appendChild(root);notice();
document.getElementById('kbar-legacy-export').onclick=()=>{global.dispatchEvent(new Event('kbar-save-draft'));const blob=new Blob([JSON.stringify({kind:'kbar-specialist-archive',version:1,exportedAt:new Date().toISOString(),records:entries()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='kbar-specialist-archive.json';a.click();lastExport=Date.now();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notice('下载已生成，请确认文件已保存；包含本来源下全部专门练习。');};
document.getElementById('kbar-legacy-import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const n=restore(JSON.parse(await f.text()));notice('导入完成，'+n+'项冲突另存而未覆盖原答。刷新页面恢复已导入任务。');}catch(err){notice('导入失败：'+err.message+'；原记录未覆盖。');}};
// Existing quiz-like div choices become keyboard reachable without changing scoring.
const enhance=()=>document.querySelectorAll('.q-opt').forEach(el=>{if(el.tagName!=='BUTTON'){el.setAttribute('role','button');el.tabIndex=0;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};}});enhance();new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});}
global.addEventListener('beforeunload',e=>{if(!healthy&&cache.size&&Date.now()-lastExport>1000){e.preventDefault();e.returnValue='请先导出学习档案';}});
global.KbarLearningStore={storage:api,restore,entries};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})(window);
