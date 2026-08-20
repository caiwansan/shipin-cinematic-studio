const crypto=require('crypto');const fs=require('fs');
const env=fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
const sec=(env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/)||[])[1];
const uid='0ba5bf98-7005-4019-a431-6a0fb4b2d28d', tv=288;
const now=Math.floor(Date.now()/1000);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const data=b64({alg:'HS256',typ:'JWT'})+'.'+b64({id:uid,email:'t@t.com',tokenVersion:tv,iat:now,exp:now+3600});
const token=data+'.'+crypto.createHmac('sha256',sec).update(data).digest('base64url');
console.log(token);
