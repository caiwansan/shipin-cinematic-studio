const crypto=require('crypto'), http=require('http'), fs=require('fs');
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const TO='0fdd3380-990e-477e-9750-514572000056';
  const tu=await p.user.findUnique({where:{id:TO}});
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const data=b64({alg:'HS256',typ:'JWT'})+'.'+b64({id:TO,email:(tu.email||''),tokenVersion:tu.tokenVersion,iat:now,exp:now+600});
  const token=data+'.'+crypto.createHmac('sha256',sec).update(data).digest('base64url');
  function req(path){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,headers:{Authorization:'Bearer '+token}},x=>{let b='';x.on('data',d=>b+=d);x.on('end',()=>res(JSON.parse(b||'{}')));});r.on('error',e=>res({}));r.end();});}
  const w=await req('/api/tea/wallet');
  console.log('收款端 TO wallet: 工分=', w.data.gongfen, '茶票=', w.data.chapiao);
  const v=await req('/api/tea/chain/verify');
  console.log('链校验: chainOk=', v.data.chainOk, 'totalNodes=', v.data.totalNodes);
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
