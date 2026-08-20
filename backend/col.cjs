
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const cols=[
    ["tea_bank_loan","due_at","BIGINT NOT NULL DEFAULT 0"],
    ["tea_bank_deposit","withdrawn_at","BIGINT NOT NULL DEFAULT 0"],
  ];
  for(const t of cols){
    try{ await p.$executeRawUnsafe("ALTER TABLE "+t[0]+" ADD COLUMN IF NOT EXISTS "+t[1]+" "+t[2]); console.log(t[0]+'.'+t[1]+' ok'); }
    catch(e){ console.log('ERR '+t[0]+'.'+t[1]+': '+String(e.message).slice(0,110)); }
  }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,120));process.exit(1)});
