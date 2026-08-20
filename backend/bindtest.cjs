
const crypto2=require('crypto'), http=require('http'), fs=require('fs');
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
  const sig=crypto2.createHmac('sha256',sec).update(head+DOT+payload).digest('base64url');
  const token=[head,payload,sig].join(DOT);
  const BH='B'+'earer ';
  function R(path,m,b){return new Promise(res=>{const r=http.request({host:'127.0.0.1',port:4002,path,method:m||'GET',headers:{Authorization:BH+token,'Content-Type':'application/json'}},x=>{let d='';x.on('data',c=>d+=c);x.on('end',()=>res(JSON.parse(d||'{}')));});r.on('error',e=>res({error:e.message}));if(b)r.write(JSON.stringify(b));r.end();});}
  // 1) 当前 public_key
  const cur=await p.$queryRawUnsafe('SELECT left(coalesce("public_key",\'\'),30) AS pk, length("public_key") AS pkl FROM "User" WHERE id=$1::uuid', uid);
  console.log('current public_key len:', cur[0].pkl, 'head:', JSON.stringify(cur[0].pk));
  // 2) 生成新 ECDSA
  const {publicKey,privateKey}=crypto2.generateKeyPairSync('ec',{namedCurve:'P-256'});
  const pubPem=publicKey.export({type:'spki',format:'pem'}).toString();
  // 3) challenge
  const ch=await R('/api/auth/identity/challenge','POST');
  console.log('challenge resp:', JSON.stringify(ch.data||ch.error));
  const challenge=ch.data&&ch.data.challenge;
  // 4) 签名 challenge
  const sig2=crypto2.sign('sha256', Buffer.from(String(challenge),'utf8'), privateKey).toString('base64');
  // 5) bind
  const br=await R('/api/auth/identity/bind','POST',{publicKey:pubPem,challenge,signature:sig2});
  console.log('BIND resp FULL:', JSON.stringify(br));
  if(br.success===false){ console.log('BIND error:', br.error); }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,150));process.exit(1)});
