# Runtime Criticality Matrix

> 系统文明化的模块治理地图。每个模块按 Runtime Criticality 分级，
> 不同等级适用不同的治理策略（TS 严格度、代码审查力度、部署门禁）。

## 等级定义

| 等级 | 含义 | 治理策略 | TS 政策 | 滚动回退 |
|------|------|----------|---------|---------|
| **P0 Runtime** | 运行主链，不可降级 | strict: true, noUnusedLocals: true, 全量测试 | STRICT | 失败自动回滚 |
| **P1 Active** | 活跃模块，核心业务 | strict: true, 核心路径测试 | STRICT | 人工确认 |
| **P2 Frozen** | 冻结兼容，不推荐改动 | strict: false, 仅编译检查 | RELAXED | 仅修复安全漏洞 |
| **P3 Experimental** | 实验模块，无 SLA | 无 TS 检查 | IGNORE | 无承诺 |

## 模块矩阵

### P0 Runtime（运行主链）

| 模块 | 路径 | 状态 | Owner | 说明 |
|------|------|------|-------|------|
| auth | `src/routes/auth.ts` | ACTIVE | core | JWT 认证，不能降级 |
| llm-gateway | `src/runtime/llm/` | ACTIVE | runtime | 所有 LLM 调用的统一入口 |
| narrative-gateway | `src/runtime/narrative-gateway.ts` | ACTIVE | runtime | 叙事流程的 LLM 调度 |
| provider-middleware | `src/runtime/provider-middleware.ts` | ACTIVE | runtime | Provider 路由和模型映射 |
| runtime-gateway | `src/runtime/runtime-gateway.ts` | ACTIVE | runtime | Wan 图生/文生视频网关 |
| resolveRuntimeConfig | `src/runtime/resolveRuntimeConfig.ts` | ACTIVE | runtime | 运行时配置解析 |
| model-adapters | `src/model-adapters/` | ACTIVE | runtime | LLM/Image/Video/TTS 适配器 |
| user-model-resolver | `src/services/user-model-resolver*.ts` | ACTIVE | runtime | 用户模型配置查询 |
| capability-registry | `src/capability-registry.ts` | ACTIVE | runtime | 能力注册和映射 |
| provider-registry | `src/core/provider-registry/` | ACTIVE | runtime | Provider 注册表 |
| unified-ai-gateway | `src/services/unified-ai-gateway.ts` | ACTIVE | runtime | 统一 AI 调用（含余额检查） |
| payment | `src/routes/payment.ts` | ACTIVE | core | 支付和订单，不可降级 |

### P1 Active（活跃核心模块）

| 模块 | 路径 | 状态 | Owner | 说明 |
|------|------|------|-------|------|
| user-center | `src/routes/user-center.ts` | ACTIVE | core | 用户中心 |
| member | `src/routes/member.ts` | ACTIVE | core | 会员体系 |
| gallery | `src/routes/gallery.ts` | ACTIVE | core | 图库 |
| narrative-llm | `src/routes/narrative-llm.ts` | ACTIVE | orchestration | 叙事生成 |
| storyboards | `src/routes/storyboards.ts` | ACTIVE | orchestration | 分镜生成 |
| tts | `src/routes/tts.ts` | ACTIVE | core | TTS 服务 |
| execution-images | `src/routes/execution-images.ts` | ACTIVE | orchestration | 执行中图片处理 |
| admin | `src/routes/admin-*.ts` | ACTIVE | core | 管理后台 |
| config | `src/config/` | ACTIVE | core | 配置管理 |
| runtime | `src/runtime/` (非 P0 部分) | ACTIVE | runtime | 运行时与编排 |
| api-router | `src/services/api-router.service.ts` | ACTIVE | runtime | API 路由服务 |
| cost-guard | `src/core/cost-guard.ts` | ACTIVE | runtime | 成本控制 |
| cost-intelligence | `src/observability/cost-intelligence.ts` | ACTIVE | runtime | 成本分析 |
| user-instance-registry | `src/core/runtime/user-instance-registry.ts` | ACTIVE | runtime | 用户运行时实例 |
| admin-members-storage | `src/routes/admin-members-storage.ts` | ACTIVE | core | 成员存储管理 |
| admin-global-config | `src/routes/admin-global-config.ts` | ACTIVE | core | 全局配置 |
| api-keys | `src/routes/api-keys.ts` | ACTIVE | core | API Key 管理 |
| models | `src/routes/models.ts` | ACTIVE | core | 模型管理 |

### P2 Frozen（冻结模块，不推荐改动）

| 模块 | 路径 | 冻结原因 |
|------|------|---------|
| aliyun-image.provider | `src/services/aliyun-image.provider.ts` | 迁移至 model-adapters |
| aliyun-llm.provider | `src/services/aliyun-llm.provider.ts` | 迁移至 model-adapters |
| aliyun-tts.provider | `src/services/aliyun-tts.provider.ts` | 迁移至 model-adapters |
| aliyun-video.provider | `src/services/aliyun-video.provider.ts` | 迁移至 model-adapters |
| volcengine-* | `src/services/volcengine-*.provider.ts` | 迁移至 model-adapters |
| siliconflow-tts | `src/services/siliconflow-tts.provider.ts` | 迁移至 model-adapters |
| with-user-key | `src/services/with-user-key.ts` | 被 API 路由替代 |
| user-model-resolver-v2 | `src/services/user-model-resolver-v2.ts` | 被 V2 配置覆盖 |

### P3 Experimental（实验模块）

| 模块 | 路径 | 状态 | 说明 |
|------|------|------|------|
| director-v2 | `src/director-v2/` | EXPERIMENTAL | 第二代导演系统，实验室 |
| replay-analytics | `src/replay-analytics/` | EXPERIMENTAL | 回放分析，研究项目 |
| optimization | `src/optimization/` | EXPERIMENTAL | 成本优化实验 |
| control-plane | `src/control-plane/` | EXPERIMENTAL | 控制面实验 |
| production-loop | `src/production-loop/` | EXPERIMENTAL | 生产循环实验 |
| graph-patch | `src/graph-patch/` | EXPERIMENTAL | 图补丁实验 |
| music | `src/services/music/` | EXPERIMENTAL | AI 音乐生成 |
| chaos-test | `src/chaos-test.ts` | EXPERIMENTAL | 混沌测试 |
| OMS | `src/oms/` (if exists) | LAB | 运营管理系统 |
| skeleton-compiler | `src/director-v2/runtime/skeleton-compiler.ts` | EXPERIMENTAL | V2 骨架编译器 |

## TS 错误分级规则

基于本矩阵，TS 错误的分级：

```text
P0 Runtime errors: <n>   → 需要立即修复
P1 Active errors: <n>    → 需要在 1 个 sprint 内修复
Frozen legacy ignored: <n> → 标记不修
Experimental ignored: <n> → 标记不修
```

## 规程

### 模块状态变更

- P2 → P0/P1: 需要重构后重新认证
- P3 → P0/P1: 需要完成生产就绪审查
- 任何模块降级需要 maintainer 批准

### CI 门禁

- P0/P1: 禁止新增 direct provider fetch (provider-boundary-check.ts)
- P0/P1: 禁止 `catch {}` 吞掉 runtime critical 错误
- P2/P3: 不设 CI 门禁

---

*初始化日期: 2026-05-31*
*版本: v1.0*
