
const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient();
(async()=>{ await p.$executeRawUnsafe("INSERT INTO app_settings (key,value) VALUES ('exchange_rate','1.5') ON CONFLICT (key) DO UPDATE SET value='1.5'"); console.log('exchange_rate=1.5 set'); process.exit(0); })().catch(e=>{console.error('FATAL',String(e.message).slice(0,100));process.exit(1)});
