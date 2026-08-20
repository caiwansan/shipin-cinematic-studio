
const crypto=require('crypto'),fs=require('fs');
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
const DOT=String.fromCharCode(46);
(async()=>{
  const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
  const uid='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const u=await p.user.findUnique({where:{id:uid}});
  const tv=u.tokenVersion||0;
  const now=Math.floor(Date.now()/1000);
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const head='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const payload=b64({id:uid,email:(u.email||''),tokenVersion:tv,iat:now,exp:now+3600});
  const sig=crypto.createHmac('sha256',sec).update(head+DOT+payload).digest('base64url');
  console.log(head+DOT+payload+DOT+sig);
  console.log('TV=' + tv);
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
