
const { PrismaClient } = require('./node_modules/@prisma/client');
(async()=>{
  const p = new PrismaClient();
  try{
    const rows = await p.$queryRawUnsafe(`SELECT "channelId","channelType",uid,role,"name" FROM "imChannelMember" WHERE "channelId" LIKE 'grp\\_%' ORDER BY role DESC LIMIT 30`);
    console.log('grp members:', JSON.stringify(rows,null,0));
  }catch(e){ console.log('ERR1:', e.message); }
  try{
    const g = await p.imGroup.findMany({ take: 10, select: { id:true, name:true, ownerUid:true }});
    console.log('groups:', JSON.stringify(g));
  }catch(e){ console.log('ERR2:', e.message); }
  await p.$disconnect();
})();
