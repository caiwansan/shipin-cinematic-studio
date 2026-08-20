const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ss = await p.paymentSecret.findMany();
  console.log(JSON.stringify(ss.map(x => ({ channel: x.channel, enabled: x.enabled, configKeys: x.config ? Object.keys(typeof x.config === 'string' ? JSON.parse(x.config) : x.config) : [] })), null, 1));
  await p.$disconnect();
})();
