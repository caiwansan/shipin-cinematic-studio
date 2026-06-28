# Production Readiness Report

**Date**: 2026-05-20
**System**: 昆仑镜 AI 短剧制作平台 (aigc.fushtn.com)
**Target Audience**: CTO / Product Owner

---

## Executive Summary

昆仑镜系统目前在单次 session 内核心功能（TTS、图片生成、视频生成、剧情编排）可正常运行。但**系统性数据持久化缺失**和**前端状态管理脆弱**使得系统无法可靠地支持正式运营。

**评级：NOT_READY**

---

## Go/No-Go Checklist

| # | Criterion | Status | Details |
|---|-----------|--------|---------|
| 1 | 刷新页面不丢失用户配置 | ❌ | provider选择、runtime graph、production 状态丢失 |
| 2 | API Key 保存后可用 | ⚠️ | 加密存储OK，但路由逻辑有竞态 |
| 3 | 多 tab 同时操作不冲突 | ? | 未测试 |
| 4 | 长时间运行(2h+)不泄漏 | ? | 未测试 |
| 5 | TTS 按用户配置正确路由 | ✅ | 刚修复，已验证 |
| 6 | 图片/视频生成稳定 | ⚠️ | 基本可用，偶有 provider 限流错误 |
| 7 | 后台管理数据可持久化 | ❌ | VIP 套餐管理使用 mock 数据 |
| 8 | 部署刷新不出现 500 | ⚠️ | 需手动清除 .nuxt .output，否则可能缓存旧 chunk |
| 9 | 构建产物一致 | ⚠️ | 增量构建可能保留旧文件 |
| 10 | 用户认证可靠 | ✅ | JWT 双 key 兼容，基本可靠 |

---

## Risk Heatmap

```text
CRITICAL  ████████████████████████████████████░░  Runtime State Persistence
CRITICAL  ██████████████████████████████████░░░░  Multi-Source of Truth
HIGH      ████████████████████████████░░░░░░░░░░  Hydration Race
HIGH      ████████████████████████░░░░░░░░░░░░░░  process.env Key Injection Leak
MEDIUM    ██████████████████░░░░░░░░░░░░░░░░░░░░  SSE Not Cleaned Up
MEDIUM    ██████████████░░░░░░░░░░░░░░░░░░░░░░░░  VIP Plan Backend Not Implemented
LOW       ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Pre-existing tsc Errors
LOW       ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Build Cache Stale Chunks
```

---

## Recommended Path to Launch

### Phase 1: Critical Fixes (1-2 days)

1. **Runtime State Persistence**
   - Graph + Execution Results → DB
   - Studio 恢复逻辑
   - 这是**最大的投资者风险**——演示时刷新全丢

2. **Single Source of Truth**
   - 将 provider 选择合并到 UserModelConfig
   - 或创建新的 `UserModelTypeProvider` 表
   - 让 DB 成为唯一真相源

3. **process.env Key Fix**
   - Worker 中直接传 key 而非通过 env 变量

### Phase 2: Stability (2-3 days)

1. SSE cleanup + AbortController
2. Watch chain 保护
3. PINIA store 版本化更新
4. Nginx cache 策略优化

### Phase 3: Admin & Polish (1-2 days)

1. VIP 套餐后台 API
2. VIP 套餐页 UI 优化
3. Build process 自动化

---

## Minimum Viable Launch Criteria

如果必须在**明天**上线，以下是必须修复的 3 个问题：

### Must Fix #1: Runtime Persistence (P0)
```text
Failure Mode: 用户编排好 pipeline → 刷新 → 全部消失
Impact: 用户信任崩塌，无法继续使用
Fix Complexity: Medium
```

### Must Fix #2: Provider Config Missing on Refresh (P0)
```text
Failure Mode: 保存大模型设置 → 刷新 → 选的 provider 消失
Impact: 用户以为已配置，实际没有
Fix Complexity: Low (但需要设计）
```

### Must Fix #3: process.env Pollution (P0)
```text
Failure Mode: 用户A 和用户B 同时生成语音，可能混用 API Key
Impact: 隐私和安全问题
Fix Complexity: Low
```

---

## Conclusion

**不建议现在正式运营，但可以开放加白名单内测。**

如果修复了 P0 的三个问题，可以升级为：

**CONDITIONALLY_SAFE**
- 核心功能可用
- 数据不丢失
- 但多 tab 和长运行时间仍需观察

---

## Next Actions

1. ✅ 你已收到完整的审计报告（5 份文档）
2. 决定是否开启 P0 修复 sprint
3. 如果批量修复，建议创建子 agent 并行处理
4. 修复后重新审计评分
