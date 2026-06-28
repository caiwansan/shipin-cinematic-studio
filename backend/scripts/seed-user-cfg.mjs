import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function encryptKey(plaintext) {
  const keyHex = process.env.CRYPTO_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 32) throw new Error('CRYPTO_ENCRYPTION_KEY not set or too short');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

async function main() {
  const envKey = process.env.CRYPTO_ENCRYPTION_KEY;
  const volcKey = process.env.VOLCENGINE_API_KEY;
  console.log('CRYPTO_KEY length:', envKey?.length);
  console.log('VOLCENGINE key present:', !!volcKey);
  
  if (!volcKey) {
    console.log('No VOLCENGINE_API_KEY in env, exiting');
    return;
  }
  
  const encKey = encryptKey(volcKey);
  console.log('Encrypted key:', encKey);
  
  await prisma.userModelConfigV2.upsert({
    where: { userId: '7c2d430a-da7d-4dac-a94f-e44d61311b1d' },
    create: {
      userId: '7c2d430a-da7d-4dac-a94f-e44d61311b1d',
      llmProvider: 'volcengine',
      llmApiKey: encKey,
      llmModel: 'doubao-seed-2-0-mini-260428',
      llmEnabled: true,
    },
    update: {
      llmProvider: 'volcengine',
      llmApiKey: encKey,
      llmModel: 'doubao-seed-2-0-mini-260428',
      llmEnabled: true,
    },
  });
  console.log('✅ UserModelConfigV2 seeded');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
