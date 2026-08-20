const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const FROM='b99a4589-a05b-422d-9bf4-970d940141e0', TO='0fdd3380-990e-477e-9750-514572000056';
  const fu=await p.user.findUnique({where:{id:FROM}}); const tu=await p.user.findUnique({where:{id:TO}});
  console.log('FROM tokenVersion=', fu.tokenVersion, 'TO tokenVersion=', tu.tokenVersion);
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const data=b64({alg:'HS256',typ:'JWT'})+'.'+b64({id:FROM,email:(fu.email||''),tokenVersion:fu.tokenVersion,iat:now,exp:now+600});
  const token=data+'.'+crypto.createHmac('sha256',sec).update(data).digest('base64url');
  function req(path,method,body){
    return new Promise(res=>{
      const r=http.request({host:'127.0.0.1',port:4002,path,method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}},x=>{
        let b='';x.on('data',d=>b+=d);x.on('end',()=>res({code:x.statusCode,body:b}));
      });
      r.on('error',e=>res({code:'ERR',body:e.message}));
      if(body)r.write(JSON.stringify(body));
      r.end();
    });
  }
  // 转账前余额
  const w0=JSON.parse((await req('/api/tea/wallet','GET')).body);
  console.log('转账前 (from): 工分=', w0.data.gongfen, '茶票=', w0.data.chapiao);
  // 转 1 工分给 TO
  const r=await req('/api/tea/token/transfer','POST',{to:TO,tokenType:'gongfen',amount:1,remark:'端到端验证-工分转账'});
  console.log('transfer ->', r.code, r.body.slice(0,300));
  // 转账后 + 流水
  const w1=JSON.parse((await req('/api/tea/wallet','GET')).body);
  console.log('转账后 (from): 工分=', w1.data.gongfen);
  const tx=JSON.parse((await req('/api/tea/wallet/txs?limit=3','GET')).body);
  console.log('最近流水:', JSON.stringify(tx.data.slice(0,3)).slice(0,600));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
