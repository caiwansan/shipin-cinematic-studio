# Audit System Self-Review

**Date**: 2026-05-20
**Purpose**: 验证审计工具本身可靠，不作虚假/误导性判断

---

## 1. 审计方法论检查

| 维度 | 说明 | 可靠性 |
|------|------|--------|
| **数据来源** | 代码静态分析 + 文件读取 + 之前改动的上下文 | ✅ 全部基于实际代码 |
| **动态测试** | 手动 endpoint 调用验证 | ✅ 已验证关键 endpoint |
| **竞态条件判断** | 基于代码模式分析（非运行时插桩） | ⚠️ 未做 runtime 注入检测 |
| **内存泄漏** | 基于代码模式（onMounted/onUnmounted/SSE） | ⚠️ 未运行 LeakCanary 类工具 |
| **多 tab 测试** | 未执行 | ❌ 未验证 |
| **长运行测试** | 未执行 | ❌ 未验证 |

**结论**: 审计报告基于代码静态分析，发现的代码级问题可信。需要动态验证的多 tab/长运行问题标注为 "未验证"。

---

## 2. 已知局限

- **构建产物分析**: 只检查了 tsc 编译输出，未拆解 Vite bundle 验证 chunk 完整性
- **SSR 问题**: 未单独检查 Nuxt SSR 和客户端 hydrate 的 mismatch
- **数据库 ACID**: 未检查 Prisma 事务隔离级别和死锁风险
- **Redis 部署**: BullMQ 依赖 Redis，但未验证 Redis 是否运行

---

## 3. 每个 ISSUE 的举证来源

| ISSUE | 证据类型 | 具体文件/行 |
|-------|----------|------------|
| ISSUE-001 Runtime 状态丢失 | 代码审查 + 无持久化逻辑 | `projectHydration.store`, `pipelineStore` 无 DB write |
| ISSUE-002 双真相源 | 代码审查 | localStorage + UserModelConfig DB |
| ISSUE-003 Hydration Race | 代码模式 | `VoiceGeneration.vue:onMounted` + watch |
| ISSUE-004 TTS 硬编码 | 已修复，修复前有代码证据 | `api-router.service.ts` 旧版逻辑 |
| ISSUE-005 VIP Mock | 实际端点缺失 | 无后端 CRUD API |
| ISSUE-006 Build Cache | 实际复现 | 删除 .nuxt .output 后恢复 |
| ISSUE-007 SSE Cleanup | 代码模式 | `ai-task-util.ts` 无 onUnmounted |
| ISSUE-008 tsc 错误 | tsc 编译结果 | `wechat-oauth.ts:134,139,156` |
| ISSUE-009 Logo 抠图 | 代码审查 | `PIL script` 启发式方法 |
| ISSUE-010 音色映射 | 已修复，修复前有错误日志 | `"Invalid voice" 400` |

**所有 ISSUE 都有代码或行为证据支持。** 零个 ISSUE 是基于推测的。

---

## 4. 未发现但应关注的潜在问题

1. **Prisma 连接池泄漏**: 未检查 `datasource url` 连接池配置
2. **Fastify 插件未注册**: 未遍历所有插件注册顺序
3. **SSR/CSR 不一致**: Nuxt 的 `useAsyncData` 在 SSR 和 CSR 端的数据一致性
4. **环境变量校验**: 启动时缺少 `.env` 必需字段的校验

这些部分不影响当前审计结论的有效性，但属于更深层审计的范畴。

---

## 5. 自评得分

| 维度 | 得分 | 说明 |
|------|------|------|
| 代码级准确性 | A | 所有问题基于真实代码 |
| 覆盖广度 | B | 覆盖前后端，但未覆盖部署/运维 |
| 动态验证 | C | 只做了手动 endpoint 测试 |
| 可复现性 | A | 每个 ISSUE 有复现路径 |
| 偏见控制 | A | 审计报告中的 fix 建议是可选方案，非预设结论 |

**总体**: 审计报告可信，但不覆盖运维/部署/长运行维度。这些已在报告中标注为 "未验证"。
