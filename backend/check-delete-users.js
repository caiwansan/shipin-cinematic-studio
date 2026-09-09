const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'qq_64F878CD37EC2927791415F6E19F10FE@aigc.fushtn.com',
    'qq_EA7CC96F4953A2DBF122542696843B1E@aigc.fushtn.com'
  ];
  
  for (const email of emails) {
    console.log("\\n=== " + email + " ===");
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        membership: true,
        imTokenSession: true,
        _count: {
          select: {
            messagesSent: true,
            messagesReceived: true,
            ownedProjects: true,
            giftRecord: true,
            goldCoinLog: true
          }
        }
      }
    });
    
    if (user) {
      console.log("  ID:", user.id);
      console.log("  Username:", user.username);
      console.log("  CreatedAt:", user.createdAt);
      console.log("  Membership:", user.membership ? "EXISTS" : "none");
      console.log("  IM Sessions:", user.imTokenSession.length);
      console.log("  Messages Sent:", user._count.messagesSent);
      console.log("  Messages Received:", user._count.messagesReceived);
      console.log("  Projects:", user._count.ownedProjects);
      console.log("  Gift Records:", user._count.giftRecord);
      console.log("  GoldCoin Logs:", user._count.goldCoinLog);
    } else {
      console.log("  NOT FOUND");
    }
  }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
