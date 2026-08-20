const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const seller = '4e2f6062-956f-4d9e-96c2-2d266ec8efa8';
  const founder = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  let u;
  try { const r = await p.$queryRawUnsafe('select token_version as tv, inviter_id as inv, username from public."User" where id=$1', seller); u = r[0]; } catch (e) { u = null; }
  console.log('seller row:', u ? JSON.stringify(u) : 'ERR ' + (u2m()));
  function u2m(){ return '' }
  try { const r = await p.$queryRawUnsafe('select "tokenVersion" as tv, username from public."User" where id=$1', seller); console.log('seller b:', JSON.stringify(r[0])); } catch (e) { console.log('seller b ERR', e.message.slice(0,80)); }
  for (const uid of [seller, founder, 'PLATFORM_ESCROW']) {
    const w = await p.$queryRawUnsafe('select gongfen from tea_wallet where uid=$1', uid);
    console.log(uid.slice(0, 12), 'gongfen:', w.length ? w[0].gongfen : 'NO-WALLET');
  }
  process.exit(0);
})().catch(e => { console.log('ER', e.message.slice(0, 150)); process.exit(1); });
