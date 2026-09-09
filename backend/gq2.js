
const { PrismaClient } = require('./node_modules/@prisma/client');
(async()=>{
  const p = new PrismaClient();
  // 1) 用 Prisma client 查一个普通群的成员 role (群: gmsseh71t6la5 昆仑茶馆第二群)
  try{
    const chId = 'grp_gmsseh71t6la5';
    const mem = await p.imChannelMember.findMany({ where: { channelId: chId }, select: { channelType:true, uid:true, role:true, name:true } });
    console.log('grp members:', JSON.stringify(mem));
  }catch(e){ console.log('ERR1:', e.message); }
  // 2) 查 imGroup 表名找真实表名
  try{
    const raw = await p.$queryRawUnsafe(`SELECT table_name FROM information_schema.columns WHERE column_name='role' AND table_schema='public'`);
    console.log('tables with role col:', JSON.stringify(raw));
  }catch(e){ console.log('ERR2:', e.message); }
  await p.$disconnect();
})();
