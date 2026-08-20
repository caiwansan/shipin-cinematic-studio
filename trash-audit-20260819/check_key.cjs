const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const currentKeyHex = process.env.CRYPTO_ENCRYPTION_KEY || 'f535f7bcb360367cf03441091090227f7b9de011d65044fd0b7b83fe90099596';
const currentKey = Buffer.from(currentKeyHex, 'hex');
const oldKeyHex = '798bf092f3003cd9d3f94cd6230a9e8120f1dd0e4e9fc9a8e3550a487b95341e';
const oldKey = Buffer.from(oldKeyHex, 'hex');

function tryDecrypt(data, key) {
  const parts = data.split(':');
  if (parts.length !== 3) return null;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(parts[2], 'hex', 'utf8') + decipher.final('utf8');
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const configs = await prisma.userModelConfig.findMany({
      where: { userId: '5cbabc6d-60f1-48e6-b8fe-cb4a15ac50e0' }
    });
    console.log('找到 ' + configs.length + ' 条配置');
    for (const c of configs) {
      console.log('\nID: ' + c.id.slice(0,8) + '  provider: ' + c.provider + '  modelType: ' + c.modelType);
      if (c.apiKey) {
        console.log('apiKey 前40字: ' + c.apiKey.substring(0, 40) + '...');
        try {
          const d = tryDecrypt(c.apiKey, currentKey);
          if (d) console.log('✅ 当前Key解密成功: ' + d.substring(0, 15) + '...');
        } catch(e) {
          console.log('❌ 当前Key解密失败: ' + e.message);
          try {
            const d = tryDecrypt(c.apiKey, oldKey);
            if (d) console.log('✅ 旧Key解密成功: ' + d.substring(0, 15) + '...');
          } catch(e2) {
            console.log('❌ 旧Key也失败: ' + e2.message);
          }
        }
      } else {
        console.log('⚠️ apiKey 为 NULL');
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
