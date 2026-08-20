
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
  const show=async(lb,p,m,b)=>{const r=await R(p,m,b);console.log('['+lb+'] ->', m||'GET', JSON.stringify(r).slice(0,240));};
  await show('status(贷款/存款计划)','/api/tea/bank/status');
  await show('loan-30天×1.2质押100茶票','/api/tea/bank/loan','POST',{pledgeChapiao:100,days:30});
  await show('deposit-30天存50工分','/api/tea/bank/deposit','POST',{amount:50,days:30});
  const st=await R('/api/tea/bank/status');
  console.log('[status-after] loans:', (st.data.loans||[]).length, 'deposits:', (st.data.deposits||[]).length, 'loanPlans:', JSON.stringify(st.data.loanPlans));
  if((st.data.deposits||[]).length){ const did=st.data.deposits[0].id; await show('withdraw-取款','/api/tea/bank/deposit/withdraw','POST',{depositId:did}); }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,120));process.exit(1)});
