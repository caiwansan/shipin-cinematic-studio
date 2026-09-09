const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true }
  });
  
  if (!user) { console.log('No user found'); return; }
  console.log('User:', user.id);
  
  try {
    const bought = await prisma.$queryRawUnsafe(
      'SELECT id, code, product_name, cover, amount, status, created_at, redeemed_at FROM city_biz_order WHERE buyer_uid=$1 ORDER BY id DESC LIMIT 100', user.id);
    console.log('Bought:', bought.length);
    
    const sold = await prisma.$queryRawUnsafe(
      'SELECT id, code, product_name, cover, amount, status, buyer_uid, created_at, redeemed_at FROM city_biz_order WHERE seller_uid=$1 ORDER BY id DESC LIMIT 100', user.id);
    console.log('Sold:', sold.length);
    
    if (bought.length > 0) {
      console.log('Sample:', JSON.stringify(bought[0]));
    }
  } catch(e) {
    console.log('Error:', e.message.split('\n')[0]);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
