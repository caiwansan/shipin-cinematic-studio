const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const w=await p.$queryRawUnsafe('SELECT uid,gongfen,chapiao FROM tea_wallet');
  let sum=0; console.log('nodes:');
  w.forEach(x=>{ sum+=Number(x.chapiao||0); console.log('  '+String(x.uid).slice(0,14)+' 茶票='+x.chapiao+' 工分='+x.gongfen); });
  const b=await p.$queryRawUnsafe("SELECT v FROM tea_chain_meta WHERE k='burned_total'");
  const burned=Number(b[0]?.v||0);
  console.log('全网茶票合计=',sum,' 已销毁=',burned,' 持有+销毁=',sum+burned,' vs 10亿 偏差=',sum+burned-1000000000);
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
