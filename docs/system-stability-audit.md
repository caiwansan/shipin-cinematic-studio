# System Stability Audit Report

**Auditor**: OpenClaw Production Stability Auditor
**Date**: 2026-05-20
**System**: shipin-cinematic-studio (昆仑镜 AI 短剧平台)

---

## Stability Score

| Module | Score | Key Issues |
|--------|-------|------------|
| Auth | B | Token 双键名兼容、wechat-oauth 类型错误 |
| User Model Config | C | API Key 持久化链路脆弱、部分字段前端未 await |
| Frontend State | D | 多真相源(localStorage/Pinia/session)、hydration 竞争、watch 覆盖 |
| Runtime / Pipeline | C | Graph 状态不可恢复、execution 无 checkpoint |
| TTS | B | 已修复路由，音色映射有兜底 |
| Queue / Worker | B | PostgreSQL SKIP LOCKED 基础可靠 |
| Persistence | D | refresh 后 runtime/project/studio 状态不可恢复 |
| Backend Build | C | Pre-existing tsc 类型错误(wechat-oauth/director-v2) |
| Build Output | C | chunk splitting 未优化、dynamic import 可能丢失 |

---

## Found Issues

### ISSUE-001

**Severity**: CRITICAL
**Category**: 状态持久化

**Problem**: 刷新页面后 runtime graph / production state 完全丢失

**Root Cause**: 
- Runtime state 仅存在 Pinia store 内存中，无持久化到 DB
- `projectHydration` store 只保存 characterSpecs/voiceConfigs，不保存 graph/execution state
- Studio 的 GraphEditor / Pipeline 状态仅靠 onMounted 加载，没有 reload recovery

**Impact**: 
- 用户每次刷新需重新配置 runtime pipeline
- 已生成的 AI 结果(图片/语音/视频)可能因元数据丢失无法复用

**Fix**:
- Runtime Graph 序列化到 `project.runtimeGraph` 字段(DB)
- Studio 初始化时检查 `runtimeGraph` 是否存在，恢复编辑器状态
- Execution results 按 projectId 持久化到 `executionResults` 表或 project JSON 字段

---

### ISSUE-002

**Severity**: CRITICAL
**Category**: 数据真相源

**Problem**: 供应商选择(`modelCardProviderMap`)存 localStorage、modelName 存后端 DB(UserModelConfig)、API Key 加密存DB——三者互相独立，没有原子一致性

**Root Cause**:
- `modelCardProviderMap` (localStorage) 是前端拍脑袋加的快捷方案
- 后端 `selectProvider` 函数同时依赖于环境变量和 DB 查询
- 保存 API Key 时前端调用 `/api/user-model-config` 但 `provider` 本身不在同一事务中
- 前端 `loadProviderMap()` 从 localStorage 恢复 provider，但 model 名从后端 `UserModelConfig` 恢复——如果两端不同步则显示不一致

**Impact**:
- 用户配置 A 供应商但显示 B
- 本地存储和后端数据不一致时行为不可预测

**Fix**:
- 将 `modelCardProviderMap` 信息合并到后端 `UserModelConfig`（每类 model 的 provider 字段）
- 或：`UserModelConfig` 为每 provider 一条记录，类型字段存 mapping
- 前端启动时以 DB 为 truth source，localStorage 仅做 fallback
- 供应商切换时同步更新 DB → 触发前端重新拉取

---

### ISSUE-003

**Severity**: HIGH
**Category**: 前端状态管理

**Problem**: `useProjectHydrationStore` 和 `usePipelineStore` 之间状态耦合，watch 链可能覆盖

**Root Cause**: 
- `VoiceGeneration.vue` 中 `onMounted` 同时执行 `hydrationStore` 恢复和角色数据加载
- hydration 完成后 watch 触发 pipeline stage 更新
- 无去重/版本控制，快速切换页面时 stale response 可能覆盖新状态

**Impact**:
- 角色配置丢失
- 已生成的 voice/image 被二次请求覆盖

**Fix**:
- 所有异步初始化增加 `isMounted` 保护
- API 请求增加 request dedupe/version tracking
- Pinia store 增加 `_version` 计数器，每次写入检查

---

### ISSUE-004

**Severity**: HIGH
**Category**: TTS Provider Routing（已部分修复）

**Problem**: 修复前 TTS 硬编码走 aliyun，不跟随用户选择

**Root Cause**: `apiRouter.selectProvider` 中 TTS 逻辑硬编码 `providers = ['siliconflow', 'aliyun', ...]` 遍历顺序固定

**Current Status**: ✅ 已修复——前端通过 `input.provider` 传递用户选择，后端 `selectProvider` 支持 `preferProvider` 参数

**Remaining Risk**: 
- 某些 provider handler(bailian) 未在 TASK_PROVIDERS 中注册为 tts
- Worker handler 中 bailian TTS 没有传 model 参数

---

### ISSUE-005

**Severity**: HIGH
**Category**: 后台管理

**Problem**: `/admin/aigc/vip` 页面使用前端 mock 数据，刷新后重置

**Root Cause**: VIP 套餐管理页面没有后端 API 支持，数据存前端内存数组

**Impact**: 后台添加/修改的 VIP 套餐刷新消失

**Fix**: 创建 DB 表 `vipPlans` + CRUD API + 前端接入

---

### ISSUE-006

**Severity**: MEDIUM
**Category**: 前端构建

**Problem**: 多次 rebuild 导致 `.output` 中 buildId 变更，浏览器缓存旧 chunk URL → 500

**Root Cause**: Nuxt 每次 build 生成新 hash，nginx/CDN 缓存了旧 `.js`/`.css` 文件

**Impact**: 用户 browser cache 了 old chunk → 加载失败(白屏/500)

**Fix**: 
- Nginx 配置强 cache-control for hashed assets(`*.hash.js`)
- 部署时增加版本号或全量清除 CDN 缓存
- 前端增加 `window.__BUILD_VERSION__` 用于检测版本不一致

---

### ISSUE-007

**Severity**: MEDIUM
**Category**: 竞态条件

**Problem**: `submitAiTask` 函数使用 SSE 监听任务完成，无 AbortController/超时清理

**Root Cause**: 
- SSE EventSource 在组件 unmount 时未关闭
- 没有请求超时机制
- 无去重：同一个 taskType 可能同时发起多个请求

**Impact**: 切换到其他页面后 SSE 继续监听，可能导致状态错误或内存泄漏

**Fix**: 
- 组件内使用 `onUnmounted(() => eventSource.close())`
- `submitAiTask` 增加 AbortController 参数
- 同类型任务 inflight 检测

---

### ISSUE-008

**Severity**: MEDIUM
**Category**: 后端类型安全

**Problem**: 后台有 5 个 pre-existing 类型错误（wechat-oauth.ts 3 个、director-v2 测试 2 个），tsc --noEmit 时暴露

**Root Cause**: 
- `wechat-oauth.ts` 引用了 `avatar` 字段（Prisma schema 中可能没有）和 `jsonwebtoken` 类型包
- director-v2 测试文件类型不严谨

**Impact**: 部署时被 tsc 容忍（编译成功），但可能在生产中出现运行时错误

**Fix**: 
- `npm i -D @types/jsonwebtoken`
- 修复 avatar 类型或 Prisma schema
- 将 director-v2 测试移出 tsc 编译范围

---

### ISSUE-009

**Severity**: LOW
**Category**: CSS/UI

**Problem**: logo 透明背景处理使用了 Color Deviation < 35 / distance > 0.35 radius 的启发式抠图，可能误伤部分图像

**Root Cause**: 原图是 1850x1850 灰色不透明背景，PIL 基于颜色亮度偏差逐像素去除

**Impact**: 
- 如果 logo 内部有灰色像素可能被误裁
- 120x120 分辨率较低

**Fix**: 
- 保持现状（已满足需求），后续可换用更精确的 rembg 方案

---

### ISSUE-010

**Severity**: LOW
**Category**: TTS 音色映射

**Problem**: 硅基流动 CosyVoice2 只支持 8 个固定音色名，前端传其他音色名时报 400

**Root Cause**: `siliconflow-tts.provider.ts` 中 PRESET_VOICES 不完整

**Current Status**: ✅ 已修复——补全了所有前端音色的映射 + 不匹配时用 benjamin 兜底

---

## Architecture-Level Risks

### Risk 1: Multi-Source of Truth 🔴

```
User Model Config:
  ├── localStorage: modelCardProviderMap (provider)
  ├── DB UserModelConfig: apiKey, modelName, enabled
  └── process.env: runtime injected keys (volatile)
```

**Impact**: 用户设置在哪改、哪存、哪读的定义不清晰

**Recommended Fix**: 统一到 DB + 单一路由策略

---

### Risk 2: Runtime State Non-Recoverable 🔴

```text
Graph Editor State:    Pinia memory only
Execution Results:     Pinia memory only  
Pipeline Progress:     Pinia memory only
```

刷新页面 → 全部丢失

**Recommended Fix**: 
- 关键状态 checkpoint 到 DB
- 恢复逻辑：onMounted → 检查 DB → 恢复 Pinia

---

### Risk 3: Frontend Hydration Race 🔴

```text
onMounted() {
  loadFromLocalStorage()  // sync
  fetchFromAPI()          // async - 晚于 onMounted 完成
}
// 如果 hydration 和 fetch 顺序不定 → state 覆盖
```

**Recommended Fix**: Loading state guards + 版本化更新

---

### Risk 4: No Staging Environment 🟡

```text
Dev → Production 直接部署
```

无预发布环境验证新改动对现有数据的影响

---

## Production Readiness Assessment

### Overall Verdict: NOT_READY

| Criterion | Status | Notes |
|-----------|--------|-------|
| 刷新不丢数据 | ❌ | Runtime/Studio 状态丢失 |
| 页面切换不崩 | ⚠️ | 基本可用，但偶有 hydration 竞争 |
| 长时间运行不泄漏 | ? | 未测试超过 2 小时 |
| 状态始终一致 | ❌ | 多真相源不一致 |
| Runtime 可恢复 | ❌ | 刷新后丢失 |
| Queue 不丢任务 | ✅ | PostgreSQL SKIP LOCKED 可靠 |
| API 不假成功 | ⚠️ | 部分 endpoint 前端 toast 后未 verify |
| Build 后行为一致 | ⚠️ | chunk cache 可能导致旧版本 |

### Risk Assessment: RISKY

核心功能(TTS/图片/视频生成)在单次 session 内工作正常，但：
- 刷新后需重新配置
- 多标签页/长时间运行未验证
- 数据一致性靠前端自律

**不建议正式运营**，需先修复 P0 问题。

---

## Priority Fix Plan

### P0 (必须在运营前修复)

1. **Runtime State Persistence** — Graph + Execution 结果持久化到 DB
2. **Single Source of Truth for Provider Config** — 合并 localStorage + DB 为单一真相源

### P1 (上线后尽快修复)

1. SSE / AbortController cleanup
2. Watch 链保护/去重
3. VIP 套餐后台 API
4. Nginx cache 策略
5. VIP 套餐页三列布局 UI fix

### P2 (低优先级)

1. Pre-existing tsc 类型错误清理
2. Build chunk splitting 优化
3. director-v2 测试文件整理
