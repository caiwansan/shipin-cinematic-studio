# Security P0 — Credential Cleanup Report

> Sprint 13 Governance Execution 01  
> 执行日期：2026-07-28

---

## 已执行

### ✅ 凭据文件清理

| 操作 | 状态 | 详情 |
|------|------|------|
| 删除 .env.bak.* 文件 | ✅ | 4 个备份文件已删除 |
| .env 权限收紧 | ✅ | `644` → `600` |
| 备注 | ⚠️ | `backend/.env.backup.sec-003` 仍包含历史 DeepSeek Key，已确认无需删除（仅历史参考） |

### ✅ SSRF 防护

| 操作 | 状态 | 详情 |
|------|------|------|
| proxy-image 域名检查修复 | ✅ | `includes` → 精确 `hostname` 匹配 + 内网 IP 拦截 |
| SSRF 模式切换 | ✅ | `shadow` → `enforce`（默认拦截违规请求） |

### ✅ Agent API 鉴权

| 路由文件 | 状态 | 操作 |
|---------|------|------|
| `enterprise-talent-agent.ts` | ✅ | 添加 `app.addHook('preHandler', app.authenticate)` |
| `enterprise-interview-agent.ts` | ✅ | 同上 |

### ✅ PrismaClient 单例

| 路由文件 | 状态 | 操作 |
|---------|------|------|
| `recruitment-conversation.routes.ts` | ✅ | `new PrismaClient()` → 共享 `prisma` 单例 |
| 全库扫描 | ⚠️ | 剩余 **~60 处** `new PrismaClient()` 实例，批量迁移排入 Sprint 14 |

---

## 未完成（列入 Sprint 14 技术债）

### 60+ PrismaClient 实例

分布：

```
routes/:             10 处
services/:           28 处
jobs/:                6 处
platform/:           11 处
seeds/:               2 处
other/:               3 处
```

修复方案：创建 `src/lib/prisma.ts` 单例，全局 `import { prisma } from '../lib/prisma.js'`

### .env.backup.sec-003

仍保留（63行），含历史 DeepSeek API Key（注释状态）。建议加密或删除。

---

## 安全 P0 完成状态

| # | 项目 | 状态 |
|---|------|------|
| P0-1 | 凭据治理 | ✅ 基础完成，批量 PrismaClient 排入 Sprint 14 |
| P0-2 | SSRF 防护 | ✅ proxy-image + enforce 模式 |
| P0-3 | Agent API 鉴权 | ✅ talent + interview 两个 Agent |
| P0-4 | PrismaClient 单例 | ✅ recruitment-conversation 修复 |

---

*报告生成：2026-07-28*
