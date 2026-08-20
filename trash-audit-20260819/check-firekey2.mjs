import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const cfg = await prisma.userModelConfigV2.findUnique({
    where: { userId: '5cbabc6d-60f1-48e6-b8fe-cb4a15ac50e0' }
  });
  if (!cfg || !cfg.llmApiKey) { console.log('NO CONFIG'); return; }
  const encrypted = cfg.llmApiKey;
  const parts = encrypted.split(':');
  console.log('Encrypted parts:', parts.map(p => p.substring(0,16)+'...'));
  
  // try both keys
  const keys = [
    'f535f7bcb360367cf03441091090227f7b9de011d65044fd0b7b83fe90099596',
    '798bf092f3003cd9d3f94cd6230a9e8120f1dd0e4e9fc9a8e3550a487b95341e'
  ];
  
  for (const keyHex of keys) {
    try {
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const text = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      let d = decipher.update(text, undefined, 'utf8');
      d += decipher.final('utf8');
      console.log(`✅ ${keyHex.substring(0,10)}: ${d}`);
    } catch(e) {
      console.log(`❌ ${keyHex.substring(0,10)}: ${e.message}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);
