
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{
  const founder='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  const w=await p.tea_wallet.findUnique({where:{uid:founder}});
  console.log('founder before:', JSON.stringify(w&&{gongfen:String(w.gongfen),chapiao:String(w.chapiao)}));
  const target=BigInt(1000000000);
  const cur=w?BigInt(w.gongfen||0):0n;
  if(cur<target){
    const add=target-cur;
    await p.$queryRawUnsafe("UPDATE tea_wallet SET gongfen=(gongfen::bigint)+$1 WHERE uid=$2", add, founder);
    // 链式流水
    const ts=Math.floor(Date.now()/1000);
    await p.$queryRawUnsafe("INSERT INTO tea_wallet_tx (uid,token_type,amount,balance_after,tx_type,from_uid,to_uid,remark,created_at) VALUES ($1,'gongfen',$2,$3,'genesis',$4,$5,'创始工分池初始化', $6)", founder, add, target, founder, founder, ts);
    console.log('gongfen set to 1e9 (added', String(add)+')');
  } else { console.log('already >= 1e9'); }
  const w2=await p.tea_wallet.findUnique({where:{uid:founder}});
  console.log('founder after:', JSON.stringify(w2&&{gongfen:String(w2.gongfen),chapiao:String(w2.chapiao)}));
  // 全网存量（工分/茶票所有行求和）
  const agg=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g, COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  console.log('全网存量: 工分=', agg[0].g, ' 茶票=', agg[0].c);
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,150));process.exit(1)});
