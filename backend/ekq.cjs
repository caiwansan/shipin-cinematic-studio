
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const rows=await p.$queryRawUnsafe("SELECT user_id, left(enc_key,50) AS ek, length(enc_key) AS len FROM identity_challenges_meta LIMIT 20");
  for(const r of rows){ console.log(r.user_id.slice(0,10), 'len='+r.len, 'head='+JSON.stringify(r.ek)); }
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,100));process.exit(1)});
