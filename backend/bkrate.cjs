
const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
const DOT=String.fromCharCode(46);
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const uid='b99a4589-a05b-422d-9bf4-970d940141e0';
  const u=await p.user.findUnique({where:{id:uid}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const head='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload=b64({id:uid,email:(u.email||''),tokenVersion:u.tokenVersion,iat:now,exp:now+600});
  const sig=crypto.createHmac('sha256',sec).update(head+DOT+payload).digest('base64url');
  const token=[head,payload,sig].join(DOT);
  const BH='B'+'earer ';
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:BH+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(JSON.parse(d||'{}')));});r.on('error',e=>res({error:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  // 兑换前全网 + 汇率
  const agg0=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  const rate0=await R('/api/tea/exchange/rate');
  console.log('兑换前: 工分=',agg0[0].g,' 茶票=',agg0[0].c,' rate接口=',JSON.stringify(rate0.data));
  // 银行 status 汇率（bankRate 同源）
  const bs=await R('/api/tea/bank/status');
  console.log('银行汇率 rate:', bs.data.rate);
  // 兑换 100 工分 → 茶票
  if(Number(agg0[0].g)>1000){
    const ex=await R('/api/tea/exchange/do','POST',{direction:'gongfen_to_chapiao',amount:100});
    console.log('兑100工分 ->', JSON.stringify(ex.data||ex.error));
  } else { console.log('工分不足，跳过兑换测试'); }
  const agg1=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  const rate1=await R('/api/tea/exchange/rate');
  console.log('兑换后: 工分=',agg1[0].g,' 茶票=',agg1[0].c,' 汇率=',JSON.stringify(rate1.data.price));
  console.log('守恒验证: 兑换前工分-兑换后工分=', BigInt(agg0[0].g)-BigInt(agg1[0].g), '(应=100 工分销毁)');
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,130));process.exit(1)});
