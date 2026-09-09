const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check 南波万's LLM config
  const user = await prisma.user.findFirst({
    where: { id: '0ba5bf98-7005-4019-a431-6a0fb4b2d28d' },
    select: { id: true, memberTier: true, email: true }
  });
  
  if (!user) { console.log('User not found'); return; }
  console.log('User:', user.id, 'Tier:', user.memberTier, 'Email:', user.email);
  
  // Check membership
  const mem = await prisma.membership.findUnique({ where: { userId: user.id } });
  console.log('Membership:', mem ? `tier=${mem.tier}` : 'none');
  
  // Check LLM config
  const cfg = await prisma.$queryRawUnsafe('SELECT provider, model, base_url, CASE WHEN api_key != \'\' THEN \'has_key\' ELSE \'no_key\' END as key_status FROM user_llm_key WHERE user_id=$1', user.id);
  console.log('LLM config:', JSON.stringify(cfg));
  
  // Check VIP status
  const meTier = (user.memberTier || mem?.tier || 'free');
  const isVip = meTier !== 'free' && meTier !== 'basic';
  console.log('isVip:', isVip, 'tier:', meTier);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
