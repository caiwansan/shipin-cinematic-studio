const {PrismaClient}=require('@prisma/client');const crypto=require('crypto');const p=new PrismaClient();
async function txHash(t){return crypto.createHash('sha256').update(`${t.prev_hash||''}|${t.uid}|${t.token_type}|${t.amount}|${t.tx_type}|${t.from_uid||''}|${t.to_uid||''}|${t.remark||''}|${t.created_at}`).digest('hex');}
(async()=>{
  const FOUNDER='0ba5bf98-7005-4019-a431-6a0fb4b2d28d';
  // 应收缴 75 茶票
  const delta=-75;
  // 1) 更新创始池
  await p.$executeRawUnsafe('UPDATE tea_wallet SET chapiao=chapiao+$1, updated_at=$2 WHERE uid=$3', delta, Math.floor(Date.now()/1000), FOUNDER);
  // 2) 追加链式流水（调整记录）
  const ts=Math.floor(Date.now()/1000);
  const prev=await p.$queryRawUnsafe('SELECT hash FROM tea_wallet_tx WHERE uid=$1 ORDER BY id DESC LIMIT 1', FOUNDER);
  const prevHash=prev.length?prev[0].hash:'genesis';
  const w=await p.$queryRawUnsafe('SELECT chapiao FROM tea_wallet WHERE uid=$1', FOUNDER);
  const after=Number(w[0].chapiao);
  const hash=txHash({prev_hash:prevHash,uid:FOUNDER,token_type:'chapiao',amount:-75,tx_type:'adjust',from_uid:FOUNDER,to_uid:null,remark:'恒等式校正(早期多发回收)',created_at:ts,balance_after:after});
  await p.$executeRawUnsafe("INSERT INTO tea_wallet_tx (uid,token_type,amount,balance_after,tx_type,from_uid,to_uid,remark,prev_hash,hash,created_at) VALUES ($1,'chapiao',$2,$3,'adjust',$4,NULL,$5,$6,$7,$8)",FOUNDER,-75,after,FOUNDER,'恒等式校正(早期多发回收)',prevHash,hash,ts);
  // 3) 重审计
  const w2=await p.$queryRawUnsafe('SELECT uid,chapiao FROM tea_wallet');let sum=0;w2.forEach(x=>sum+=Number(x.chapiao||0));
  const b=await p.$queryRawUnsafe("SELECT v FROM tea_chain_meta WHERE k='burned_total'");
  console.log('校正后创始池=',(await p.$queryRawUnsafe('SELECT chapiao FROM tea_wallet WHERE uid=$1',FOUNDER))[0].chapiao);
  console.log('全网茶票合计=',sum,' 销毁=',Number(b[0].v||0),' 持有+销毁=',sum+Number(b[0].v||0),' (目标10亿,偏差=',sum+Number(b[0].v||0)-1000000000,')');
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
