const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.paymentSecret.findMany({
    where: { channel: { in: ['qq_oauth', 'qq_mobile'] } }
  });
  console.log('QQ configs found:', configs.length);
  configs.forEach(c => {
    console.log('  ' + c.channel + ' | enabled:' + c.enabled + ' | ' + c.config);
  });
  
  if (configs.length === 0) {
    console.log('\nNo QQ config found! Need to create it.');
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
