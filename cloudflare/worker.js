// Deploy to a Cloudflare Workers Free project with the Workers AI binding named "AI".
// Configure SUPABASE_URL using Workers environment variables (not a secret).
// No API keys in frontend. Never accept arbitrary cross-origin requests.
const MODEL = "@cf/zai-org/glm-4.7-flash";
const ALLOWED_ORIGINS = new Set(["https://piece-plus.vercel.app"]);
const MAX_INPUT = 1800, MAX_CONTEXT = 2600;
const send = (data, status=200, origin="") => new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","access-control-allow-origin":ALLOWED_ORIGINS.has(origin)?origin:"https://piece-plus.vercel.app",
  "vary":"Origin","access-control-allow-headers":"authorization,content-type",
  "access-control-allow-methods":"POST,OPTIONS"}
});
export default {
 async fetch(request,env){
   const origin=request.headers.get("origin")||"";
   if(request.method==="OPTIONS") return ALLOWED_ORIGINS.has(origin)?new Response(null,{status:204,headers:{"access-control-allow-origin":origin,"access-control-allow-headers":"authorization,content-type","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"}}):new Response(null,{status:403});
   if(request.method!=="POST"||new URL(request.url).pathname!=="/feedback")return send({error:"Not found"},404,origin);
   if(!ALLOWED_ORIGINS.has(origin))return send({error:"Origin denied"},403,origin);
   if(!env.SUPABASE_URL||!env.AI)return send({error:"Service not configured"},503,origin);
   const bearer=request.headers.get("authorization")||"";
   if(!/^Bearer [a-zA-Z0-9._~-]{20,4096}$/.test(bearer))return send({error:"请先登录以使用 AI"},401,origin);
   // Verify user's JWT with Supabase Auth server-side. Do not trust JWT claims parsed in JS.
   let identity;
   try {
     const check=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/auth/v1/user",{headers:{
       authorization:bearer,apikey:env.SUPABASE_PUBLISHABLE_KEY}});
     if(!check.ok)return send({error:"请重新登录后再试"},401,origin);
     identity=await check.json();
     if(!identity?.id||identity.is_anonymous)return send({error:"账号验证失败"},401,origin);
   }catch{return send({error:"身份验证暂不可用"},503,origin);}
   // Approximate rate limit for free shared AI capacity (per user/location).
   if(env.RATE_LIMITER){
     const limit=await env.RATE_LIMITER.limit({key:identity.id});
     if(!limit.success)return send({error:"提问过于频繁，请一分钟后再试"},429,origin);
   }
   let input;try{input=await request.json();}catch{return send({error:"请求格式不正确"},400,origin);}
   const answer=String(input?.answer||"").trim();
   if(answer.length>MAX_INPUT)return send({error:"输入太长，请缩短后再试"},413,origin);
   const topic=String(input?.topic||"").trim().slice(0,80);
   const lesson=String(input?.lesson||"").trim().slice(0,MAX_CONTEXT);
   const mode=["feedback","question","deepen"].includes(input?.mode)?input.mode:"feedback";
   if(!answer)return send({error:"先写下你的问题或理解"},400,origin);
   const system="你是『积日』微学习网站的友好且严谨的中文苏格拉底式导师。根据用户自己的话互动。先给出一条具体的肯定，再指出最多两点可以改善之处，最后提出一个激发思考的追问。不得编造引用、研究或实时资料；不确定时说明。适合3-15分钟微学习。输出不超过220个中文字。";
   const user=JSON.stringify({mode,topic,lesson,userText:answer});
   try {
     const result=await env.AI.run(MODEL,{messages:[{role:"system",content:system},{role:"user",content:user}],max_tokens:380,temperature:0.55});
     const reply=String(result?.response||result?.choices?.[0]?.message?.content||"").trim();
     if(!reply) return send({error:"AI 暂时没有返回内容，请稍后再试"},503,origin);
     return send({reply,model:MODEL},200,origin);
   }catch(e){
     return send({error:"免费 AI 额度可能已满或服务暂不可用，请稍后再试"},503,origin);
   }
 }
};
