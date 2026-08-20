const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const total = await p.$queryRawUnsafe("select count(*)::int as c from tea_post where scope='public' and deleted=false");
  const byUid = await p.$queryRawUnsafe("select uid, count(*)::int as c from tea_post where scope='public' and deleted=false group by uid order by c desc");
  console.log('public count:', total[0].c);
  console.log('by uid:', JSON.stringify(byUid.map(r => [String(r.uid).slice(0,8), r.c])));
  const recent = await p.$queryRawUnsafe("select id, uid, created_at from tea_post where scope='public' and deleted=false order by created_at desc limit 5");
  console.log('recent ids:', JSON.stringify(recent.map(r => String(r.id).slice(0,12))));
  process.exit(0);
})().catch(e => { console.log('ER', e.message.slice(0, 120)); process.exit(1); });
