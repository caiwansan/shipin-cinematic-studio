
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Check user_follow columns
  console.log("=== user_follow actual columns ===");
  try {
    const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_follow' ORDER BY ordinal_position");
    cols.forEach(c => console.log("  " + c.column_name + " (" + c.data_type + ")"));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 2. Check im_group columns
  console.log("\n=== im_group actual columns ===");
  try {
    const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='im_group' ORDER BY ordinal_position");
    cols.forEach(c => console.log("  " + c.column_name + " (" + c.data_type + ")"));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 3. Check im_channel_members columns
  console.log("\n=== im_channel_members actual columns ===");
  try {
    const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='im_channel_members' ORDER BY ordinal_position");
    cols.forEach(c => console.log("  " + c.column_name + " (" + c.data_type + ")"));
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
  
  // 4. Check if im_user_presence table exists
  console.log("\n=== im_user_presence check ===");
  try {
    const result = await prisma.$queryRawUnsafe("SELECT to_regclass('public.im_user_presence') as exists");
    console.log("  Table exists:", result[0].exists ? "YES" : "NO");
  } catch(e) { console.log("  ERROR:", e.message.split("\n")[0]); }
}

main().catch(console.error).finally(() => prisma.$disconnect());
