
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
const crypto=require('crypto');
function txHash(prev,uid,token,amt,type,ts){return crypto.createHash('sha256').update([prev,uid,token,String(amt),type,String(ts)].join('|')).digest('hex');}
(async()=>{
  const founder='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  // 已销毁
  const b=await p.$queryRawUnsafe("SELECT v FROM tea_chain_meta WHERE k='burned_total'");
  const burned=Number(b.length?b[0].v:0);
  // 用户茶票（非创始）合计
  const usr=await p.$queryRawUnsafe("SELECT COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet WHERE uid<>$1", founder);
  const usrC=BigInt(usr[0].c||0);
  // 目标创始池 = (10亿 - burned) - 用户茶票
  const target=1000000000n-BigInt(burned)-usrC;
  const w=await p.$queryRawUnsafe("SELECT chapiao::text AS c FROM tea_wallet WHERE uid=$1", founder);
  const cur=BigInt(w[0].c);
  if(cur<target){ console.log('不用扣，创始池已低于目标'); process.exit(0); }
  const cut=cur-target;
  await p.$queryRawUnsafe("UPDATE tea_wallet SET chapiao=$1::bigint, updated_at=$2 WHERE uid=$3", target, Math.floor(Date.now()/1000), founder);
  // 链式流水：取当前最后一条 hash
  const last=await p.$queryRawUnsafe("SELECT hash FROM tea_wallet_tx ORDER BY id DESC LIMIT 1");
  const prev=last.length?last[0].hash:'GENESIS';
  const ts=Math.floor(Date.now()/1000);
  const hash=txHash(prev,founder,'chapiao',Number(-cut),'adjust',ts);
  await p.$queryRawUnsafe("INSERT INTO tea_wallet_tx (uid,token_type,amount,balance_after,tx_type,from_uid,to_uid,remark,prev_hash,hash,created_at) VALUES ($1,'chapiao',$2,$3,'adjust',$4,'BURN','超发校正:恢复全网茶票10亿恒等',$5,$6,$7)", founder, Number(-cut), Number(target), founder, prev, hash, ts);
  // 总体验证
  const tot=await p.$queryRawUnsafe("SELECT COALESCE(SUM(chapiao::bigint),0)::text AS c FROM tea_wallet");
  console.log('已销毁:', burned, ' 用户茶票:', usrC.toString(), ' 创始池:', target.toString(), ' 扣减:', cut.toString());
  console.log('全网茶票存量:', tot[0].c, ' +已销毁=', (BigInt(tot[0].c)+BigInt(burned)).toString(), '(应=1000000000)');
  const agg=await p.$queryRawUnsafe("SELECT COALESCE(SUM(gongfen::bigint),0)::text AS g FROM tea_wallet");
  console.log('全网工分:', agg[0].g, ' 新汇率=工分/茶票=', (Number(agg[0].g)/Number(tot[0].c)).toFixed(6));
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,130));process.exit(1)});
