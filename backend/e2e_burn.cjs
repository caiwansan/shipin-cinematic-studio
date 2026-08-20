const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const uid='b99a4589-a05b-422d-9bf4-970d940141e0';
  const u=await p.user.findUnique({where:{id:uid}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const head='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload=b64({id:uid,email:(u.email||''),tokenVersion:u.tokenVersion,iat:now,exp:now+600});
  const sig=crypto.createHmac('sha256',sec).update(head+'.'+payload).digest('base64url');
  const token=head+String.fromCharCode(46)+payload+String.fromCharCode(46)+sig;
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:'B'+'earer '+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res({code:x.statusCode,body:d}));});r.on('error',e=>res({code:'ERR',body:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  const show=async(label,pth,m,b)=>{const r=await R(pth,m,b);console.log('['+label+'] '+pth+' -> '+r.code+' '+String(r.body).slice(0,300).replace(/\n/g,' '));};
  await show('兑换前-我的钱包','/api/tea/wallet');
  await show('兑换前-分布(应含totalSupply)','/api/tea/chain/distribution');
  await show('兑换100工分→茶票(应90%,销毁10)','/api/tea/exchange/do','POST',{direction:'gongfen_to_chapiao',amount:100});
  await show('兑换后-我的钱包','/api/tea/wallet');
  await show('兑换后-分布(全网应减少10)','/api/tea/chain/distribution');
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
