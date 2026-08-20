const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{try{
  await p.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS user_asset_recovery (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    mnemonic_hash TEXT NOT NULL DEFAULT '',
    enc_key TEXT NOT NULL DEFAULT '',
    backup_data TEXT NOT NULL DEFAULT '',
    backup_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL
  )`);
  console.log('user_asset_recovery created');
}catch(e){console.log('ERR',e.message.slice(0,150));}process.exit(0)})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
