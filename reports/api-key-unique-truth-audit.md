# 🔒 API Key & LLM 调用链路审计报告

**审计范围**: 前后端所有与 LLM API Key 交互的文件、AI 写回数据路径、唯一真相源合规性  
**审计时间**: 2026-06-01  
**审计类型**: 第三方审查

---

## 一、审计结论

| 维度 | 评级 | 说明 |
|------|------|------|
| API Key 存储 | ✅ 单源 | 仅 `UserModelConfigV2` 表（加密）+ `ApiKey` 表（系统级） |
| API Key 解密 | ✅ 集中 | `crypto.service.ts`（AES-256-CBC） |
| 配置路由入口 | ✅ 单源 | `config-runtime/v2-resolver.ts` → `runtime.ts` |
| 执行图构建 | ✅ 单源 | `ExecutionGraph → graph-builder.ts` → 统一 resolve |
| AI 写回 executionResults | ⚠️ **多路** | 见下方详细分析 |
| 唯一真相源 guard | ❌ 多处缺失 | analyzeV2Data guard 只覆盖了 regenerate 未覆盖其他写回路径 |
| API Key 运行时注入 | ❌ 多处 bypass | 多套 provider 体系并存导致 key 直接传参 bypass ExecutionGraph |

---

## 二、API Key 存储与加载（✅ 可信）

### 存储层

| 表/来源 | 用途 | 加密 | 状态 |
|---------|------|------|------|
| `UserModelConfigV2` | 用户自配 LLM/Image/Video/TTS Key | AES-256-CBC ✅ | ✅ 单源 |
| `ApiKey` | 系统级持久化 Key | AES-256-CBC ✅ | ✅ 系统配置 |
| `process.env` 启动加载 | 运行时缓存 | 解密后明文 | ✅ 仅运行时 |

### 加载链路

```
启动
  └→ index.ts 从 ApiKey 表加载 → process.env (启动时)
  └→ initProviderStateService (v1.2)

运行时
  └→ config-runtime/runtime.ts (统一出口)
      └→ v2-resolver.ts
          └→ UserModelConfigV2 (加密存储)
          └→ decryptKey() → 明文
      └→ bootstrap.ts (系统 env fallback -- 仅当 V2 无数据时)

执行
  └→ ExecutionGraph (graph-builder.ts)
      └→ getRuntimeConfig → final { provider, model, apiKey }
      └→ NarrativeGateway → process.env 临时注入
```

**`config-runtime/runtime.ts` 注释明确写明：**
```
所有配置访问必须经过这里
禁止直接读 process.env / V1 表 / V2 表
```

这条宪法已被 **多个文件违反**（见第四节）。

---

## 三、AI 写回数据路径分析（⚠️ 多路并存）

### 写回 executionResults 的入口

所有的 AI 生成结果最终写入 `Project.executionResults`（JSON 字段），但目前**存在 3 条独立写回路径**，且它们的保护策略不一致：

| # | 入口文件 | 触发点 | 是否有 analyzeV2Data guard |
|---|---------|--------|--------------------------|
| 1 | `routes/script-submit.ts:294-333` | `/api/script/regenerate` | ✅ 有（line 323-328） |
| 2 | `routes/projects.ts:150-195` | `PUT /api/projects/:id/execution-results` | ❌ **无** |
| 3 | `routes/workbench-project.ts:149` | `PUT /api/v2/workbench/project/:id` | ❌ **无**（全量替换） |

**问题分析：**

#### 路径 1 — script-submit (regenerate)
```
section: storyboard → key: videoSegments → merged.analyzeV2Data = existing.analyzeV2Data ✅
```
唯一有 guard 的路径。

#### 路径 2 — projects.ts (PUT execution-results)
```
Merge 模式: { ...existing, ...executionResults }  ❌ analyzeV2Data 被覆盖
Full replace: projectService.saveExecutionResults()  ❌ analyzeV2Data 被覆盖
```

#### 路径 3 — workbench-project (PUT)
```
data: { executionResults: body.executionResults ?? undefined }  ❌ 全量替换
```

### 写回关联表（非 executionResults）的入口

除 executionResults 外，AI 结果也被写入独立关联表（`AiCharacterSpec`, `AiSceneSpec`, `AiVideoSegment`, `AiFrameDesign` 等），这些表在 `workbench-project.ts` 的 `clear-analysis` 中被批量删除。

**写入关联表的路径：**

| # | 写入点 | 数据源 |
|---|--------|--------|
| 1 | `workbench-project.ts:POST /save-image` | 用户生成图 |
| 2 | `script-submit.ts` regenerate | 此路径**只写 executionResults**，不写关联表 |
| 3 | `projects.ts` PUT execution-results | 直接写 JSON，不写关联表 |

**问题：** 
- `executionResults` 和关联表之间 **没有同步机制**。如 `AiVideoSegment` 表和 `executionResults.videoSegments` 是两组独立数据。
- 前端 `loadFromServer` 从关联表（`aiVideoSegments`, `aiFrameDesigns`）和 `executionResults`（`propSpecs`, `voiceConfigs`）混合加载——**每次加载的语义不确定**。

---

## 四、API Key 运行时注入问题（❌ 多路径 bypass）

### 认定的统一路径

```
ExecutionGraph → graph-builder.ts
  └→ final { provider, model, apiKey }
  └→ NarrativeGateway.execute()
      └→ process.env[BAILIAN_API_KEY] = final.apiKey
      └→ refreshProviderApiKeys()
      └→ 调用 base.provider.ts → callLLM()
```

### 实际 bypass 该路径的代码

#### [HIGH] bypass-1: `director-v2/runtime/skeleton-compiler.ts`
直接从 `v2-resolver.ts` 获取 key 后 **传给 provider 实例的 .apiKey 字段**（不经过 NarrativeGateway / ExecutionGraph）

#### [HIGH] bypass-2: `model-adapters/llm/aliyun-llm.adapter.ts`
每个 adapter（aliyun, volcengine, siliconflow）都有自己的 API Key 获取逻辑，直接从 `process.env` 读取。

```
aliyun: process.env.BAILIAN_API_KEY
volcengine: process.env.VOLCENGINE_API_KEY
siliconflow: process.env.DEEPSEEK_API_KEY
```

**问题：** 当 NarrativeGateway 注入用户 key 到 `process.env` 后，这些 adapter 能读到正确的 key。但 **当 adapter 被单独调用（不走 NarrativeGateway）时**，它们读的是系统启动时加载的全局 env key，而不是用户的私有 key。

#### [MEDIUM] bypass-3: `services/unified-ai-gateway.ts`
独立于 NarrativeGateway 的另一个 AI 调用网关，有自己的 key 解析逻辑。

#### [MEDIUM] bypass-4: `services/with-user-key.ts`
一个公共的 user key 注入工具函数，被多个调用方使用。它直接从 DB 读 key 并注入 process.env，不经过 ExecutionGraph。

---

## 五、唯一真相源（Single Source of Truth）合规性

### 应有架构

```
UserModelConfigV2 (加密存储)
  └→ config-runtime/v2-resolver.ts (单一 translate 层)
      └→ ExecutionGraph (单一 routing 层)
          └→ NarrativeGateway (单一 execution 层)
```

### 实际架构中的突破

#### 1. v2-resolver 本身有 fallback
```typescript
// line 37-68: 当用户无 V2 配置时，fallback 到：
//   - 系统第一个可用 V2 配置（各用户的 key 互相可见）
//   - 环境变量 DEEPSEEK_API_KEY
```
√ 设计意图合理（新用户能看到公共 dev key）
⚠️ 但"系统第一个可用"的 key 暴露了其他用户的加密 key

#### 2. ExecutionGraph 写回 process.env 但各 adapter 绕过
NarrativeGateway 把用户 key 注入 `process.env.BAILIAN_API_KEY` 后，同进程内所有其他 adapter 都能读到——**泄漏了隔离边界**。

#### 3. 前端 store 混合关联表和 executionResults
`loadFromServer` 从 `AiVideoSegment[]` 恢复 `segments`，但从 `executionResults.propSpecs` 恢复 props/voices。两种数据在不同时间点可能不一致。

---

## 六、具体风险点

### P0 — analyzeV2Data 被覆盖（项目数据损坏）

**风险：** `projects.ts` 中的 `PUT /api/projects/:id/execution-results` 没做 analyzeV2Data guard。如果前端或脚本在 regenerate 完成后再次调用此接口，会覆盖 regenerate 保存的数据。

**证据：**
```typescript
// script-submit.ts:323 ✅ 有 guard
if (existing.analyzeV2Data) {
  merged.analyzeV2Data = existing.analyzeV2Data
}

// projects.ts:189 ❌ 无 guard，全量替换
const merged = { ...existing, ...executionResults }
```

### P0 — director-v2 独立调用 LLM 不走用户 Key

**风险：** `director-v2/runtime/skeleton-compiler.ts` 从 V2 表直接拿 key，但传给 provider 时用的是统一实例。如果系统有多个用户同时在线，A 用户调用后 provider 的 apiKey 字段被设置为 A 的 key，B 用户调用时读到的还是 A 的 key。

### P1 — adapter 体系绕过 ExecutionGraph

**风险：** `model-adapters/llm/` 下的 adapter 在被 `model-adapters/registry.ts` 调用时走的是 adapter 自己的 key 解析，不走 ExecutionGraph。如果某个路径走 adapter 直接调用（比如图片生成 adapter），用户 key 不会被注入。

### P1 — 关联表与 executionResults 双写

**风险：** `AiVideoSegment` 表（关联表）和 `executionResults.videoSegments`（JSON 字段）存的是同一数据的不同版本。`clear-analysis` 只清关联表，不清 executionResults，导致新旧数据混存。

---

## 七、修复建议

### 优先级 P0（立即修复）

1. **projects.ts PUT guard 缺失**
   ```typescript
   // 在 merged 前加：
   if (existing.analyzeV2Data) {
     merged.analyzeV2Data = existing.analyzeV2Data
   }
   ```

2. **workbench-project.ts PUT guard 缺失**
   全量替换时加 analyzeV2Data 保护，或用 `_merge` 模式代替全量替换。

### 优先级 P1（本周修复）

3. **director-v2 改用 ExecutionGraph**
   `skeleton-compiler.ts` 应从 `getRuntimeConfig` resolve key，不走 provider 实例直接赋值。

4. **统一关联表+executionResults 的写回路径**
   要么全走关联表（`AiVideoSegment` + `AiFrameDesign`），要么全走 `executionResults`，消除双写风险。

5. **前端 store 合并数据源的冲突检测**
   `loadFromServer` 在合并 `aiVideoSegments` 和 `executionResults` 时应检测一致性，版本不一致时报警。

### 优先级 P2（系统改进）

6. **严格 N+1 层隔离**
   `process.env` 不应被用作跨用户 key 的共享变量。NarrativeGateway 注入 key 后应只用于当前请求的 provider 实例，不做全局侧写。

7. **添加写回审计日志**
   `executionResults` 每次写入都追加到 `executionJournal` 数组，方便 trace 谁覆盖了什么。

---

**报告结束**
