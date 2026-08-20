const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  try{
    await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS tea_chain_meta (
      k TEXT PRIMARY KEY,
      v BIGINT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    )`);
    console.log('tea_chain_meta created');
    // 初始化 burned_total 若无
    const r=await p.$queryRawUnsafe(`SELECT v FROM tea_chain_meta WHERE k='burned_total'`);
    if(!r.length){ await p.$executeRawUnsafe(`INSERT INTO tea_chain_meta(k,v,updated_at) VALUES ('burned_total',0,$1)`,Math.floor(Date.now()/1000)); console.log('burned_total init 0'); }
    else console.log('burned_total existing:', r[0].v);
  }catch(e){console.log('ERR',e.message.slice(0,150));}
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
