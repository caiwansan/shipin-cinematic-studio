const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // family_member 现有数据
  const mem = await p.$queryRawUnsafe('select group_id, count(*) as c from family_member group by group_id');
  console.log('family_member groups:', JSON.stringify(mem));
  // 我的 grp_ 群 + im_group 名
  const uid = '0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const mems = await p.$queryRawUnsafe("select channel_id, role from im_channel_members where uid=$1 and channel_type=4 and channel_id like 'grp_%'", uid);
  const gids = mems.map(m => String(m.channel_id).replace(/^grp_/, ''));
  if (gids.length) {
    const ig = await p.$queryRawUnsafe('select id, name from im_group where id = ANY($1)', gids);
    console.log('my grp groups:', JSON.stringify(ig));
  }
  console.log('all grp channels sample:', JSON.stringify((await p.$queryRawUnsafe("select distinct channel_id from im_channel_members where channel_type=4 and channel_id like 'grp_%' limit 20")).map(r => r.channel_id)));
  process.exit(0);
})().catch(e => { console.log('ER', e.message.slice(0, 150)); process.exit(1); });
