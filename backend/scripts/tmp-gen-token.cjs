// 服务器生成测试 JWT（demo 用户）输出到 stdout
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const p = new PrismaClient();
const SECRET = 'ba0d90a78cf4d20963475a7447d51845383f00ac0b7abed7a1f3372c5310cbe9b2f55dc871cbec0fd6d39ff495ec5a0a0e369d47312aecead31ebd41a2a68e84';
(async () => {
  const user = await p.user.findFirst({ where: { memberTier: 'free' }, orderBy: { createdAt: 'asc' } });
  const token = jwt.sign({ id: user.id, email: user.email || '', tokenVersion: user.tokenVersion || 1 }, SECRET, { expiresIn: '3h' });
  console.log('TOKEN_START');
  console.log(token);
  console.log('TOKEN_END');
  await p.$disconnect();
})();
