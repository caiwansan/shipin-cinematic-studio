const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const rows=await p.$queryRawUnsafe('SELECT user_id,provider,model,base_url,length(api_key) AS keylen, updated_at FROM user_llm_key');console.log(JSON.stringify(rows));process.exit(0)})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
