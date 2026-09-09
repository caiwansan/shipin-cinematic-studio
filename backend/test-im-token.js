const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

async function main() {
  // Get a real user
  const user = await prisma.user.findFirst({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true }
  });
  
  if (!user) { console.log('No user found'); return; }
  
  const token = crypto.randomBytes(24).toString('hex');
  const expireAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  
  try {
    // Delete expired tokens
    await prisma.imTokenSession.deleteMany({ where: { userId: user.id, expireAt: { lt: new Date() } } });
    
    // Create new token
    const session = await prisma.imTokenSession.create({ 
      data: { userId: user.id, token, expireAt } 
    });
    console.log('IM token created:', session.token.substring(0, 20) + '...');
    
    // Sync to WukongIM
    const res = await fetch('http://127.0.0.1:5001/user/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.id, token })
    });
    console.log('WukongIM sync:', res.status, await res.text());
    
  } catch(e) {
    console.error('Error:', e.message);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
