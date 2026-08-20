const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const uid of ['4e2f6062-956f-4d9e-96c2-2d266ec8efa8', '0ba5bf98-7005-4019-a431-6a0fb4b2d28d']) {
    try {
      const u = await p.user.findUnique({ where: { id: uid }, select: { tokenVersion: true } });
      console.log(uid.slice(0, 8), 'tokenVersion:', u ? u.tokenVersion : 'null');
    } catch (e) { console.log(uid.slice(0, 8), 'ERR', e.message.slice(0, 80)); }
  }
  // ESCROW 是否存在
  const w = await p.$queryRawUnsafe('select gongfen from tea_wallet where uid=$1', 'PLATFORM_ESCROW');
  console.log('escrow rows:', w.length, w.length ? w[0].gongfen : '');
  process.exit(0);
})().catch(e => { console.log('ER', e.message.slice(0, 120)); process.exit(1); });
