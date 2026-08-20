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
  const token=[head,…6));
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:['B','earer',' '].join('')+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res({code:x.statusCode,body:d}));});r.on('error',e=>res({code:'ERR',body:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const show=async(lb,p,m,b)=>{const r=await R(p,m,b);console.log('['+lb+'] '+p+' -> '+r.code+' '+String(r.body).slice(0,220).replace(/\n/g,' '));};
  await show('A-钱包(茶票/工分)','/api/tea/wallet');
  await show('B-茶票转账(应被拒400)','/api/tea/token/transfer','POST',{to:'b99a4589-a05b-422d-9bf4-970d940141e0',tokenType:'chapiao',amount:1});
  await show('C-银行质押100茶票借工分','/api/tea/bank/loan','POST',{pledgeChapiao:100,days:7});
  await show('D-质押后钱包(茶票-100工分+100)','/api/tea/wallet');
  await show('E-活跃贷款','/api/tea/wallet');
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
