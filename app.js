'use strict';
(() => {
const data = window.TASK_DATA;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols = {A:'◇',B:'↗',C:'◈',D:'⌘',E:'▤',F:'✳',G:'◉',H:'♧',I:'⌁'};
const confidenceNames = {H:'High',M:'Medium',L:'Low','-':'Unestimated'};
const tasks = data.areas.flatMap(area => area.parents.flatMap(parent => parent.tasks.map(task => ({...task,areaId:area.id,areaTitle:area.title,parentId:parent.id,parentTitle:parent.title}))));
const byId = new Map(tasks.map(task => [task.original_id,task]));
const storageKey = 'dolce-orbit-planning-v1';
let storageAvailable = true, saved = {focus:[],notes:{}};
try { const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw&&Array.isArray(raw.focus)&&raw.notes&&typeof raw.notes==='object'){saved.focus=raw.focus.filter(id=>byId.has(id));saved.notes=Object.fromEntries(Object.entries(raw.notes).filter(([id,note])=>byId.has(Number(id))&&typeof note==='string'));} } catch {storageAvailable=false;}
const state = {query:'',priorities:new Set(),area:'',parent:'',effort:'',confidence:'',sort:'rank',view:'map',scope:'all'};
const openedParents = new Set();
let currentTask=null,toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(saved));storageAvailable=true;}catch{storageAvailable=false;toast('Browser storage unavailable. Export a backup to keep your planning.');}}
function effortInfo(value){
 const s=value.toLowerCase();
 if(/wait|unknown|tbd|unestimated|^-$/.test(s))return {bucket:'wait',hours:Infinity};
 if(/\/|daily|weekly|recurr|check|day|week|month/.test(s))return {bucket:'recurring',hours:Infinity};
 const nums=s.match(/\d+(?:\.\d+)?/g);if(!nums)return {bucket:'wait',hours:Infinity};
 const upper=Number(nums[nums.length-1]);const hours=/m/.test(s)&&!/h/.test(s)?upper/60:upper;
 return {bucket:hours<=1?'quick':hours<=4?'medium':'large',hours};
}
function compare(a,b){if(state.sort==='importance')return b.importance-a.importance||a.rank-b.rank;if(state.sort==='effort')return effortInfo(a.active_effort).hours-effortInfo(b.active_effort).hours||a.rank-b.rank;if(state.sort==='confidence'){const weights={H:0,M:1,L:2,'-':3};return weights[a.estimate_confidence]-weights[b.estimate_confidence]||a.rank-b.rank;}if(state.sort==='id')return a.original_id-b.original_id;return a.rank-b.rank;}
function filtered(){const words=state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);return tasks.filter(t=>(state.scope!=='focus'||saved.focus.includes(t.original_id))&&(state.scope!=='held'||t.priority==='P5')&&(!state.area||t.areaId===state.area)&&(!state.parent||t.parentId===state.parent)&&(!state.priorities.size||state.priorities.has(t.priority))&&(!state.effort||effortInfo(t.active_effort).bucket===state.effort)&&(!state.confidence||t.estimate_confidence===state.confidence)&&words.every(word=>/^#\d+$/.test(word)?t.original_id===Number(word.slice(1)):`${t.title} ${t.original_title} ${t.original_id} ${t.areaTitle} ${t.parentTitle} ${t.parentId}`.toLowerCase().includes(word))).sort(compare);}
function isFocused(id){return saved.focus.includes(id);}
function focusButton(t){return `<button class="star ${isFocused(t.original_id)?'selected':''}" data-focus="${t.original_id}" aria-label="${isFocused(t.original_id)?'Remove from':'Add to'} focus: ${esc(t.title)}" aria-pressed="${isFocused(t.original_id)}">${isFocused(t.original_id)?'✦':'✧'}</button>`;}
function taskHTML(t,mini=false){return `<div class="${mini?'mini-task':'list-entry'}"><button class="task-row" data-task="${t.original_id}"><span class="priority-dot ${t.priority.toLowerCase()}"></span><span class="task-text"><span class="task-title">${esc(t.title)}</span><span class="task-id">${mini?`#${t.original_id} · RANK ${t.rank}`:`<b>#${t.original_id}</b> · ${esc(t.parentId)} / ${esc(t.parentTitle)}`}${saved.notes[t.original_id]?' · NOTE':''}</span></span><span class="task-meta"><span class="badge ${t.priority}">${t.priority}</span>${mini?'':`<span class="importance" title="Importance">${t.importance}<span style="opacity:.4">/10</span></span>`}<span class="effort" title="Estimated active effort">${esc(t.active_effort)}</span><span class="confidence" title="Estimate confidence">${confidenceNames[t.estimate_confidence]||'Unestimated'}</span></span></button>${focusButton(t)}</div>`;}
function renderNav(){
 $('allCount').textContent=tasks.length;$('focusCount').textContent=saved.focus.length;$('heldCount').textContent=tasks.filter(t=>t.priority==='P5').length;
 document.querySelectorAll('[data-scope]').forEach(b=>b.classList.toggle('active',state.scope===b.dataset.scope&&!state.area));
 $('areaNav').innerHTML=data.areas.map(a=>`<button class="nav-button area-nav ${state.area===a.id?'active':''}" data-area="${a.id}"><span class="area-letter">${a.id}</span>${esc(a.title)}<b>${a.count}</b></button>`).join('');
 const current=data.areas.find(a=>a.id===state.area);$('breadcrumb').textContent=current?current.title:state.scope==='focus'?'My focus':state.scope==='held'?'Held & deferred':'All work';
 $('sectionTitle').innerHTML=current?`${esc(current.title)}<span>.</span>`:state.scope==='focus'?'Your next moves<span>.</span>':state.scope==='held'?'Keep the boundaries clear<span>.</span>':'Everything, connected<span>.</span>';
 $('sectionSubtitle').textContent=state.scope==='focus'?'Your browser-local shortlist. Select the star beside any task.':state.scope==='held'?'Owner holds, deferred decisions, and dormant work. No release implied.':current?`${current.parent_count} parent groups · ${current.count} tracked tasks · Original IDs preserved.`:'Nine areas. Three layers. A place for every task.';
}
function updateParents(){const options=data.areas.filter(a=>!state.area||a.id===state.area).flatMap(a=>a.parents);if(!options.some(p=>p.id===state.parent))state.parent='';$('parentSelect').innerHTML='<option value="">All parent groups</option>'+options.map(p=>`<option value="${p.id}">${esc(p.id+' · '+p.title)}</option>`).join('');$('parentSelect').value=state.parent;}
function chips(){const active=[];for(const p of state.priorities)active.push({key:'priority',value:p,label:p});if(state.query)active.push({key:'query',label:'Search: '+state.query});if(state.area)active.push({key:'area',label:state.area+' · '+data.areas.find(a=>a.id===state.area).title});if(state.parent)active.push({key:'parent',label:state.parent});if(state.effort)active.push({key:'effort',label:$('effortSelect').selectedOptions[0].text});if(state.confidence)active.push({key:'confidence',label:confidenceNames[state.confidence]+' confidence'});$('activeFilters').innerHTML=active.map(c=>`<button class="filter-chip" data-clear="${c.key}" data-value="${esc(c.value||'')}">${esc(c.label)} ×</button>`).join('');$('resetFilters').hidden=!active.length;}
function syncControls(){
 $('searchInput').value=state.query;$('areaSelect').value=state.area;updateParents();$('effortSelect').value=state.effort;$('confidenceSelect').value=state.confidence;$('sortSelect').value=state.sort;
 document.querySelectorAll('[data-priority]').forEach(b=>b.setAttribute('aria-pressed',state.priorities.has(b.dataset.priority)));
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',state.view===b.dataset.view));
}
function render(){
 renderNav();syncControls();chips();const list=filtered();const areaIds=new Set(list.map(t=>t.areaId));$('resultCount').textContent=list.length;$('resultLabel').textContent=`task${list.length===1?'':'s'} across ${areaIds.size} area${areaIds.size===1?'':'s'}`;
 if(!list.length){$('results').innerHTML=`<div class="empty-state"><span>◎</span><h3>${state.scope==='focus'?'Make room for what matters.':'Nothing in this orbit.'}</h3><p>${state.scope==='focus'&&!saved.focus.length?'Add tasks to your focus list using the star beside each one. Your shortlist stays in this browser.':'Try a broader search or clear a filter to bring more work into view.'}</p><button class="button quiet" id="emptyReset">${state.scope==='focus'?'Explore all tasks':'Reset filters'}</button></div>`;return;}
 if(state.view==='list'){$('results').innerHTML='<div class="task-list"><div class="list-header"><span>TASK / ORIGINAL ID</span><span>PRIORITY</span><span>IMPORTANCE</span><span>EFFORT / CONF.</span><span>FOCUS</span></div>'+list.map(t=>taskHTML(t)).join('')+'</div>';return;}
 const orderedAreas=data.areas.map(a=>({...a,visible:list.filter(t=>t.areaId===a.id)})).filter(a=>a.visible.length).sort((a,b)=>compare(a.visible[0],b.visible[0]));
 $('results').innerHTML='<div class="area-grid">'+orderedAreas.map(a=>{
 const ps=a.parents.map(p=>({...p,visible:list.filter(t=>t.parentId===p.id)})).filter(p=>p.visible.length).sort((x,y)=>compare(x.visible[0],y.visible[0]));
 return `<article class="area-card ${orderedAreas.length===1?'wide':''}" data-area="${a.id}"><div class="area-head"><span class="area-icon">${symbols[a.id]}</span><div class="area-heading"><small>AREA ${a.id} · ${ps.length} PARENT GROUPS</small><h3>${esc(a.title)}</h3></div><div class="area-total">${a.visible.length}<small>TASKS</small></div></div><div class="area-progress" aria-label="Priority distribution">${['P1','P2','P3','P4','P5'].map(p=>{const n=a.visible.filter(t=>t.priority===p).length;return n?`<span class="${p.toLowerCase()}" style="flex:${n}" title="${p}: ${n} tasks"></span>`:'';}).join('')}</div><div class="parent-list">${ps.map(p=>`<details class="parent-row" data-parent="${p.id}" ${openedParents.has(p.id)||state.parent===p.id||state.query?'open':''}><summary><span class="parent-id">${p.id}</span><span class="parent-title">${esc(p.title)}</span><span class="parent-count">${String(p.visible.length).padStart(2,'0')}</span><span class="chevron">›</span></summary><div class="parent-tasks">${p.visible.map(t=>taskHTML(t,true)).join('')}</div></details>`).join('')}</div></article>`;
 }).join('')+'</div>';
}
function reset(){Object.assign(state,{query:'',area:'',parent:'',effort:'',confidence:'',sort:'rank'});state.priorities.clear();render();}
function scopeTo(scope){state.scope=scope;reset();$('sidebar').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false');}
function toggleFocus(id){if(isFocused(id))saved.focus=saved.focus.filter(x=>x!==id);else saved.focus.push(id);persist();render();if(currentTask===id)$('drawerFocus').textContent=isFocused(id)?'Remove from my focus':'Add to my focus';}
function openTask(id){const t=byId.get(id);if(!t)return;currentTask=id;$('drawerPath').textContent=`AREA ${t.areaId} / ${t.parentId} / #${t.original_id}`;$('drawerBadges').innerHTML=`<span class="badge ${t.priority}">${t.priority} · ${t.priority==='P5'?'HELD / DEFERRED':'RANK '+t.rank}</span>`;$('taskDialogTitle').textContent=t.title;$('drawerMetrics').innerHTML=`<div><small>IMPORTANCE</small><strong>${t.importance} / 10</strong></div><div><small>ACTIVE EFFORT</small><strong>${esc(t.active_effort)}</strong></div><div><small>CONFIDENCE</small><strong>${confidenceNames[t.estimate_confidence]||'Unestimated'}</strong></div>`;$('originalTitle').textContent=t.original_title;$('taskCondition').textContent=t.condition;$('taskNote').value=saved.notes[id]||'';$('drawerFocus').textContent=isFocused(id)?'Remove from my focus':'Add to my focus';$('taskDialog').showModal();}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard.');}catch{const box=document.createElement('textarea');box.value=text;box.style.cssText='position:fixed;left:-9999px';const host=$('taskDialog').open?$('taskDialog'):document.body;host.append(box);box.select();const success=document.execCommand('copy');box.remove();toast(success?'Copied to clipboard.':'Copy unavailable in this browser. Use the CSV export.');}}
$('areaSelect').innerHTML+=[...data.areas].sort((a,b)=>a.id.localeCompare(b.id)).map(a=>`<option value="${a.id}">${esc(a.id+' · '+a.title)}</option>`).join('');
document.addEventListener('click',e=>{
 const f=e.target.closest('[data-focus]');if(f){toggleFocus(Number(f.dataset.focus));return;}
 const t=e.target.closest('[data-task]');if(t){openTask(Number(t.dataset.task));return;}
 const s=e.target.closest('[data-scope]');if(s){scopeTo(s.dataset.scope);return;}
 const a=e.target.closest('.area-nav[data-area]');if(a){state.scope='all';state.area=state.area===a.dataset.area?'':a.dataset.area;state.parent='';render();$('sidebar').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false');$('workSection').scrollIntoView({block:'start'});return;}
 const p=e.target.closest('[data-priority]');if(p){state.priorities.has(p.dataset.priority)?state.priorities.delete(p.dataset.priority):state.priorities.add(p.dataset.priority);render();return;}
 const v=e.target.closest('[data-view]');if(v){state.view=v.dataset.view;render();return;}
 const c=e.target.closest('[data-clear]');if(c){if(c.dataset.clear==='priority')state.priorities.delete(c.dataset.value);else state[c.dataset.clear]='';if(c.dataset.clear==='area')state.parent='';render();return;}
 if(e.target.closest('.close-dialog'))e.target.closest('dialog').close();
 if(e.target.id==='emptyReset'){if(state.scope==='focus')state.scope='all';reset();}
});
document.addEventListener('toggle',e=>{if(e.target.matches?.('.parent-row')){if(e.target.open)openedParents.add(e.target.dataset.parent);else openedParents.delete(e.target.dataset.parent);}},true);
$('searchInput').addEventListener('input',e=>{state.query=e.target.value;render();});
for(const [id,key] of [['areaSelect','area'],['parentSelect','parent'],['effortSelect','effort'],['confidenceSelect','confidence'],['sortSelect','sort']])$(id).addEventListener('change',e=>{state[key]=e.target.value;if(key==='area')state.parent='';render();});
$('resetFilters').onclick=reset;
function startPriorities(){scopeTo('all');state.priorities.add('P1');state.view='list';render();$('workSection').scrollIntoView({block:'start'});}
$('priorityStart').onclick=startPriorities;$('p1Overview').onclick=startPriorities;
$('exploreMap').onclick=()=>{$('workSection').scrollIntoView({block:'start'});};
document.querySelector('.brand').onclick=e=>{e.preventDefault();scopeTo('all');window.scrollTo({top:0});};
$('menuButton').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('menuButton').setAttribute('aria-expanded',open);};
document.addEventListener('pointerdown',e=>{if(window.innerWidth<=760&&!e.target.closest('.sidebar')&&!e.target.closest('#menuButton')){$('sidebar').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false');}});
$('filterToggle').onclick=()=>{const hidden=!$('filterBody').hidden;$('filterBody').hidden=hidden;$('filterToggle').setAttribute('aria-expanded',!hidden);};
for(const id of ['aboutButton','detailsButton'])$(id).onclick=()=>$('aboutDialog').showModal();
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('drawerFocus').onclick=()=>toggleFocus(currentTask);
$('taskNote').addEventListener('input',e=>{if(currentTask){if(e.target.value)saved.notes[currentTask]=e.target.value;else delete saved.notes[currentTask];persist();}});
$('taskDialog').addEventListener('close',()=>{currentTask=null;render();});
$('copyTask').onclick=()=>{const t=byId.get(currentTask);copyText(`✅ #${t.original_id} ${t.title}\n${t.areaTitle} → ${t.parentId}: ${t.parentTitle}\n${t.priority} | Importance ${t.importance}/10 | Active effort ${t.active_effort} | Estimate confidence ${confidenceNames[t.estimate_confidence]}\n${t.condition}${saved.notes[t.original_id]?'\nNote: '+saved.notes[t.original_id]:''}`);};
$('exportButton').onclick=()=>{const rows=[['Original ID','Rank','Priority','Importance / 10','Active effort','Estimate confidence','Area','Parent ID','Parent group','Task','Original title','Condition','In my focus','Personal note'],...filtered().map(t=>[t.original_id,t.rank,t.priority,t.importance,t.active_effort,confidenceNames[t.estimate_confidence],t.areaTitle,t.parentId,t.parentTitle,t.title,t.original_title,t.condition,isFocused(t.original_id)?'Yes':'No',saved.notes[t.original_id]||''])];const csv=rows.map(row=>row.map(value=>{let s=String(value);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');download('orbit-tasks-'+data.as_of+'.csv','\ufeff'+csv,'text/csv;charset=utf-8');toast(`Exported ${rows.length-1} tasks from the current view.`);};
$('backupButton').onclick=()=>{download('orbit-planning-backup.json',JSON.stringify({format:'dolce-orbit-v1',snapshot:data.as_of,...saved},null,2),'application/json');toast('Planning backup exported.');};
$('importBackup').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error();const input=JSON.parse(await file.text());if(input.format!=='dolce-orbit-v1'||!Array.isArray(input.focus)||!input.notes||typeof input.notes!=='object'||Array.isArray(input.notes))throw Error();const focus=input.focus.filter(id=>byId.has(id));const notes=Object.fromEntries(Object.entries(input.notes).filter(([id,note])=>byId.has(Number(id))&&typeof note==='string'));saved.focus=[...new Set([...saved.focus,...focus])];for(const [id,note] of Object.entries(notes))if(!saved.notes[id])saved.notes[id]=note;persist();render();toast('Backup merged. Existing notes were preserved.');}catch{toast('This file is not a valid Orbit planning backup.');}e.target.value='';};
document.addEventListener('keydown',e=>{const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);if(e.key==='/'&&!editing&&!document.querySelector('dialog[open]')){e.preventDefault();$('searchInput').focus();$('workSection').scrollIntoView({block:'start'});}if(e.key==='Escape'){$('sidebar').classList.remove('open');$('menuButton').setAttribute('aria-expanded','false');}});
render();
if(!storageAvailable)toast('Browser storage unavailable. Planning changes need a backup export.');
})();
