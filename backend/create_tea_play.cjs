const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
const stmts=[
  // 签到（悟道茶树）：uid+day 每天一条，streak=连续天数
  `CREATE TABLE IF NOT EXISTS tea_checkin (
     id BIGSERIAL PRIMARY KEY,
     uid TEXT NOT NULL,
     day TEXT NOT NULL,
     streak INTEGER NOT NULL DEFAULT 0,
     reward INTEGER NOT NULL DEFAULT 0,
     created_at BIGINT NOT NULL,
     UNIQUE(uid, day)
   )`,
  // 每日竞猜题目
  `CREATE TABLE IF NOT EXISTS tea_quiz (
     id BIGSERIAL PRIMARY KEY,
     day TEXT NOT NULL,
     question TEXT NOT NULL,
     options JSONB NOT NULL,
     answer INTEGER,
     reward_rate INTEGER NOT NULL DEFAULT 2,
     status TEXT NOT NULL DEFAULT 'open',
     created_at BIGINT NOT NULL
   )`,
  // 竞猜下注
  `CREATE TABLE IF NOT EXISTS tea_quiz_bet (
     id BIGSERIAL PRIMARY KEY,
     uid TEXT NOT NULL,
     quiz_id BIGINT NOT NULL,
     option INTEGER NOT NULL,
     amount INTEGER NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending',
     reward INTEGER NOT NULL DEFAULT 0,
     created_at BIGINT NOT NULL
   )`,
  // 封神榜缓存（可选，实时算可不用）
];
(async()=>{
  for(const s of stmts){
    try{ await p.$executeRawUnsafe(s); console.log('OK:', s.slice(0,40).replace(/\n/g,' ')); }
    catch(e){ console.log('ERR:', e.message.slice(0,120)); }
  }
  process.exit(0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
