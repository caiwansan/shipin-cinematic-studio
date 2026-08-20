const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  try{
    // 建用户LLM配置表（独立于 userModelConfigV2，含自配APIKey）
    await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS user_llm_key (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'deepseek',
      model TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
      base_url TEXT NOT NULL DEFAULT '',
      api_key TEXT NOT NULL DEFAULT '',
      updated_at BIGINT NOT NULL
    )`);
    console.log('user_llm_key created');
  }catch(e){console.log('ERR',e.message.slice(0,150));}
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
