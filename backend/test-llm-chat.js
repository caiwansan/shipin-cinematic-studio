const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true, memberTier: true }
  });
  
  if (!user) { console.log('No user found'); return; }
  console.log('User:', user.id, 'Tier:', user.memberTier);
  
  // Check membership
  const mem = await prisma.membership.findUnique({ where: { userId: user.id } });
  console.log('Membership:', mem ? `tier=${mem.tier}` : 'none');
  
  // Check LLM config
  const cfg = await prisma.$queryRawUnsafe('SELECT provider, model, base_url, CASE WHEN api_key != \'\' THEN \'has_key\' ELSE \'no_key\' END as key_status FROM user_llm_key WHERE user_id=$1', user.id);
  console.log('LLM config:', JSON.stringify(cfg));
  
  const validateUserId = (uid) => /^[a-f0-9-]{36}$/i.test(uid) || uid.length <= 64;
  console.log('validateUserId:', validateUserId(user.id));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
