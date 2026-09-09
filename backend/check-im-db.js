
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Get all tables
    const tables = await prisma.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    console.log("=== IM-related tables ===");
    tables.filter(t => /im_|presence|follow|channel/i.test(t.tablename)).forEach(t => console.log("  " + t.tablename));
    
    // Check ImUserPresence
    console.log("\n=== ImUserPresence ===");
    try { 
      await prisma.imUserPresence.findFirst(); 
      console.log("  Table exists"); 
    } catch(e) { 
      console.log("  ERROR: " + e.message.split("\n").slice(0,3).join(" | ")); 
    }
    
    // Check UserFollow
    console.log("\n=== UserFollow ===");
    try { 
      await prisma.userFollow.findFirst(); 
      console.log("  Table exists"); 
    } catch(e) { 
      console.log("  ERROR: " + e.message.split("\n").slice(0,3).join(" | ")); 
    }
    
    // Check ImChannel
    console.log("\n=== ImChannel ===");
    try { 
      await prisma.imChannel.findFirst(); 
      console.log("  Table exists"); 
    } catch(e) { 
      console.log("  ERROR: " + e.message.split("\n").slice(0,3).join(" | ")); 
    }
    
  } catch(e) {
    console.error("DB Error:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
