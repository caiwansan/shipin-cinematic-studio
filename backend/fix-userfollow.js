const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const lines = schema.split('\n');
  
  // Find UserFollow model and fix createdAt
  let inUserFollow = false;
  let braceCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('model UserFollow {')) { inUserFollow = true; braceCount = 1; continue; }
    if (inUserFollow) {
      braceCount += (lines[i].match(/{/g) || []).length - (lines[i].match(/}/g) || []).length;
      if (braceCount <= 0) { inUserFollow = false; continue; }
      // Fix createdAt - add @map("created_at")
      if (lines[i].includes('createdAt') && !lines[i].includes('@map')) {
        lines[i] = lines[i].replace('createdAt   DateTime @default(now())', 'createdAt   DateTime @default(now()) @map("created_at")');
        console.log('Fixed line ' + (i+1) + ': ' + lines[i].trim());
      }
    }
  }
  
  fs.writeFileSync('prisma/schema.prisma', lines.join('\n'));
  console.log('Schema saved');
  
  // Verify
  const verify = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const section = verify.match(/model UserFollow \{[^}]+\}/);
  console.log('\n=== UserFollow ===');
  console.log(section[0]);
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
