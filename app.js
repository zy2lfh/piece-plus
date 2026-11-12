/* Piece Plus v1. Browser-local by design: user outputs never leave this device. */
(()=>{'use strict';
const STORAGE='piece_plus_v1',DRAFT='piece_plus_draft_v1',BACKUP='piece_plus_last_backup_v1';
const L=window.PIECE_LESSONS||[];
const TOPICS=['日语','科学思维','技术创造','世界知识','经济投资','绘画艺术','生活思考'];
const GAP=[1,1,3,7,30,90];
const $=id=>document.getElementById(id);
let notes=[],readLessons=new Set(),kind='explain',editing=null,selectedLesson=null,chosenTopic='',chosenTime=3,reviewShown=false;
let keyword='',noteFilter='';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDay=(date=new Date())=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const plusDays=(day,amount)=>{let [y,m,d]=day.split('-').map(Number);return localDay(new Date(y,m-1,d+amount));};
const today=()=>localDay();
const dateLabel=s=>{let d=new Date(s);return Number.isNaN(d.getTime())?s:d.toLocaleDateString('zh-CN',{month:'short',day:'numeric'});};
const makeId=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
const msg=text=>{let el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(msg.timer);msg.timer=setTimeout(()=>el.classList.remove('show'),2500);};
const load=()=>{try{let d=JSON.parse(localStorage.getItem(STORAGE)||'{}');notes=Array.isArray(d.notes)?d.notes.filter(x=>x&&typeof x.id==='string'&&typeof x.body==='string'):[];readLessons=new Set(Array.isArray(d.read)?d.read:[]);}catch(e){notes=[];readLessons=new Set();}};
const persist=()=>{try{localStorage.setItem(STORAGE,JSON.stringify({version:1,notes,read:[...readLessons]}));window.dispatchEvent(new CustomEvent('piece-plus:changed'));return true;}catch(e){msg('本机保存失败，请检查浏览器存储权限');return false;}};
const due=n=>!n.review?.due||n.review.due<=today();
const getLesson=id=>L.find(x=>x.id===id);
function stats(){$('statLearn').textContent=readLessons.size;$('statWrite').textContent=notes.length;$('statReview').textContent=notes.filter(due).length;}
function tab(page){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===page));if(page==='library')renderNotes();if(page==='review')renderReview();if(page==='settings')renderBackup();window.scrollTo({top:0,behavior:'smooth'});}
function chooseLesson(id){selectedLesson=L.find(x=>x.id===id)||L[0];renderLesson();window.scrollTo({top:180,behavior:'smooth'});}
function availableLessons(){let v=L.filter(x=>!chosenTopic||x.topic===chosenTopic);return v.length?v:L;}
function renderLesson(){
 let s=selectedLesson;if(!s){$('lesson').innerHTML='<p>暂无学习内容</p>';return;}
 const isRead=readLessons.has(s.id);
 $('lesson').innerHTML='<div class="tagline"><span class="pill">'+escape(s.topic)+'</span><span>'+escape(s.level)+'</span><span>◷ '+s.minutes+' 分钟</span><span>'+ (isRead?'✓ 已读':'新内容') +'</span></div>'+
 '<h3>'+escape(s.title)+'</h3><p>'+escape(s.body)+'</p><div class="illustration"><b>举个例子</b><p>'+escape(s.example)+'</p></div><div class="promptbox"><b>✦ 换你来想</b><p>'+escape(s.prompt)+'</p></div>'+
 '<div class="buttons"><button class="btn subtle" id="markRead">'+(isRead?'✓ 已读 · 再次复习':'标记已读')+'</button><button class="btn primary" id="respondLesson">写下我的理解 →</button></div>';
 let group=availableLessons().filter(x=>x.id!==s.id),matches=group.filter(x=>x.minutes<=chosenTime);if(!matches.length)matches=group;
 $('lessonList').innerHTML=matches.slice(0,8).map(x=>'<button class="lesson-option" data-lesson="'+escape(x.id)+'"><span>'+escape(x.topic)+' · '+x.minutes+' 分钟'+(readLessons.has(x.id)?' · 已读':'')+'</span><b>'+escape(x.title)+'</b></button>').join('')||'<p class="muted">没有其他学习卡。</p>';
 $('markRead').addEventListener('click',()=>{readLessons.add(s.id);if(persist()){stats();renderLesson();msg('已记录阅读进度');}});
 $('respondLesson').addEventListener('click',()=>{prefillLesson(s.id);tab('write');});
}
function initChoices(){
 $('topicFilter').innerHTML='<option value="">全部领域</option>'+TOPICS.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join('');
 $('noteTopic').innerHTML=TOPICS.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join('');
 $('filterNotes').innerHTML='<option value="">所有领域</option>'+TOPICS.map(x=>'<option value="'+escape(x)+'">'+escape(x)+'</option>').join('');
 $('noteLesson').innerHTML='<option value="">不关联学习卡</option>'+L.map(x=>'<option value="'+escape(x.id)+'">'+escape(x.title)+'</option>').join('');
}
function prefillLesson(id){
 let l=getLesson(id);if(!l)return;$('noteLesson').value=id;$('noteTopic').value=l.topic;
 if(!editing&&!$('noteTitle').value)$('noteTitle').value=l.title;
 if(!editing&&!$('noteBody').value)$('noteBody').placeholder='这张卡片让我想到……\n'+l.prompt;
 saveDraft();
}
function chooseKind(k){
 if(!['explain','example','question'].includes(k))return;kind=k;
 document.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x.dataset.kind===kind));
 if(!$('noteBody').value)$('noteBody').placeholder=({explain:'我今天理解的是……\n换成自己的话就是……',example:'它让我想到生活里的例子……\n这个例子说明……',question:'我还有一个没弄明白的问题……\n我目前的猜测是……'})[kind];
 saveDraft();
}
function saveDraft(){if(editing)return;let d={kind,title:$('noteTitle').value,body:$('noteBody').value,topic:$('noteTopic').value,lessonId:$('noteLesson').value,source:$('noteSource').value};try{localStorage.setItem(DRAFT,JSON.stringify(d));}catch(e){}$('draftStatus').textContent=d.body.length+' 字 · 输入暂存在本机';}
function clearForm(){
 editing=null;$('noteTitle').value='';$('noteBody').value='';$('noteSource').value='';$('noteLesson').value='';$('saveNote').textContent='保存我的理解 →';$('cancelEdit').classList.add('hidden');
 try{localStorage.removeItem(DRAFT);}catch(e){}$('draftStatus').textContent='输入自动暂存到本机';
}
function loadDraft(){try{let d=JSON.parse(localStorage.getItem(DRAFT)||'null');if(!d)return;kind=d.kind||'explain';$('noteTitle').value=d.title||'';$('noteBody').value=d.body||'';$('noteTopic').value=TOPICS.includes(d.topic)?d.topic:'科学思维';$('noteLesson').value=getLesson(d.lessonId)?d.lessonId:'';$('noteSource').value=d.source||'';}catch(e){}chooseKind(kind);}
function saveNote(e){
 e.preventDefault();const body=$('noteBody').value.trim();if(!body){msg('请先写一点自己的理解');return;}
 const n={title:$('noteTitle').value.trim(),body,kind,topic:$('noteTopic').value,lessonId:$('noteLesson').value,source:$('noteSource').value.trim()};
 let before=notes.map(x=>({...x}));
 if(editing){let old=notes.find(x=>x.id===editing);if(!old)return;Object.assign(old,n,{updatedAt:new Date().toISOString()});}
 else notes.unshift({...n,id:makeId(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),review:{stage:0,due:plusDays(today(),1)}});
 if(!persist()){notes=before;return;}clearForm();stats();msg('已保存到你的知识库 ✓');tab('library');
}
function renderNotes(){
 const v=notes.filter(n=>(!noteFilter||n.topic===noteFilter)&&(!keyword||(n.title+' '+n.body+' '+(n.source||'')+' '+n.topic+' '+(getLesson(n.lessonId)?.title||'')).toLowerCase().includes(keyword))).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 $('notesList').innerHTML=v.length?v.map(n=>
 '<article class="entry"><div class="entry-title"><b>'+escape(n.title||n.topic+' · '+(n.kind==='question'?'追问':n.kind==='example'?'例子':'理解'))+'</b><span class="pill">'+escape(n.topic)+'</span></div>'+
 '<div class="meta">'+escape(dateLabel(n.createdAt))+(getLesson(n.lessonId)?' · '+escape(getLesson(n.lessonId).title):'')+(due(n)?' · 待复习':'')+'</div>'+
 '<p>'+escape(n.body)+'</p>'+(n.source?'<div class="meta">来源：'+escape(n.source)+'</div>':'')+
 '<div class="entry-actions"><button class="btn subtle" data-note-action="edit" data-id="'+escape(n.id)+'">继续补充</button><button class="btn" data-note-action="copy" data-id="'+escape(n.id)+'">复制</button><button class="btn danger" data-note-action="delete" data-id="'+escape(n.id)+'">删除</button></div></article>').join(''):'<div class="empty">'+(notes.length?'没有符合条件的笔记。':'还没有自己的输出。<br>试着从一张学习卡开始写两句话。')+'</div>';
}
function editNote(id){
 let n=notes.find(x=>x.id===id);if(!n)return;editing=n.id;kind=n.kind||'explain';
 $('noteTitle').value=n.title||'';$('noteBody').value=n.body;$('noteTopic').value=n.topic;$('noteLesson').value=getLesson(n.lessonId)?n.lessonId:'';$('noteSource').value=n.source||'';
 chooseKind(kind);$('saveNote').textContent='保存修改 →';$('cancelEdit').classList.remove('hidden');tab('write');
}
function removeNote(id){if(!confirm('确定删除这条笔记？删除后无法撤销。'))return;window.PieceCloud?.markDeleted(id);let prev=notes;notes=notes.filter(x=>x.id!==id);if(!persist()){notes=prev;return;}stats();renderNotes();msg('笔记已删除');}
function renderReview(){
 let v=notes.filter(due).sort((a,b)=>(a.review?.due||'').localeCompare(b.review?.due||''));
 if(!notes.length){$('reviewBox').innerHTML='<div class="empty">先写下第一条理解，明天就能开始主动回忆。</div>';return;}
 if(!v.length){$('reviewBox').innerHTML='<div class="empty">✓ 今天的复习完成了。下次回来再看看还记得多少。</div>';return;}
 let n=v[0];reviewShown=false;
 $('reviewBox').innerHTML='<p class="micro">今天还有 '+v.length+' 条待复习</p><h3>'+escape(n.title||getLesson(n.lessonId)?.title||n.topic)+'</h3>'+
 (getLesson(n.lessonId)?'<p class="muted">相关学习卡：'+escape(getLesson(n.lessonId).title)+'</p>':'')+
 '<div id="answer" class="review-answer hidden">'+escape(n.body)+'</div><div class="buttons left" id="revealGroup"><button class="btn primary" id="showAnswer">显示我之前的理解</button></div>'+
 '<div class="buttons left hidden" id="gradeGroup"><button class="btn subtle" data-grade="again" data-id="'+escape(n.id)+'">还模糊 · 明天复习</button><button class="btn primary" data-grade="good" data-id="'+escape(n.id)+'">记住了 · 延后复习</button></div>';
 $('showAnswer').addEventListener('click',()=>{$('answer').classList.remove('hidden');$('gradeGroup').classList.remove('hidden');$('revealGroup').classList.add('hidden');reviewShown=true;});
}
function grade(id,good){let n=notes.find(x=>x.id===id);if(!n)return;let prev=n.review;let stage=good?Math.min(5,Number(n.review?.stage||0)+1):0;n.review={stage,due:plusDays(today(),GAP[stage]),lastReviewed:today()};if(!persist()){n.review=prev;return;}stats();renderReview();msg('已更新下一次复习日期');}
function exportData(){
 let data={format:'piece_plus',version:1,exportedAt:new Date().toISOString(),notes,read:[...readLessons]};let blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});let u=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=u;a.download='piece-plus-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1800);
 try{localStorage.setItem(BACKUP,today());}catch(e){}renderBackup();msg('已生成备份文件');
}
function renderBackup(){let d='';try{d=localStorage.getItem(BACKUP)||'';}catch(e){}$('backupStatus').textContent='共 '+notes.length+' 条输出'+(d?' · 上次导出备份：'+d:' · 尚未记录导出备份');}
async function importData(file){
 if(!file)return;if(file.size>6e6){msg('文件过大');return;}
 try{
 let data=JSON.parse(await file.text()),source=data.format,arr=source==='piece_plus'?data.notes:source==='jiri_outputs'?data.entries:null;
 if(!Array.isArray(arr)||arr.length>25000)throw Error('不支持的 JSON 格式');
 let normalized=arr.filter(x=>x&&typeof x.id==='string'&&typeof x.body==='string'&&x.body.trim().length&&x.body.length<=8000&&typeof x.createdAt==='string').map(n=>({
 id:n.id,body:n.body,title:String(n.title||'').slice(0,120),topic:TOPICS.includes(n.topic)?n.topic:'生活思考',
 kind:['explain','example','question'].includes(n.kind)?n.kind:'explain',lessonId:getLesson(n.lessonId)?n.lessonId:'',
 source:String(n.source||'').slice(0,200),createdAt:n.createdAt,updatedAt:n.updatedAt||n.createdAt,
 review:n.review&&typeof n.review.due==='string'?{stage:Math.max(0,Math.min(5,Number(n.review.stage)||0)),due:n.review.due,lastReviewed:n.review.lastReviewed||null}:{stage:0,due:plusDays(today(),1)}
 }));
 if(!normalized.length)throw Error('没有可用笔记');
 if(!confirm('将合并导入 '+normalized.length+' 条笔记。相同 ID 的记录会保留现有版本。继续吗？'))return;
 let beforeNotes=notes,beforeRead=readLessons,seen=new Set(notes.map(n=>n.id));let added=0;notes=notes.slice();
 for(let n of normalized)if(!seen.has(n.id)){notes.push(n);seen.add(n.id);added++;}
 if(source==='piece_plus'&&Array.isArray(data.read))readLessons=new Set([...readLessons,...data.read.filter(id=>getLesson(id))]);
 if(!persist()){notes=beforeNotes;readLessons=beforeRead;return;}
 stats();renderNotes();renderReview();renderBackup();msg('导入成功：新增 '+added+' 条');
 }catch(e){msg('导入失败：'+e.message);}
}
function bind(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>chooseKind(b.dataset.kind)));
 $('timeFilter').addEventListener('click',e=>{let b=e.target.closest('[data-time]');if(!b)return;chosenTime=Number(b.dataset.time);$('timeFilter').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));let v=availableLessons().filter(x=>x.minutes<=chosenTime);chooseLesson((v.length?v:availableLessons())[0].id);});
 $('topicFilter').addEventListener('change',e=>{chosenTopic=e.target.value;let v=availableLessons().filter(x=>x.minutes<=chosenTime);chooseLesson((v.length?v:availableLessons())[0].id);});
 $('surprise').addEventListener('click',()=>{let a=availableLessons().filter(x=>x.id!==selectedLesson?.id);if(!a.length)a=availableLessons();chooseLesson(a[Math.floor(Math.random()*a.length)].id);});
 $('lessonList').addEventListener('click',e=>{let b=e.target.closest('[data-lesson]');if(b)chooseLesson(b.dataset.lesson);});
 ['noteBody','noteTitle','noteTopic','noteLesson','noteSource'].forEach(id=>$(id).addEventListener('input',saveDraft));
 $('noteForm').addEventListener('submit',saveNote);$('cancelEdit').addEventListener('click',()=>{clearForm();loadDraft();msg('已取消编辑');});
 $('searchNotes').addEventListener('input',e=>{keyword=e.target.value.trim().toLowerCase();renderNotes();});
 $('filterNotes').addEventListener('change',e=>{noteFilter=e.target.value;renderNotes();});
 $('notesList').addEventListener('click',e=>{let b=e.target.closest('[data-note-action]');if(!b)return;let id=b.dataset.id;
 if(b.dataset.noteAction==='edit')editNote(id);if(b.dataset.noteAction==='delete')removeNote(id);
 if(b.dataset.noteAction==='copy'){let n=notes.find(x=>x.id===id);if(n&&navigator.clipboard?.writeText)navigator.clipboard.writeText((n.title?n.title+'\n':'')+n.body).then(()=>msg('已复制')).catch(()=>msg('复制失败'));else msg('浏览器不支持复制');}
 });
 $('reviewBox').addEventListener('click',e=>{let b=e.target.closest('[data-grade]');if(b&&reviewShown)grade(b.dataset.id,b.dataset.grade==='good');});
 $('exportData').addEventListener('click',exportData);$('exportTop').addEventListener('click',exportData);$('importButton').addEventListener('click',()=>$('importFile').click());
 $('importFile').addEventListener('change',e=>{importData(e.target.files?.[0]);e.target.value='';});
}
initChoices();load();loadDraft();bind();chooseLesson(L[0]?.id);stats();renderNotes();renderReview();renderBackup();
})();