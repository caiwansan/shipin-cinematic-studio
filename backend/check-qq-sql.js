const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe("SELECT channel, enabled, config FROM payment_secret WHERE channel IN ('qq_oauth', 'qq_mobile')");
  console.log('QQ configs found:', result.length);
  result.forEach(r => console.log('  ' + r.channel + ' | enabled:' + r.enabled + ' | ' + r.config));
  if (result.length === 0) {
    console.log('\nNo QQ config found! Need to create it.');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
