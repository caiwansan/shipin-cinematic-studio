const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'qq_6F736FAC37ED3A3AF774AE0924374F4D@aigc.fushtn.com';
  
  // Check current state
  const before = await prisma.user.findUnique({
    where: { email },
    select: { id: true, qqUnionId: true }
  });
  console.log('Before:', JSON.stringify(before));
  
  // Try to get unionId from QQ API using raw SQL to check if there's a recent session
  const sessions = await prisma.$queryRawUnsafe(
    "SELECT token FROM im_token_session WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    before.id
  );
  console.log('IM sessions:', sessions.length);
  
  // Update unionId - we need to get it from somewhere
  // Since we can't call QQ API without access_token, let's try a different approach
  // Check if there's a mobile account with the same user that has unionId
  
  // Actually, let's just update it with a placeholder for now
  // The user needs to login on mobile to get the real unionId
  
  console.log('\nCannot update unionId without QQ API access_token.');
  console.log('The PC login should have captured it but did not.');
  console.log('Possible reasons:');
  console.log('1. QQ API did not return unionId for app 1904087232');
  console.log('2. The login callback did not complete');
  console.log('3. The unionId was not in the API response');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
