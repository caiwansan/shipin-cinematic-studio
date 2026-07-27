const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Tables with organization_id
  const tablesWithOrg = await prisma.$queryRaw`
    SELECT DISTINCT table_name
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'organization_id'
    ORDER BY table_name`;
  
  console.log('=== Tables WITH organization_id (' + tablesWithOrg.length + ') ===');
  const orgSet = new Set(tablesWithOrg.map(t => t.table_name));
  
  // 2. Count rows for each
  for (const t of tablesWithOrg) {
    const r = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "' + t.table_name + '"');
    console.log('  ' + t.table_name + ': ' + r[0].cnt + ' rows');
  }
  
  // 3. ALL tables
  const allTables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  console.log('\nTotal tables: ' + allTables.length);
  
  // 4. Enterprise-relevant tables without organization_id
  const enterpriseKeywords = ['agent', 'workflow', 'channel', 'knowledge', 'employee', 'decision', 'signal', 'outcome', 'roi', 'recommendation', 'command', 'action', 'event', 'content', 'lead', 'intelligence', 'sync_log'];
  const suspicious = allTables.filter(t => {
    if (orgSet.has(t.table_name)) return false;
    const lower = t.table_name.toLowerCase();
    return enterpriseKeywords.some(k => lower.includes(k));
  });
  console.log('\n=== Enterprise-suspicious tables WITHOUT organization_id ===');
  for (const t of suspicious) {
    console.log('  - ' + t.table_name);
  }
  
  // 5. Governance user count
  const uc = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "governance_user"');
  console.log('\ngovernance_user: ' + uc[0].cnt);
  
  const oc = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "Organization"');
  console.log('Organization: ' + oc[0].cnt);
  
  const goc = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "governance_organization"');
  console.log('governance_organization: ' + goc[0].cnt);
  
  const om = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "OrgMember"');
  console.log('OrgMember: ' + om[0].cnt);
  
  const ep = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "enterprise_profile"');
  console.log('enterprise_profile: ' + ep[0].cnt);
  
  const ap = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "enterprise_agent_profile"');
  console.log('enterprise_agent_profile: ' + ap[0].cnt);
  
  const pc = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "enterprise_provider_credential"');
  console.log('enterprise_provider_credential: ' + pc[0].cnt);
  
  const ch = await prisma.$queryRawUnsafe('SELECT COUNT(*) as cnt FROM "enterprise_channel"');
  console.log('enterprise_channel: ' + ch[0].cnt);
}

main().finally(() => prisma.$disconnect());
