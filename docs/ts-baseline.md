# TypeScript 基线报告

> 更新时间：2026-07-24
> 分支：feat/p1-a-member-tier-20260724

## 当前全量编译

**2285 处报错**

## P0 阶段登记

P0 阶段部分扫描登记了 28 处。

## P1-A 阶段全量编译

全量编译后发现实际基线为 **2285 处**，差异来自大量预存类型错误：

- `decision-runtime/` — 整个目录
- `director-v2/` — 整个目录
- `hdz/` — 整个目录
- `services/geo/` — 整个目录
- `runtime/` — 整个目录
- `core/`、`production-loop/`、`replay-*` 等模块

## P1-A 修改文件 TS 状态

| 文件 | 报错数 | 备注 |
|------|--------|------|
| `src/utils/memberTierGuard.ts` | 0 | ✅ 新增 |
| `src/middleware/require-member-tier.ts` | 0 | ✅ 扩展 |
| `src/config/routeTierPolicy.ts` | 0 | ✅ 新增 |
| `src/routes/legal/legal-agent-chat.route.ts` | 12 | 全部预存（Prisma 模型命名） |
| `src/routes/workbench-director.ts` | 3 | 全部预存（RenderExecutor.tick） |
| `src/routes/ai-optimize-ad-script.ts` | 0 | ✅ |
| `src/routes/ai-optimize-image-prompt.ts` | 0 | ✅ |
| `src/routes/ai-optimize-video-prompt.ts` | 0 | ✅ |

## P1-A 引入新报错

**0 处。** P1-A 未引入任何新的 TypeScript 报错。

## 基线日志

`/tmp/fushtn_audit/ts-baseline-2285.log`

## 处理原则

- 不在 P1-A 修复 2285 处预存报错
- 不启动大规模 TS 重构
- 后续单独建立 P2-TS-DEBT 专项
- 新代码必须保证零新增 TS 报错
