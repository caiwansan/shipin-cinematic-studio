
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  try{ await p.$executeRawUnsafe("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"); console.log('app_settings ok'); }catch(e){ console.log('ERS', String(e.message).slice(0,80)); }
  // 茶票市场最低 open 卖价
  try{ const m=await p.$queryRawUnsafe("SELECT MIN(price)::float8 AS minp, COUNT(*)::int AS n FROM tea_market_order WHERE status='open'"); console.log('market min open:', JSON.stringify(m)); }catch(e){ console.log('mk err', String(e.message).slice(0,60)); }
  // 茶票/open orders
  try{ const o=await p.$queryRawUnsafe("SELECT DISTINCT price::float8 AS p, amount::int AS a FROM tea_market_order WHERE status='open' ORDER BY price ASC LIMIT 5"); console.log('open orders:', JSON.stringify(o)); }catch(e){ console.log('ol err', String(e.message).slice(0,60)); }
  // 飞升台动态价 burned
  try{ const b=await p.$queryRawUnsafe("SELECT burned_total::text AS b FROM tea_chain_meta LIMIT 1"); console.log('burned:', JSON.stringify(b)); }catch(e){ console.log('br err', String(e.message).slice(0,60)); }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,120));process.exit(1)});
