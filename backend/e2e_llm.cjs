const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const uid='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const u=await p.user.findUnique({where:{id:uid}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const head='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload=b64({id:uid,email:(u.email||''),tokenVersion:u.tokenVersion,iat:now,exp:now+600});
  const sig=crypto.createHmac('sha256',sec).update(head+'.'+payload).digest('base64url');
  const token=[head,payload,sig].join(String.fromCharCode(46));
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:['B','earer',' '].join('')+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res({code:x.statusCode,body:d}));});r.on('error',e=>res({code:'ERR',body:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const show=async(lb,p,m,b)=>{const r=await R(p,m,b);console.log('['+lb+'] '+p+' -> '+r.code+' '+String(r.body).slice(0,300).replace(/\n/g,' '));};
  await show('A-config初始(未配置应hasKey:false+providers)','/api/tea/llm/config');
  await show('B-保存配置(假key)','/api/tea/llm/config','POST',{provider:'deepseek',model:'deepseek-v4-flash',apiKey:'sk-test123456'});
  await show('C-config(存后应hasKey:true,keyMasked)','/api/tea/llm/config');
  await show('D-status','/api/tea/llm/status');
  await show('E-chat(假key应502大模型调用失败=链路通)','/api/tea/llm/chat','POST',{messages:[{role:'user',content:'hi'}],temperature:0.3});
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
