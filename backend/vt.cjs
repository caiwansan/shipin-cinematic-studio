const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe('select code, product_name, amount, status, seller_uid from city_biz_order order by id desc limit 10');
  console.log('ALL ORDERS:', JSON.stringify(rows.map(r => ({ code: r.code, p: r.product_name, amt: Number(r.amount), st: r.status, seller: (r.seller_uid || '').slice(0, 8) })), null, 0));
  process.exit(0);
})().catch(e => { console.log('ER', e.message.slice(0, 120)); process.exit(1); });
