import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const users = await p.user.findMany({ 
    take: 10, 
    orderBy: { coins: 'asc' }, 
    select: { id: true, email: true, username: true, coins: true } 
  });
  console.log('当前用户列表：');
  console.table(users);
  
  // 给所有积分低于100的用户充值到1000
  for (const u of users) {
    if (u.coins < 100) {
      await p.user.update({ where: { id: u.id }, data: { coins: 1000 } });
      console.log(`✅ ${u.email || u.username || u.id}: ${u.coins} → 1000 积分`);
    }
  }
  console.log('\n充值完成！刷新页面再试一次 🎉');
} catch(e) { console.error(e); }
await p.$disconnect();
