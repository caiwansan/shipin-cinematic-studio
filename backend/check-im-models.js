
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check Prisma schema models
  const fs = require('fs');
  const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  
  // Extract ImUserPresence model
  const presenceMatch = schema.match(/model ImUserPresence \{[^}]+\}/);
  console.log("=== Prisma ImUserPresence ===");
  console.log(presenceMatch ? presenceMatch[0] : "NOT FOUND");
  
  // Extract UserFollow model
  const followMatch = schema.match(/model UserFollow \{[^}]+\}/);
  console.log("\n=== Prisma UserFollow ===");
  console.log(followMatch ? followMatch[0] : "NOT FOUND");
  
  // Extract ImChannel model
  const channelMatch = schema.match(/model ImChannel \{[^}]+\}/);
  console.log("\n=== Prisma ImChannel ===");
  console.log(channelMatch ? channelMatch[0] : "NOT FOUND");
  
  // Extract ImUser model
  const userMatch = schema.match(/model ImUser \{[^}]+\}/);
  console.log("\n=== Prisma ImUser ===");
  console.log(userMatch ? userMatch[0] : "NOT FOUND");
}

main().catch(console.error).finally(() => prisma.$disconnect());
