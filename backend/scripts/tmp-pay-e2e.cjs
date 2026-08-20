// 实测：生成测试 token → upgrade-vip(basic) → create-payment(alipay/wechat) 看真实返回
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const p = new PrismaClient();
const SECRET = process.env.JWT_SECRET || 'ba0d90a78cf4d20963475a7447d51845383f00ac0b7abed7a1f3372c5310cbe9b2f55dc871cbec0fd6d39ff495ec5a0a0e369d47312aecead31ebd41a2a68e84';
const API = 'https://aigc.fushtn.com';

async function main() {
  // 找一个 free 用户
  let user = await p.user.findFirst({ where: { memberTier: 'free' }, orderBy: { createdAt: 'asc' } });
  if (!user) user = await p.user.findFirst({ orderBy: { createdAt: 'asc' } });
  console.log('测试用户:', user.username || user.phone || user.email, '| tier:', user.memberTier, '| tokenVersion:', user.tokenVersion);
  const token = jwt.sign({ id: user.id, email: user.email || '', tokenVersion: user.tokenVersion || 1 }, SECRET, { expiresIn: '1h' });

  // 1) upgrade-vip basic
  console.log('\n=== upgrade-vip basic ===');
  const r1 = await fetch(API + '/api/member/upgrade-vip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ planLevel: 'basic' }),
  });
  const j1 = await r1.json();
  console.log('HTTP', r1.status, JSON.stringify(j1).slice(0, 600));

  const orderId = j1.orderId;
  if (!orderId) { console.log('❌ 无 orderId，中止'); process.exit(0); }

  // 2) create-payment alipay
  console.log('\n=== create-payment alipay ===');
  const r2 = await fetch(API + '/api/member/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ orderId, channel: 'alipay' }),
  });
  console.log('HTTP', r2.status, (await r2.text()).slice(0, 600));

  // 3) create-payment wechat
  console.log('\n=== create-payment wechat ===');
  const r3 = await fetch(API + '/api/member/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ orderId, channel: 'wechat' }),
  });
  console.log('HTTP', r3.status, (await r3.text()).slice(0, 600));

  await p.$disconnect();
}
main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
