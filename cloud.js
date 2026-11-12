/* Piece Plus optional cloud extension.
   Does not activate without configured dedicated Supabase instance.
   Local data remains usable when offline / signed out. */
(()=>{'use strict';
const CONF=window.PIECE_CLOUD_CONFIG||{}, STORE='piece_plus_v1', TOMBS='piece_plus_tombstones_v1';
const $=id=>document.getElementById(id);
let client=null, user=null, busy=false, syncTimer=null;
const htmlSafe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const configured=Boolean(CONF.supabaseUrl&&CONF.publishableKey);
const getData=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}};
const getTombs=()=>{try{return JSON.parse(localStorage.getItem(TOMBS)||'{}')}catch{return {}}};
const setTombs=t=>localStorage.setItem(TOMBS,JSON.stringify(t));
const status=(msg,kind='')=>{let box=$('cloudStatus');if(box){box.textContent=msg;box.dataset.state=kind;}};
const aiStatus=msg=>{let el=$('aiStatus');if(el)el.textContent=msg;};
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateOrNow=v=>Number.isFinite(Date.parse(v))?new Date(v).toISOString():new Date().toISOString();
function ui(){
  const settings=$('page-settings')?.querySelector('.card');if(settings){
    let box=document.createElement('div');box.className='card';box.id='cloudCard';
    box.innerHTML='<h3>☁ 云端同步 <span class="pill">可选</span></h3>'+
    '<p class="muted">登录后将本地笔记和学习记录同步到你的个人云端。首次使用会合并本机和云端数据，保持本机离线副本。仍可定期导出 JSON 备份。</p>'+
    '<div id="cloudSignedOut"><label for="cloudEmail">邮箱</label><input id="cloudEmail" type="email" autocomplete="email" placeholder="you@example.com" class="cloud-input">'+
    '<div class="buttons left"><button class="btn primary" type="button" id="cloudLogin">发送登录邮件 →</button></div></div>'+
    '<div id="cloudSignedIn" class="hidden"><p class="muted" id="cloudUser"></p><div class="buttons left"><button class="btn primary" id="cloudSync" type="button">立即同步 ↻</button><button class="btn subtle" id="cloudLogout" type="button">退出云端账号</button></div></div>'+
    '<p class="micro" id="cloudStatus" aria-live="polite"></p><div class="warning">登录邮件由 Supabase 发送；邮件链接需从当前站点域名返回。没有配置云端前，此功能将不可用。云端版本不是端到端加密。</div>';
    settings.parentNode.insertBefore(box,settings);
    $('cloudLogin').addEventListener('click',login);
    $('cloudSync').addEventListener('click',()=>syncNow(true));
    $('cloudLogout').addEventListener('click',logout);
    $('cloudEmail').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();login();}});
  }
  const form=$('noteForm');if(form){
    let box=document.createElement('section');box.className='ai-panel';box.innerHTML=
    '<h3>✧ AI 思考搭档 <span class="pill">免费额度内</span></h3>'+
    '<p class="muted">先写自己的理解，再请 AI 点评、追问或帮你进一步思考。不会自动保存 AI 回答。</p>'+
    '<div class="buttons left"><button type="button" class="btn subtle" data-ai="feedback">点评我的理解</button>'+
    '<button type="button" class="btn subtle" data-ai="question">追问我一个问题</button>'+
    '<button type="button" class="btn subtle" data-ai="deepen">进一步探索</button></div>'+
    '<p class="micro" id="aiStatus" aria-live="polite"></p><div id="aiResult" class="review-answer hidden" aria-live="polite"></div>';
    form.after(box);
    box.addEventListener('click',e=>{let b=e.target.closest('[data-ai]');if(b)askAI(b.dataset.ai);});
  }
}
async function initialize(){
  ui();
  if(!configured){
    status('云端尚未配置，当前笔记继续保存在本机。','offline');
    aiStatus('AI 服务正在配置，当前仍可正常离线学习。');
    $('cloudLogin')?.setAttribute('disabled','');
    document.querySelectorAll('[data-ai]').forEach(b=>b.disabled=true);
    return;
  }
  try{
    const m=await import('https://esm.sh/@supabase/supabase-js@2.57.0');
    client=m.createClient(CONF.supabaseUrl,CONF.publishableKey,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
    const {data:{session},error}=await client.auth.getSession();if(error)throw error;
    user=session?.user||null;renderAuth();
    client.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user||null,changed=next?.id!==user?.id;
      user=next;renderAuth();if(changed&&user)setTimeout(()=>syncNow(),0);
    });
    if(user)await syncNow();
  }catch(e){status('无法连接云端，已保留本机数据。'+(e?.message||''),'error');aiStatus('云端初始化失败，AI 暂不可用。');}
}
function renderAuth(){
 $('cloudSignedIn')?.classList.toggle('hidden',!user);
 $('cloudSignedOut')?.classList.toggle('hidden',!!user);
 if(user){$('cloudUser').textContent='已登录：'+(user.email||'');status('云端已连接，可以同步。','ok');aiStatus('先写两句话，再选择 AI 的反馈方式。');}
 else {status('尚未登录。','offline');aiStatus('请先在「备份」中登录云端账号后使用 AI。');}
 document.querySelectorAll('[data-ai]').forEach(b=>b.disabled=!user||!CONF.aiEndpoint);
}
async function login(){
 if(!client)return;
 let email=$('cloudEmail').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status('请输入有效邮箱地址。','error');return;}
 $('cloudLogin').disabled=true;status('正在发送登录邮件……');
 try{const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}});if(error)throw error;status('请检查邮件中的登录链接。首次使用可能需要检查垃圾邮件。','ok');}
 catch(e){status('发送失败：'+(e?.message||'未知错误'),'error');}
 finally{$('cloudLogin').disabled=false;}
}
async function logout(){if(!client)return;await client.auth.signOut();user=null;renderAuth();status('已退出云端账号，本机笔记仍保留。');}
function markDeleted(id){
 if(!id||typeof id!=='string')return;
 let t=getTombs();t[id]=new Date().toISOString();try{setTombs(t)}catch(e){}
 if(user)queueSync();
}
function queueSync(){if(!client||!user||busy)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(),2000);}
async function syncNow(manual=false){
 if(!client||!user||busy)return;
 busy=true;let syncButton=$('cloudSync');if(syncButton)syncButton.disabled=true;
 if(manual)status('正在合并本机与云端数据……');
 try{
   const {data:rows,error}=await client.from('piece_items').select('item_id,item_type,payload,updated_at,deleted_at').limit(10000);
   if(error)throw error;
   const snapshot=getData(), localNotes=Array.isArray(snapshot.notes)?snapshot.notes:[],localRead=new Set(Array.isArray(snapshot.read)?snapshot.read:[]);
   const tombs=getTombs(),cloudNotes=new Map(),cloudRead=new Set();
   for(const r of rows||[]){
     if(r.item_type==='note'&&r.item_id.startsWith('note:')){
       const id=r.item_id.slice(5);
       if(r.deleted_at){tombs[id]=dateOrNow(r.deleted_at);continue;}
       if(r.payload&&r.payload.id===id&&typeof r.payload.body==='string')cloudNotes.set(id,r.payload);
     }
     if(r.item_type==='progress'&&r.item_id==='read'&&Array.isArray(r.payload?.read))for(const id of r.payload.read)cloudRead.add(id);
   }
   const merged=new Map(cloudNotes);
   for(const note of localNotes){
     if(!note||typeof note.id!=='string'||typeof note.body!=='string')continue;
     let remote=merged.get(note.id);
     if(!remote||dateOrNow(note.updatedAt||note.createdAt)>=dateOrNow(remote.updatedAt||remote.createdAt))merged.set(note.id,note);
   }
   for(const [id,deletedAt] of Object.entries(tombs)){
     let existing=merged.get(id);
     if(!existing||dateOrNow(deletedAt)>=dateOrNow(existing.updatedAt||existing.createdAt))merged.delete(id);
     else delete tombs[id];
   }
   let incoming=[...merged.values()].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
   const read=[...new Set([...localRead,...cloudRead])];
   // Upload merged notes in bounded batches; only after successful upload update local snapshot.
   const changes=[];
   for(const n of incoming){
     const old=cloudNotes.get(n.id);
     if(!old||JSON.stringify(old)!==JSON.stringify(n))changes.push({user_id:user.id,item_id:'note:'+n.id,item_type:'note',payload:n,updated_at:dateOrNow(n.updatedAt||n.createdAt),deleted_at:null});
   }
   for(const [id,deletedAt] of Object.entries(tombs)){
     const row=rows.find(r=>r.item_id==='note:'+id);
     if(!row?.deleted_at)changes.push({user_id:user.id,item_id:'note:'+id,item_type:'note',payload:{},updated_at:dateOrNow(deletedAt),deleted_at:dateOrNow(deletedAt)});
   }
   changes.push({user_id:user.id,item_id:'read',item_type:'progress',payload:{read},updated_at:new Date().toISOString(),deleted_at:null});
   for(let i=0;i<changes.length;i+=100){let {error:e}=await client.from('piece_items').upsert(changes.slice(i,i+100),{onConflict:'user_id,item_id'});if(e)throw e;}
   setTombs(tombs);
   const changed=JSON.stringify(snapshot.notes||[])!==JSON.stringify(incoming)||JSON.stringify(snapshot.read||[])!==JSON.stringify(read);
   if(changed){
     localStorage.setItem(STORE,JSON.stringify({...snapshot,notes:incoming,read}));
     status('同步成功，已合并 '+incoming.length+' 条笔记。页面即将刷新。','ok');
     setTimeout(()=>location.reload(),700);
   }else status('已同步：'+incoming.length+' 条笔记、'+read.length+' 条已读记录。','ok');
 }catch(e){status('同步失败，本机数据未删除：'+(e?.message||'网络错误'),'error');}
 finally{busy=false;if(syncButton)syncButton.disabled=false;}
}
async function askAI(mode){
 if(!user||!client){aiStatus('请先登录云端账号。');return;}
 if(!CONF.aiEndpoint){aiStatus('免费 AI 端点尚未启用。');return;}
 let answer=$('noteBody')?.value.trim()||'';
 if(!answer){aiStatus('请先写下自己的理解或问题。');return;}
 let buttons=[...document.querySelectorAll('[data-ai]')];buttons.forEach(b=>b.disabled=true);aiStatus('AI 正在阅读你的理解……');
 try{
   const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw Error('登录已过期');
   const lesson=window.PIECE_LESSONS?.find(l=>l.id===$('noteLesson').value);
   const response=await fetch(CONF.aiEndpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},body:JSON.stringify({mode,topic:$('noteTopic').value,lesson:lesson?[lesson.title,lesson.body,lesson.prompt].join('\n'):'',answer})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'AI 服务暂不可用');
   $('aiResult').textContent=result.reply;$('aiResult').classList.remove('hidden');aiStatus('AI 的反馈仅供思考，不是事实核验结论。');
 }catch(e){aiStatus('暂时无法使用 AI：'+(e?.message||'网络错误'));}
 finally{buttons.forEach(b=>b.disabled=!user||!CONF.aiEndpoint);}
}
window.PieceCloud={markDeleted,queueSync,syncNow};
window.addEventListener('piece-plus:changed',queueSync);
initialize();
})();
