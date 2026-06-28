import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const keyHex = process.env.CRYPTO_ENCRYPTION_KEY;
  const plainKey = 'sk-1bea5ef7075948d1926a66fd5c0d526d'; // deepseek key from .env
  console.log('Plain key to encrypt:', plainKey);
  
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  const encKey = `${iv.toString('hex')}:${tag}:${encrypted}`;
  console.log('Encrypted:', encKey);
  
  await prisma.userModelConfigV2.upsert({
    where: { userId: '7c2d430a-da7d-4dac-a94f-e44d61311b1d' },
    create: {
      userId: '7c2d430a-da7d-4dac-a94f-e44d61311b1d',
      llmProvider: 'deepseek',
      llmApiKey: encKey,
      llmModel: 'deepseek-chat',
      llmEnabled: true,
    },
    update: {
      llmProvider: 'deepseek',
      llmApiKey: encKey,
      llmModel: 'deepseek-chat',
      llmEnabled: true,
    },
  });
  console.log('✅ Done');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
