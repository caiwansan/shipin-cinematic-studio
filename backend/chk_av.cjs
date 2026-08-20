const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const r=await p.$queryRawUnsafe("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_name IN ('avatar_profile','avatar_script') ORDER BY table_name,ordinal_position");
r.forEach(x=>console.log(x.table_name+'.'+x.column_name+' '+x.data_type));
process.exit(0)})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
