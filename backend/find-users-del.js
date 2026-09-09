const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'qq_64F878CD37EC2927791415F6E19F10FE@aigc.fushtn.com',
    'qq_EA7CC96F4953A2DBF122542696843B1E@aigc.fushtn.com'
  ];
  
  for (const email of emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(email + ": NOT FOUND"); continue; }
    console.log(email + ": id=" + user.id + " created=" + user.createdAt);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
