const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Test paymentSecret query
  console.log('=== Testing paymentSecret ===');
  try {
    const secret = await prisma.paymentSecret.findUnique({ where: { channel: 'qq_oauth' } });
    console.log('paymentSecret result:', secret ? 'FOUND' : 'NULL');
    if (secret) console.log('  enabled:', secret.enabled, 'config:', secret.config);
  } catch(e) {
    console.log('paymentSecret ERROR:', e.message.split('\n')[0]);
  }
  
  // Test routeConfig query
  console.log('\n=== Testing routeConfig ===');
  try {
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
    console.log('routeConfig result:', row ? 'FOUND' : 'NULL');
    if (row) console.log('  value:', JSON.stringify(row.value));
  } catch(e) {
    console.log('routeConfig ERROR:', e.message.split('\n')[0]);
  }
  
  // Test raw SQL
  console.log('\n=== Testing raw SQL ===');
  try {
    const result = await prisma.$queryRawUnsafe("SELECT channel, enabled FROM payment_secret WHERE channel = 'qq_oauth'");
    console.log('Raw SQL result:', result.length, 'rows');
  } catch(e) {
    console.log('Raw SQL ERROR:', e.message.split('\n')[0]);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
