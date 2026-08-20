
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const ts=Math.floor(Date.now()/1000);
  try{
    // 存款表
    await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS tea_bank_deposit (
      id BIGSERIAL PRIMARY KEY,
      uid TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      days INTEGER NOT NULL DEFAULT 30,
      annual_rate NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at BIGINT NOT NULL,
      due_at BIGINT NOT NULL
    )`);
    console.log('tea_bank_deposit ok');
  }catch(e){console.log('ERR dep',String(e.message).slice(0,120));}
  try{
    // 给 tea_bank_loan 加 mult/annual_rate 列（若缺）
    await p.$executeRawUnsafe(`ALTER TABLE tea_bank_loan ADD COLUMN IF NOT EXISTS mult NUMERIC NOT NULL DEFAULT 1`);
    await p.$executeRawUnsafe(`ALTER TABLE tea_bank_loan ADD COLUMN IF NOT EXISTS annual_rate NUMERIC NOT NULL DEFAULT 0`);
    console.log('tea_bank_loan columns ok');
  }catch(e){console.log('ERR col',String(e.message).slice(0,120));}
  process.exit(0);
})().catch(e=>{console.error('FATAL',String(e.message).slice(0,150));process.exit(1)});
