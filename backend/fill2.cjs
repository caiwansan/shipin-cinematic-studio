
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const founder='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const target=BigInt(1000000000);
  // 查创始行
  const before=await p.$queryRawUnsafe("SELECT uid, gongfen::text, chapiao::text FROM tea_wallet WHERE uid=$1", founder);
  console.log('founder before:', JSON.stringify(before));
  let cur=before.length?BigInt(before[0].gongfen||0):0n;
  if(cur<target){
    const add=target-cur;
    if(before.length){
      await p.$queryRawUnsafe("UPDATE tea_wallet SET gongfen=$1::bigint WHERE uid=$2", target, founder);
    } else {
      await p.$queryRawUnsafe("INSERT INTO tea_wallet (uid, gongfen, chapiao) VALUES ($1, $2, 0) ON CONFLICT (uid) DO UPDATE SET gongfen=$2", founder, target);
    }
    const ts=Math.floor(Date.now()/1000);
    await p.$queryRawUnsafe("INSERT INTO tea_wallet_tx (uid, token_type, amount, balance_after, tx_type, from_uid, to_uid, remark, created_at) VALUES ($1,'gongfen',$2,$3,'genesis',$4,$5,'创始工分池初始化 10亿',$6)", founder, add, target, founder, founder, ts);
    console.log('gongfen set 1e9 (added', String(add)+')');
  } else { console.log('already >= 1e9'); }
  const after=await p.$queryRawUnsafe("SELECT uid, gongfen::text, chapiao::text FROM tea_wallet WHERE uid=$1", founder);
  console.log('founder after:', JSON.stringify(after));
  const agg=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  console.log('全网存量: 工分=', agg[0].g, ' 茶票=', agg[0].c, ' 汇率=工分/茶票=', agg[0].g+'/'+agg[0].c);
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,150));process.exit(1)});
