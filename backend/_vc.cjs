const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const cols = await p.$queryRawUnsafe("select column_name from information_schema.columns where table_name='family_clan_apply' order by ordinal_position");
  console.log('cols:', cols.map(x=>x.column_name).join(','));
  process.exit(0);
})().catch(e=>{console.log('ER',e.message.slice(0,80));process.exit(1)});
