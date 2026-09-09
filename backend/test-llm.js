const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true }
  });
  
  if (!user) { console.log('No user found'); return; }
  console.log('User ID:', user.id);
  console.log('Length:', user.id.length);
  
  const validateUserId = (uid) => /^[a-f0-9-]{36}$/i.test(uid) || uid.length <= 64;
  console.log('validateUserId:', validateUserId(user.id));
  
  try {
    const r = await prisma.$queryRawUnsafe('SELECT provider, model, base_url AS "baseUrl" FROM user_llm_key WHERE user_id=$1', user.id);
    console.log('getCfg result:', JSON.stringify(r));
  } catch(e) {
    console.log('getCfg error:', e.message.split('\n')[0]);
  }
  
  try {
    const ts = Math.floor(Date.now() / 1000);
    await prisma.$queryRawUnsafe(
      'INSERT INTO user_llm_key (user_id, provider, model, base_url, api_key, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO UPDATE SET provider=$2, model=$3, base_url=$4, api_key=$5, updated_at=$6',
      user.id, 'deepseek', 'deepseek-v4-flash', 'https://api.deepseek.com/v1', 'test_key', ts
    );
    console.log('setCfg success');
  } catch(e) {
    console.log('setCfg error:', e.message.split('\n')[0]);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
