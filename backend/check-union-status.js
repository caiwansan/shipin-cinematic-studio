const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check current QQ users and their unionId status
  console.log("=== QQ Users unionId status ===");
  const qqUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'qq_' } },
    select: { id: true, email: true, username: true, qqOpenId: true, qqUnionId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });
  
  let withUnion = 0, withoutUnion = 0;
  qqUsers.forEach(u => {
    const hasUnion = !!u.qqUnionId;
    if (hasUnion) withUnion++; else withoutUnion++;
    console.log("  " + (hasUnion ? "✅" : "❌") + " " + u.email + " | unionId: " + (u.qqUnionId || "null"));
  });
  
  console.log("\\nTotal QQ users:", qqUsers.length);
  console.log("With unionId:", withUnion);
  console.log("Without unionId:", withoutUnion);
  
  // Check the QQ OAuth config to see if unionId is being requested
  console.log("\\n=== QQ Config ===");
  const configs = await prisma.$queryRawUnsafe("SELECT channel, config, enabled FROM payment_secret WHERE channel LIKE '%qq%'");
  configs.forEach(c => {
    const cfg = JSON.parse(c.config);
    console.log("  " + c.channel + ": appId=" + cfg.appId + ", enabled=" + c.enabled);
  });
  
  // Check route_config for mobile QQ settings
  console.log("\\n=== route_config tea ===");
  try {
    const routeCfg = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'config' } } });
    if (routeCfg) {
      const v = routeCfg.value || {};
      console.log("  qqAppId:", v.qqAppId);
      console.log("  qqAppSecret:", v.qqAppSecret ? "SET" : "NOT SET");
      console.log("  qqRedirectUri:", v.qqRedirectUri);
    }
  } catch(e) { console.log("  route_config:", e.message.split("\n")[0]); }
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
