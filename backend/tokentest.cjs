const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const env = fs.readFileSync('/root/shipin-cinematic-studio/backend/.env','utf8');
  const m = env.match(/JWT_SECRET\s*=\s*["']?([^\s"']+)/);
  const secret = m ? m[1] : '';
  if (!secret) { console.log('NO SECRET'); process.exit(1); }
  // 用创始节点（掌柜）- 找 username 或 email 含 掌柜/南波 或 uid FOUNDER_UUID
  const FOUNDER = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  let u = await p.user.findUnique({ where: { id: FOUNDER } });
  if (!u) u = await p.user.findFirst({ orderBy: { lastActiveAt: 'desc' } });
  if (!u) { console.log('NO USER'); process.exit(1); }
  const uid = u.id, tv = u.tokenVersion || 0;
  const now = Math.floor(Date.now()/1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = b64({alg:'HS256',typ:'JWT'}) + '.' + b64({id:uid, email:(u.email||''), tokenVersion:tv, iat:now, exp:now+3600});
  const token = data + '.' + crypto.createHmac('sha256', secret).update(data).digest('base64url');
  console.log('USER:', uid, 'tokenVersion:', tv);
  function get(path){
    return new Promise(res=>{
      const req = http.request({host:'127.0.0.1', port:4002, path, headers:{Authorization:'Bearer '+token}}, r=>{
        let b=''; r.on('data',d=>b+=d); r.on('end',()=>res({code:r.statusCode, body:b}));
      });
      req.on('error',e=>res({code:'ERR', body:e.message}));
      req.end();
    });
  }
  for (const pth of ['/api/tea/wallet','/api/tea/chain','/api/tea/chain/verify','/api/tea/chain/blocks','/api/tea/chain/trace']){
    const r = await get(pth);
    console.log('\n### ' + pth + ' -> ' + r.code);
    console.log(String(r.body).slice(0,1000).replace(/\n/g,' '));
  }
  process.exit(0);
})().catch(e=>{console.error('E2E ERR:', e.message); process.exit(1);});
