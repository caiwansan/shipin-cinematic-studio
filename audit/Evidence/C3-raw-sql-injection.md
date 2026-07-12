# Evidence: C3 — Raw SQL 注入风险

- **问题**: 大量使用 `$executeRawUnsafe`/`$queryRawUnsafe`
- **严重等级**: CRITICAL
- **所在文件**: `backend/src/routes/*.ts`, `backend/src/services/*.ts`
- **涉及模块**: 数据库操作
- **影响范围**: >= 30 处 raw SQL 调用, 部分拼接字符串
- **原因分析**: 混用 Prisma ORM 和 Raw SQL
- **修复建议**: 替换为 Prisma ORM 方法或参数化查询
- **预计工作量**: 3-5 天
- **风险等级**: CRITICAL

**关键文件**:
- `routes/platform/admin-platform-runtime.route.ts` — 多处 `$queryRawUnsafe`
- `routes/admin-wallet.ts` — `$executeRawUnsafe`
- `routes/admin-prompt-telemetry.ts` — `$queryRawUnsafe`
- `routes/wallet.ts` — 多处 raw SQL 拼接
- `routes/voice.ts` — `$executeRawUnsafe`
- `routes/hdz/project.ts` — `$queryRawUnsafe`
- `services/observability.service.ts` — `$queryRawUnsafe`
- `services/storage-policy.service.ts` — raw SQL
- `services/asset-duplicate.service.ts` — raw SQL

**完整命令**: 见 Audit N SecurityAudit.md
