const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const r = await p.$queryRawUnsafe('select id, group_name, status from family_clan_apply order by created_at desc limit 3');
  console.log('applies:', JSON.stringify(r));
  process.exit(0);
})().catch(e=>{console.log('ER',e.message.slice(0,80));process.exit(1)});
