#!/usr/bin/env npx tsx
// scripts/migrate-governance-users.ts
// FIX 2026-07-23: B.2 Identity Convergence — 使用原始 SQL

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateGovernanceUsers() {
  console.log('=== B.2 Identity Migration ===\n');

  // 获取所有 governance_user
  const govUsers = await prisma.$queryRaw<Array<{
    id: string;
    email: string;
    role: string;
    metadata: any;
  }>>`SELECT id, email, role, metadata FROM governance_user`;

  console.log(`Total governance_user: ${govUsers.length}`);

  let migrated = 0;
  let skipped = 0;

  for (const gov of govUsers) {
    // 查找匹配的 User
    const existingUsers = await prisma.$queryRaw<Array<{
      id: string;
      email: string;
    }>>`SELECT id, email FROM "User" WHERE email = ${gov.email} LIMIT 1`;

    const existingUser = existingUsers[0];

    if (existingUser) {
      // OVERLAP: 创建 Extension 链接
      await prisma.$executeRaw`
        INSERT INTO user_identity_extension (user_id, governance_legacy_id, governance_role, governance_metadata, migrated_at)
        VALUES (${existingUser.id}, ${gov.id}, ${gov.role}, ${gov.metadata}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          governance_legacy_id = EXCLUDED.governance_legacy_id,
          governance_role = EXCLUDED.governance_role,
          governance_metadata = EXCLUDED.governance_metadata,
          migrated_at = NOW()
      `;
      migrated++;
    } else {
      // GOV_ONLY: 标记为系统账号
      await prisma.$executeRaw`
        UPDATE governance_user
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{migrationStatus}',
          '"SYSTEM_ACCOUNT_PRESERVED"'::jsonb
        )
        WHERE id = ${gov.id}
      `;
      skipped++;
    }
  }

  console.log(`迁移完成: ${migrated} OVERLAP, ${skipped} GOV_ONLY`);
}

migrateGovernanceUsers().catch(console.error).finally(() => prisma.$disconnect());
