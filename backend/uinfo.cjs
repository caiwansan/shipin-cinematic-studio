const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async()=>{
  const u = await p.user.findFirst();
  console.log('uid=', u.id, 'tokenVersion=', u.tokenVersion || 0);
  process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
