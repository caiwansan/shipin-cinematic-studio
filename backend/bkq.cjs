
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  // 1) app_settings 表是否存在 + exchange_rate
  try{ const t=await p.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'app_%'"); console.log('app tables:', JSON.stringify(t.map(x=>x.table_name))); }catch(e){ console.log('no app_ tables', String(e.message).slice(0,60)); }
  try{ const r=await p.$queryRawUnsafe("SELECT * FROM app_settings WHERE key='exchange_rate'"); console.log('exchange_rate:', JSON.stringify(r)); }catch(e){ console.log('no exchange_rate', String(e.message).slice(0,60)); }
  // 2) tea_market_order 最低卖价
  try{ const m=await p.$queryRawUnsafe("SELECT MIN(price) AS minp, COUNT(*) AS n FROM tea_market_order WHERE status='open'"); console.log('market min open:', JSON.stringify(m)); }catch(e){ console.log('mk err', String(e.message).slice(0,60)); }
  // 3) tea_chain_meta burned
  try{ const b=await p.$queryRawUnsafe("SELECT burned_total FROM tea_chain_meta LIMIT 1"); console.log('burned:', JSON.stringify(b)); }catch(e){ console.log('burn err', String(e.message).slice(0,60)); }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,120));process.exit(1)});
