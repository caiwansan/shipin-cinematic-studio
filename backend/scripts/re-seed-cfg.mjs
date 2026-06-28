import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function encryptKey(plaintext) {
  const keyHex = process.env.CRYPTO_ENCRYPTION_KEY;
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

async function main() {
  const keyHex = process.env.CRYPTO_ENCRYPTION_KEY;
  console.log('Using CRYPTO key:', keyHex.substring(0, 10) + '...');
  
  const volcKey = process.env.VOLCENGINE_API_KEY || 'e7451bd2-bb62-4a53-a4a7-c0fb1ceb931f';
  const encKey = encryptKey(volcKey);
  console.log('Encrypted:', encKey);
  
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
  console.log('✅ Done');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
