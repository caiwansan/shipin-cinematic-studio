const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userIds = [
    'ff750ab7-2311-4391-a640-dc0601ddc490',
    '0a8d3d0c-3b7b-4a29-a23d-ad588db03b1d'
  ];
  
  for (const uid of userIds) {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) { console.log(uid + ": NOT FOUND"); continue; }
    
    console.log("\\n=== Deleting " + user.email + " ===");
    
    // Check related data
    const membership = await prisma.membership.findUnique({ where: { userId: uid } });
    console.log("  Membership:", membership ? "EXISTS" : "none");
    
    const wallet = await prisma.$queryRawUnsafe("SELECT * FROM tea_wallet WHERE uid = $1", uid);
    console.log("  TeaWallet:", wallet.length);
    
    const imSessions = await prisma.imTokenSession.count({ where: { userId: uid } });
    console.log("  IM Sessions:", imSessions);
    
    const follows = await prisma.userFollow.count({ where: { OR: [{ followerId: uid }, { followingId: uid }] } });
    console.log("  Follows:", follows);
    
    // Delete in order (respect foreign keys)
    // 1. Delete IM sessions
    if (imSessions > 0) {
      await prisma.imTokenSession.deleteMany({ where: { userId: uid } });
      console.log("  Deleted IM sessions");
    }
    
    // 2. Delete follows
    if (follows > 0) {
      await prisma.userFollow.deleteMany({ where: { OR: [{ followerId: uid }, { followingId: uid }] } });
      console.log("  Deleted follows");
    }
    
    // 3. Delete membership
    if (membership) {
      await prisma.membership.delete({ where: { userId: uid } });
      console.log("  Deleted membership");
    }
    
    // 4. Delete tea_wallet
    if (wallet.length > 0) {
      await prisma.$executeRawUnsafe("DELETE FROM tea_wallet WHERE uid = $1", uid);
      console.log("  Deleted tea wallet");
    }
    
    // 5. Delete user
    await prisma.user.delete({ where: { id: uid } });
    console.log("  DELETED user");
  }
  
  console.log("\\n=== DONE ===");
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
