const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get two real users
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true, email: true },
    take: 5
  });
  console.log('Users:', users.map(u => u.email.substring(0, 20)));
  
  if (users.length >= 2) {
    const u1 = users[0];
    const u2 = users[1];
    
    // Test ensure-private
    const res = await fetch('https://aigc.fushtn.com/api/im/channels/ensure-private', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <REDACTED>'
      },
      body: JSON.stringify({ peerUid: u2.id })
    });
    console.log('\nensure-private status:', res.status);
    console.log('ensure-private response:', await res.text());
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
