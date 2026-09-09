
const { PrismaClient } = require('./node_modules/@prisma/client');
(async()=>{
  const p = new PrismaClient();
  const uid='4e2f6062-956f-4d9e-96c2-2d266ec8efa8';
  try{
    const u = await p.user.findUnique({ where:{ id: uid }, select:{ memberTier:true }});
    console.log('user:', JSON.stringify(u));
  }catch(e){ console.log('USER_ERR:', e.message); }
  try{
    const m = await p.membership.findUnique({ where:{ userId: uid }, select:{ tier:true }});
    console.log('mem:', JSON.stringify(m));
  }catch(e){ console.log('MEM_ERR:', e.message); }
  await p.$disconnect();
})();
