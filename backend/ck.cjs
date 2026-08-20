
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  // 1) tea_wallet chapiao 非负约束
  try{ await p.$executeRawUnsafe("ALTER TABLE tea_wallet DROP CONSTRAINT IF EXISTS tea_wallet_chapiao_nonneg"); }catch(e){}
  try{ await p.$executeRawUnsafe("ALTER TABLE tea_wallet ADD CONSTRAINT tea_wallet_chapiao_nonneg CHECK (chapiao >= 0)"); console.log('CHECK chapiao>=0 ok'); }catch(e){ console.log('ERR check', String(e.message).slice(0,80)); }
  // 2) 全局触发式上限校验无法用简单 CHECK（跨行 SUM），用应用层：已在 exchange 前置校验
  // 汇总确认
  const tot=await p.$queryRawUnsafe("SELECT COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  const b=await p.$queryRawUnsafe("SELECT v FROM tea_chain_meta WHERE k='burned_total'");
  const burned=Number(b.length?b[0].v:0);
  console.log('全网茶票:', tot[0].c, '+已销毁', burned, '= 10亿?', (BigInt(tot[0].c)+BigInt(burned)).toString());
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,130));process.exit(1)});
