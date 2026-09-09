const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  // Step 1: Fix Prisma schema - add @map("created_at") to UserFollow.createdAt
  let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
  
  // Fix UserFollow.createdAt - add @map("created_at")
  const followRegex = /(model UserFollow \{[^}]*?createdAt\s+DateTime\s+@default\(now\(\)\))/;
  if (followRegex.test(schema) && !schema.includes('@map("created_at")')) {
    schema = schema.replace(followRegex, 'createdAt   DateTime @default(now()) @map("created_at")');
    console.log("Fixed UserFollow.createdAt @map");
  } else if (schema.includes('@map("created_at")')) {
    console.log("UserFollow.createdAt already has @map");
  }
  
  // Step 2: Create im_user_presence table if it doesn't exist
  try {
    await prisma.imUserPresence.findFirst();
    console.log("im_user_presence table exists");
  } catch(e) {
    console.log("Creating im_user_presence table...");
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS im_user_presence (
      uid text PRIMARY KEY,
      online boolean NOT NULL DEFAULT false,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )`);
    console.log("im_user_presence table created");
  }
  
  // Step 3: Write fixed schema
  fs.writeFileSync('prisma/schema.prisma', schema);
  console.log("Schema saved");
  
  // Step 4: Verify
  const verify = fs.readFileSync('prisma/schema.prisma', 'utf8');
  const userFollowSection = verify.match(/model UserFollow \{[^}]+\}/);
  console.log("\n=== UserFollow after fix ===");
  console.log(userFollowSection[0]);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
