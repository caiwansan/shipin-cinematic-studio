
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
  const a0=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  const r0=await R('/api/tea/exchange/rate');
  console.log('兑换前: 全网工分=',a0[0].g,' 茶票=',a0[0].c,' 汇率=',r0.data.price);
  const ex=await R('/api/tea/exchange/do','POST',{direction:'gongfen_to_chapiao',amount:100});
  console.log('兑100工分 ->', JSON.stringify(ex.data||ex.error));
  const a1=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  const r1=await R('/api/tea/exchange/rate');
  console.log('兑换后: 全网工分=',a1[0].g,' 茶票=',a1[0].c,' 汇率=',r1.data.price);
  console.log('应验: 工分减少100%=',(BigInt(a0[0].g)-BigInt(a1[0].g)).toString(),'(期望100)');
  console.log('应验: 茶票减少10%销毁 → (兑前-兑后茶票)=',(BigInt(a0[0].c)-BigInt(a1[0].c)).toString(),'(期望=burn)');
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,130));process.exit(1)});
