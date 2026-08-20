const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const ss = await p.paymentSecret.findMany();
  console.log(JSON.stringify(ss.map(x => ({ channel: x.channel, enabled: x.enabled, config: x.config ? (typeof x.config === 'string' ? x.config.slice(0, 300) : JSON.stringify(x.config).slice(0, 300)) : null })), null, 1));
  await p.$disconnect();
})();
