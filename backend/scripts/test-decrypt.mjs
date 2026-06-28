import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const keyHex = process.env.CRYPTO_ENCRYPTION_KEY;
  if (!keyHex) { console.log('NO CRYPTO KEY'); return; }
  console.log('CRYPTO key:', keyHex.substring(0, 10) + '...');
  
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId: '7c2d430a-da7d-4dac-a94f-e44d61311b1d' }
  });
  
  if (!cfg || !cfg.llmApiKey) { console.log('NO LLM CONFIG'); return; }
  console.log('Encrypted key:', cfg.llmApiKey.substring(0, 30) + '...');
  
  const key = Buffer.from(keyHex, 'hex');
  const parts = cfg.llmApiKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const text = Buffer.from(parts[2], 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(text, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  console.log('Decrypted key:', decrypted);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
