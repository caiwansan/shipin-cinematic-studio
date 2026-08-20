const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const r = await p.$queryRawUnsafe("select name, kind from im_group where kind='clan'");
  console.log('clan groups:', JSON.stringify(r));
  process.exit(0);
})().catch(e=>{console.log('ER',e.message.slice(0,80));process.exit(1)});
