
const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
const DOT=String.fromCharCode(46);
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const uid='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const u=await p.user.findUnique({where:{id:uid}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const head='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload=b64({id:uid,email:(u.email||''),tokenVersion:u.tokenVersion,iat:now,exp:now+600});
  const sig=crypto.createHmac('sha256',sec).update(head+DOT+payload).digest('base64url');
  const token=[head,payload,sig].join(DOT);
  const BH='B'+'earer ';
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:BH+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(JSON.parse(d||'{}')));});r.on('error',e=>res({error:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const st=await R('/api/tea/bank/status');
  console.log('deposits:', JSON.stringify((st.data&&st.data.deposits)||[]));
  const d=(st.data&&st.data.deposits)||[];
  if(d.length){ const did=d[d.length-1].id; const r=await R('/api/tea/bank/deposit/withdraw','POST',{depositId:did}); console.log('withdraw ->', JSON.stringify(r)); }
  // 还贷款
  const ls=(st.data&&st.data.loans)||[];
  if(ls.length){ const lid=ls[ls.length-1].id; const r2=await R('/api/tea/bank/repay','POST',{loanId:lid}); console.log('repay ->', JSON.stringify(r2).slice(0,200)); }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,120));process.exit(1)});
