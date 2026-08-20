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
  const token=[head,payload,sig].join('.');
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:['B','earer',' '].join('')+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res({code:x.statusCode,body:d}));});r.on('error',e=>res({code:'ERR',body:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const show=async(lb,p,m,b)=>{const r=await R(p,m,b);console.log('['+lb+'] '+p+' -> '+r.code+' '+String(r.body).slice(0,260).replace(/\n/g,' '));};
  await show('A-初始状态','/api/tea/storage/status');
  await show('B-生成助记词','/api/tea/storage/mnemonic','POST');
  await show('C-生成后状态(应mnemonicSet:true)','/api/tea/storage/status');
  await show('D-备份','/api/tea/storage/backup','POST');
  await show('E-备份列表','/api/tea/storage/backups');
  await show('F-恢复(错误助记词应403)','/api/tea/storage/restore','POST',{mnemonic:'wrong word list here'});
  await show('G-重置助记词','/api/tea/storage/mnemonic/reset','POST');
  await show('H-重置后状态(mnemonicSet:false)','/api/tea/storage/status');
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
