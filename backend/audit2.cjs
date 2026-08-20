
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const rows=await p.$queryRawUnsafe("SELECT uid, chapiao::text AS c, gongfen::text AS g FROM tea_wallet WHERE chapiao>0 ORDER BY chapiao DESC");
  let tot=0n;
  console.log('茶票持有分布:');
  for(const r of rows){ tot+=BigInt(r.c); console.log('  ', r.uid.slice(0,12), '茶票', r.c, '工分', r.g); }
  console.log('全网茶票合计:', tot.toString(), ' (上限1000000000, 超出=', (tot-1000000000n).toString()+')');
  // 销毁累计
  const b=await p.$queryRawUnsafe("SELECT v FROM tea_chain_meta WHERE k='burned_total'");
  console.log('已销毁:', b.length?b[0].v:'0');
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,130));process.exit(1)});
