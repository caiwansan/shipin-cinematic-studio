const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const rows=await p.$queryRawUnsafe('SELECT user_id AS u,provider AS p,model AS m,base_url AS base,length(api_key) AS klen FROM user_llm_key');
rows.forEach(x=>console.log('u='+x.u.slice(0,10)+' p='+x.p+' m='+x.m+' base='+x.base+' keylen='+Number(x.klen)));
process.exit(0)})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
