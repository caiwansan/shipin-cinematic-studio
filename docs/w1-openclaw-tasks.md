# W1 OpenClaw 施工任务清单

> **执行契约（所有任务必须遵守）：**
> 1. 所有 AI 调用必须走 AI Gateway（含 Envelope）
> 2. 所有资产必须符合 Canonical Schema
> 3. 所有状态变更必须通过 State Machine
> 4. 所有优化必须生成 version
> 5. 所有关联必须写入 continuity_links

---

## Lane A：核心数据层（必须先做）

### A1. Asset Canonical Schema + Registry

**路径：** `backend/prisma/schema.prisma`

**输入：** W1 Blueprint §1 — AssetCanonicalCharacter/Scene/Storyboard/Keyframe/Shot 接口定义 + AssetRegistry 表

**任务：**
1. 新增 `AssetRegistry` 表（projectId, type, sourceId, status, currentVersion, sortOrder）
2. 新增 `AssetGraphEdge` 表（预留，仅 Schema 定义，W1 不实现逻辑）
3. 在 `backend/src/services/` 新建 `asset-canonical.schema.ts`
   - 定义 5 类 TypeScript 接口：`AssetCanonicalCharacter`, `AssetCanonicalScene`, `AssetCanonicalStoryboard`, `AssetCanonicalKeyframe`, `AssetCanonicalShot`
   - 导出校验函数 `validateCanonical<T>(type, data): { valid: boolean, errors: string[] }`
4. `backend/src/routes/asset-registry.ts`
   - `GET /api/workflow/asset-registry/:projectId` — 获取项目所有注册资产
   - `GET /api/workflow/asset-registry/:projectId/:type` — 按类型筛选
   - `PUT /api/workflow/asset-registry/:id/status` — 更新状态（校验状态机规则）
5. 在 `backend/src/index.ts` 注册路由

**产出：**
- ✅ AssetRegistry 表
- ✅ Canonical Schema TS 接口 + 校验函数
- ✅ 资产注册 API（列表/状态更新）

**验收：**
```bash
curl -X GET http://localhost:4002/api/workflow/asset-registry/{projectId} → 返回注册列表
curl -X PUT http://localhost:4002/api/workflow/asset-registry/{id}/status \
  -H 'Content-Type: application/json' -d '{"status":"optimized"}' → 状态变更成功
```

---

### A2. Asset State Machine Engine

**路径：** `backend/src/runtime/asset-state-machine.ts`

**输入：** W1 Blueprint §3 — 状态流转图 + 控制规则表

**任务：**
1. 定义状态枚举：`draft | processing | optimized | approved | partial_failed | locked | generating | generated | failed | archived`
2. 实现状态迁移函数 `transition(currentStatus, action): nextStatus`
   - 前置校验（只能从 `optimized` → `approved`，不能从 `draft` → `approved`）
   - 非法状态阻断
3. 实现 `canTransition(currentStatus, targetStatus): { allowed: boolean, reason?: string }`
4. 实现 `assertCanTransition(currentStatus, targetStatus)` — 不满足时 throw
5. 状态审计日志写入 `InvocationLog`

**产出：**
- ✅ 状态机迁移函数 + 非法阻断
- ✅ 状态审计日志

**验收：**
```typescript
assertCanTransition('draft', 'optimized') // ✅ pass
assertCanTransition('draft', 'approved')  // ❌ throw
```

---

### A3. Asset Version System

**路径：** `backend/prisma/schema.prisma` + `backend/src/routes/asset-versions.ts` + `backend/src/services/asset-version.service.ts`

**输入：** W1 Blueprint §2 — AssetVersion 表 + 版本协议

**任务：**
1. 新增 `AssetVersion` 表（assetRegistryId, version, optimizationType, agent, diffSummary, content Json, prompt Json?）
2. `backend/src/routes/asset-versions.ts`
   - `GET /api/workflow/asset-registry/:id/versions` — 版本列表
   - `GET /api/workflow/asset-registry/:id/versions/:version` — 指定版本快照
   - `POST /api/workflow/asset-registry/:id/versions/:version/rollback` — 回滚
3. `backend/src/services/asset-version.service.ts`
   - `createVersion(registryId, content, prompt, agent, diffSummary)` — 自动 version + 1
   - `rollbackTo(registryId, versionNumber)` — 切换 currentVersion
   - `diffVersions(registryId, v1, v2)` — 生成字段级 diff

**产出：**
- ✅ AssetVersion 表
- ✅ 版本 CRUD API
- ✅ 回滚 API
- ✅ diff 工具函数

**验收：**
```bash
GET /api/workflow/asset-registry/{id}/versions → 版本列表含 diffSummary
POST /api/workflow/asset-registry/{id}/versions/2/rollback → currentVersion 切回 2
```

---

## Lane B：AI Gateway（系统心脏）

### B1. AIInvocationEnvelope

**路径：** `backend/src/runtime/ai-invocation-envelope.ts`

**输入：** W1 Blueprint §7 — AIInvocationEnvelope 接口 + 链路追踪

**任务：**
1. 定义 `AIInvocationEnvelope` 接口（traceId, parentInvocationId?, userId, projectId?, assetRegistryId?, agentType, operationType, capability, provider, model）
2. `generateTraceId(): string` — 生成唯一 traceId（`w1_${Date.now()}_${random(6)}`）
3. `createEnvelope(params): AIInvocationEnvelope` — 工厂函数
4. `enrichEnvelope(parent, child): child` — 继承 parent trace 链

**产出：**
- ✅ Envelope 类型定义 + 工厂函数

**验收：**
```typescript
const env = createEnvelope({ userId, agentType: 'character-optimizer', capability: 'llm' })
env.traceId  // "w1_1779169000000_a1b2c3"
```

---

### B2. Unified AI Gateway

**路径：** `backend/src/runtime/ai-gateway.ts`

**输入：** W1 Blueprint §7 + B1 Envelope + 现有 `with-user-model-config.ts`

**任务：**
1. 实现 `invokeAI(envelope, payload, options?): Promise<InvokeResult>`
   - 生成 traceId（如果未传）
   - 调用 `getUserModelConfig(userId)` → 获取用户 Key + 模型选择
   - 注入 Key 到 process.env（复用 `withUserModelConfig`）
   - 记录 `InvocationLog`（开始）
   - 分发到对应 provider adapter（llm→aliyunLLM.chat, image→generateImage 等）
   - 记录 `InvocationLog`（完成）
   - 恢复 process.env
   - 返回 `{ success, data, usage, latencyMs, envelope }`
2. Rate limit（per user per minute, 默认 30/min）
3. 超时控制（默认 60s, 可配置）
4. 重试逻辑（失败自动重试 1 次）

**产出：**
- ✅ `invokeAI()` 统一入口
- ✅ Rate limit + 超时 + 重试

**验收：**
```typescript
const result = await invokeAI(
  { envelope: createEnvelope({...}), payload: { model, messages } }
)
result.success === true
result.latencyMs < 60000
```

---

### B3. Provider Adapter Layer（确保状态统一）

**路径：** `backend/src/services/`（现有文件）

**输入：** 现有 aliyun-llm/aliyun-image/aliyun-video/aliyun-tts providers

**任务：**
1. 在每个 adapter 的入口处，检查 `process.env` 中当前生效的 provider 和 API Key
2. 所有 adapter 统一导出格式：`{ success, data, usage?, latencyMs?, error? }`
3. 确保 adapter 不持有内部状态（stateless enforcement）
4. 火山引擎 adapter 作为 P1 暂不实现，但预留接口签名

**产出：**
- ✅ 所有 adapter 输出格式统一
- ✅ 无状态检查

**验收：** 后端 tsconfig 编译通过，运行时 `invokeAI` 能调到 aliyun adapter

---

## Lane C：Workflow + 卡片系统

### C1. Card Contract System

**路径：** `frontend/composables/card-contract.ts` + `backend/src/services/card-contract.service.ts`

**输入：** W1 Blueprint §5 — CardMeta/CardData/CardOptimizationResult 接口

**任务：**
1. 前端 `card-contract.ts`
   - 定义 `CardMeta`, `CardData`, `CardField`, `CardOptimizationResult`, `FieldComparison` 接口
   - 实现 `buildCardData(asset, version): CardData` — 从 AssetVersion 构建卡片数据
   - 实现 `validateCardData(data): {valid, errors}` — 字段完整性校验
   - 实现 `formatComparison(result): { original, optimized }[]` — 对照表格式化
2. 后端 `card-contract.service.ts`
   - 根据 `assetRegistryId` + `type` 从明细表读取内容
   - 按 Canonical Schema 格式化为统一 `CardData`

**产出：**
- ✅ Card Contract 前后端接口 + 工具函数

**验收：** 后端 `GET /api/workflow/asset-registry/{id}/card-data` 返回标准 CardData

---

### C2. Optimization Engine

**路径：** `backend/src/routes/optimization.ts` + `backend/src/services/optimization.service.ts`

**输入：** W1 Blueprint §6 — Optimization Protocol + 现有 Agent 映射

**任务：**
1. `POST /api/workflow/optimize`
   - 接收 `{ assetRegistryId, additionalContext? }`
   - 查 AssetRegistry → 获取 type + sourceId
   - 从明细表读当前内容
   - 查对应 Agent prompt（见 §6.2 映射表）
   - 构建 AIInvocationEnvelope（agentType = `{type}-optimizer`）
   - 调用 `invokeAI()`（走 B2 Gateway）
   - 解析返回 → `createVersion()`（走 A3）
   - 返回 `{ version, comparisons, diffSummary }`
2. `GET /api/workflow/optimize/result/:assetRegistryId`
   - 返回最新一次优化结果
3. Prompt binding
   - 优化 prompt 统一加后缀模板（见 §6.3）
   - 每个 Agent 映射到对应 prompts/agents/ 文件

**产出：**
- ✅ 优化 API（异步 + 查询）
- ✅ Agent Prompt 绑定

**验收：**
```bash
POST /api/workflow/optimize -d '{"assetRegistryId":"..."}' → 返回 version + comparisons
GET /api/workflow/optimize/result/{assetRegistryId} → 对照表数据
```

---

### C3. UI Optimization Panel

**路径：** `frontend/components/workflow/`

**输入：** W1 Blueprint §5.2 组件结构 + C1 Card Contract

**任务：**
1. `CardShell.vue` — 通用卡片容器
   - Props: `cardMeta: CardMeta`, `loading?: boolean`
   - 显示状态标签（颜色编码）、版本号、操作按钮
   - Slot: default（卡片内容）
2. `OptimizationModal.vue` — 优化对照表
   - 显示 `FieldComparison[]` 列表（原始 | 优化后 并排）
   - 显示 diffSummary
   - "确认"按钮 → POST status=approved
   - "再次优化"按钮 → POST /api/workflow/optimize
3. `VersionHistory.vue` — 版本列表
   - 列表显示：版本号、agent、diffSummary、时间
   - 点击 → 加载对应版本内容预览
   - "回滚"按钮

**产出：**
- ✅ CardShell / OptimizationModal / VersionHistory 组件

**验收：** 组件在 `/studio` 页面渲染，优化流程完整：点击→modal→对比→确认/再次优化

---

## Lane D：连续性 + 视频链路

### D1. Continuity Engine

**路径：** `backend/prisma/schema.prisma` + `backend/src/routes/continuity.ts` + `backend/src/services/continuity.service.ts`

**输入：** W1 Blueprint §4 — ContinuityLink 表 + 4.2 自动串联规则

**任务：**
1. 新增 `ContinuityLink` 表（projectId, fromSegmentId, fromType, toSegmentId, toType, linkType, inheritedContent Json?, sortOrder）
2. `backend/src/services/continuity.service.ts`
   - `buildContinuity(projectId)` — 根据项目视频分段顺序自动构建链接
   - `getContinuityChain(projectId)` — 获取完整链路
   - `updateContinuity(id, data)` — 手动修改链接
   - `rebuildContinuity(projectId)` — 重建所有（分段变更后调用）
3. `backend/src/routes/continuity.ts`
   - `GET /api/workflow/project/:projectId/continuity` — 获取链路
   - `PUT /api/workflow/continuity/:id` — 修改
   - `POST /api/workflow/project/:projectId/continuity/rebuild` — 重建

**产出：**
- ✅ ContinuityLink 表
- ✅ 自动构建 + 手动修改 API

**验收：**
```bash
POST /api/workflow/project/{projectId}/continuity/rebuild → 链路构建
GET /api/workflow/project/{projectId}/continuity → 返回有序链路
```

---

### D2. Video Pipeline Hook（wan2.7-i2v 集成）

**路径：** `backend/src/services/aliyun-video.provider.ts` + 新建 `backend/src/runtime/video-pipeline-hook.ts`

**输入：** 现有 aliyun-video.provider.ts（已实现 submitWithImage）+ D1 ContinuityEngine

**任务：**
1. `video-pipeline-hook.ts`
   - `resolveFrameInheritance(projectId, segmentIndex)` — 检查 ContinuityLink，如果该段的首帧有 inheritedFrom，自动获取前一段尾帧 URL
   - `injectContinuity(projectId, segmentIndex, callParams)` — 将继承帧 URL 注入到 wan2.7-i2v 调用参数中（作为 `image_url` 首帧）
2. aliyun-video.provider.ts 集成检查
   - 确认 `submitWithImage()` 能正确处理 `image_url` + `second_image_url`

**产出：**
- ✅ 视频管道连续性注入

**验收：** 生成视频 N+1 时，自动从 ContinuityLink 读取 video N 尾帧 URL 传入 wan2.7-i2v

---

## Lane E（基础）：系统安全与迁移

### E1. Dual Write System

**路径：** `backend/src/runtime/dual-write.ts`

**输入：** W1 Blueprint §9.2 — 双写窗口期

**任务：**
1. `DualWriteController`
   - 环境变量 `DUAL_WRITE_PHASE`: `'scan' | 'init' | 'active' | 'cutover'`
   - 配置开关：是否启用双写、校验模式（strict / warn / off）
2. `dualWrite(operation, oldFn, newFn)` — 双写执行器
   - 同时执行 oldFn + newFn
   - 在 `active` 阶段比较两个结果
   - 不一致时：根据校验模式决定报警 vs 回退
3. `consistencyCheck(projectId)` — 对账函数

**产出：**
- ✅ 双写控制器 + 一致性校验

**验收：**
```typescript
await dualWrite('update_character', () => updateOldTable(), () => updateNewTable())
// 双写成功，校验无差异
```

---

### E2. Migration Engine

**路径：** `backend/src/scripts/migrate-w1.ts`

**输入：** W1 Blueprint §9

**任务：**
1. 一次性迁移脚本 `migrate-w1.ts`
   - Phase W1a: 扫描所有旧表 → 创建 AssetRegistry 记录
   - Phase W1b: 为每条 Registry 创建 AssetVersion(1, content=旧表快照)
   - Phase W1c: 验证一致性
2. 支持的旧表映射：
   - `AiCharacterSpec` + `CharacterProfile` → type='character'
   - `AiSceneSpec` + `SceneProfile` → type='scene'
   - `Storyboard` → type='storyboard'
   - `AiFrameDesign` → type='keyframe'
   - `AiVideoSegment` → type='shot'

**产出：**
- ✅ 可执行迁移脚本

**验收：**
```bash
npx tsx src/scripts/migrate-w1.ts --phase=scan
# 输出: "扫描完成: 项目 12 个, 资产 287 条"
```

---

---

## Execution Binding Map（模块级拆分）

> **每个 Lane 的任务必须拆到"独立模块/文件"级别。**  
> 模块间禁止循环依赖，禁止跨层调用。同一模块内禁止混入不同职责的代码。

### A1 — Asset Core → 拆 4 模块

```
A1-1 asset-canonical.schema.ts    (pure types)     — 5 类 Canonical 接口定义
A1-2 asset-registry.service.ts    (index layer)    — Registry CRUD + sourceId 映射
A1-3 runtime-validator.ts         (error contract) — validateCanonical() + 标准错误结构
A1-4 asset-graph-index.ts         (DAG API)        — getPredecessors() / getSuccessors()
```
**文件：** `backend/src/services/asset-*.ts` + `backend/src/routes/asset-registry.ts`

**禁止：** A1-1 不能 import A1-2/3/4，A1-4 不能引用 A1-2

---

### A2 — State Machine → 拆 4 模块

```
A2-1 asset-status.enum.ts          — 10 态枚举 + 可读标签映射
A2-2 asset-state-transition.ts     — transition() 纯函数
A2-3 asset-state-guard.ts          — assertCanTransition() + canTransition()
A2-4 asset-state-audit.ts          — 状态变更写入 InvocationLog
```
**文件：** `backend/src/runtime/asset-state-*.ts`

**禁止：** A2-1 是 pure enum 零依赖；A2-2 只依赖 A2-1；A2-3 依赖 A2-1+A2-2；A2-4 可通过依赖注入写日志

---

### A3 — Version System → 拆 4 模块

```
A3-1 asset-version.model.ts        — Version 表类型 + version 号生成
A3-2 asset-diff-schema.ts          (EXPORTED) — FieldDiff 接口 + diff 函数 ← 补丁②
A3-3 asset-version.service.ts      — createVersion() 实现
A3-4 asset-rollback.service.ts     — rollbackTo() + 回滚审计
```
**文件：** `backend/src/services/asset-version-*.ts` + `backend/src/routes/asset-versions.ts`

**关键：** A3-2 必须独立导出，供 C2 diff generator 直接 import，不经过 A3-3

---

### B1 — Envelope → 拆 2 模块

```
B1-1 ai-envelope.types.ts          — AIInvocationEnvelope 接口 + traceId 生成
B1-2 ai-envelope.factory.ts        — createEnvelope() + enrichEnvelope()
```
**文件：** `backend/src/runtime/ai-envelope-*.ts`

---

### B2 — AI Gateway → 拆 4 模块

```
B2-1 ai-gateway.core.ts            — invokeAI() 主入口
B2-2 ai-gateway.config.ts          — getUserModelConfig() 用户 Key/模型 解析
B2-3 ai-gateway.router.ts          — 按 capability 分发到 adapter
B2-4 ai-gateway.envelope.ts        — envelope 构建 + InvocationLog 记录
```
**文件：** `backend/src/runtime/ai-gateway-*.ts`

---

### B3 — Adapter → 拆 1 模块（统一化）

```
B3-1 provider-adapter.ts            — adapter 输出统一 `{ success, data, usage, latencyMs, error }`
```
**文件：** `backend/src/services/provider-adapter.ts`

**说明：** 不重写现有 adapter，只加固装层，确保输出格式一致

---

### C1 — Card Contract → 拆 2 模块

```
C1-1 card-contract.types.ts         (前端+后端共享) — CardMeta / CardData / CardOptimizationResult
C1-2 card-contract.service.ts       (后端)          — buildCardData() / formatComparison()
```
**文件：** `frontend/composables/card-contract.ts` + `backend/src/services/card-contract.service.ts`

---

### C2 — Optimization → 拆 4 模块

```
C2-1 prompt-binding.service.ts      — 按 asset type 绑定 Agent prompt
C2-2 agent-executor.service.ts      — 调 AI Gateway + 解析返回
C2-3 diff-generator.service.ts      — import A3-2，构建 FieldDiff[]
C2-4 version-writer.hook.ts         — 优化结果 → createVersion()
```
**文件：** `backend/src/services/optimization-*.ts` + `backend/src/routes/optimization.ts`

---

### C3 — UI Components → 拆 3 组件

```
C3-1 CardShell.vue                  — 通用卡片容器（状态/版本/操作按钮）
C3-2 OptimizationModal.vue          — 对照表（原始 vs 优化后）
C3-3 VersionHistory.vue             — 版本列表 + 回滚
```
**文件：** `frontend/components/workflow/`

---

### D1 — Continuity → 拆 3 模块

```
D1-1 continuity-graph.service.ts     — 导入 A1-4 的 adjacency query
D1-2 continuity-linker.service.ts    — buildContinuity() + 链构建
D1-3 continuity-auto-bind.ts         — tail→head 自动绑定
```
**文件：** `backend/src/services/continuity-*.ts` + `backend/src/routes/continuity.ts`

---

### D2 — Video Hook → 拆 2 模块

```
D2-1 video-frame-inheritance.ts      — resolveFrameInheritance()
D2-2 video-pipeline-injector.ts      — injectContinuity() → wan2.7-i2v 参数
```
**文件：** `backend/src/runtime/video-pipeline-hook.ts`

---

### E1 — Dual Write → 拆 2 模块

```
E1-1 dual-write.controller.ts        — 双写开关 + 阶段控制
E1-2 dual-write.executor.ts          — dualWrite() + consistencyCheck()
```
**文件：** `backend/src/runtime/dual-write-*.ts`

---

### E2 — Migration → 拆 1 脚本

```
E2-1 migrate-w1.ts                   — 一次性迁移脚本（Phase W1a→W1b→W1c）
```
**文件：** `backend/src/scripts/migrate-w1.ts`

---

### 模块依赖图（简化）

```
                  A1-1 (pure types, 零依赖)
                 /   |   \
                /    |    \
          A1-2   A1-3   A1-4
          (Registry) (Validator) (Graph Index)
              |         |         |
              ↓         ↓         ↓
             A3       B1/B2/C1    D1
              |
              ↓
            A3-2 (Diff Schema, 独立导出)
              |
              ↓
             C2-3 (Diff Generator)
```

### 循环依赖检查（禁止清单）

```
❌ service import route
❌ service import frontend
❌ A1-4 (graph) import A1-2 (registry)
❌ A3-2 (diff) import A3-3 (version writer)
❌ C2 import C3
❌ B2 import C1
```

---

## 执行依赖锁图（Exec Dependency Lock Map）

> ⚠️ **这是施工依赖的权威定义。** 任何 Lane 不得依赖其"目标 Lane"尚未提供的内容。  
> 违反依赖链的代码直接拒绝合并。

### 提供/依赖矩阵

```
Task        Provides                                  Depends On
────        ────────                                  ──────────
A1          - AssetRegistry 表                         无（起点）
            - AssetGraphEdge 表（预留）
            - Canonical Schema 接口定义
            - RuntimeValidator（校验+标准错误结构）    ← 补丁①
            - Minimal Graph Index（adjacency query）   ← 补丁③

A2          - AssetStateMachine 枚举                    无（起点，可并行 A1）
            - transition() 迁移函数
            - assertCanTransition() 阻断器

A3          - AssetVersion 表                            A1 + A2
            - AssetDiffSchema（字段级 diff 结构）       ← 补丁②
            - createVersion() / rollbackTo()
            - diffVersions() 比较器

B1          - AIInvocationEnvelope 类型定义              A1（需要 RuntimeValidator）
            - traceId 生成器
            - createEnvelope() 工厂

B2          - invokeAI() 统一入口                        A1 + A3 + B1
            - Rate limit / 超时 / 重试                   （需要 diff schema 做调用审计）
            - InvocationLog 记录

B3          - 所有 adapter 输出统一格式                   A1 + B2
            - 无状态检查
            - 火山引擎预留签名（P1）

C1          - CardMeta / CardData 接口                    A1 + A3
            - buildCardData()                            （需要 Registry + Version）
            - formatComparison() 工具

C2          - POST /api/workflow/optimize                  A1 + A3 + B2 + C1
            - Agent Prompt 绑定                          （需要 Version + Gateway + Card）
            - 优化结果写 AssetVersion

C3          - CardShell / OptimizationModal /              C1 + C2
              VersionHistory 组件

D1          - ContinuityLink 表                           A1
            - buildContinuity() 自动构建                  （需要 Minimal Graph Index ← 补丁③）
            - forward/backward adjacency query

D2          - resolveFrameInheritance()                    D1
            - injectContinuity() 注入 wan2.7-i2v

E1          - DualWriteController                         A1 + A2 + A3 全部完成
            - dualWrite() 执行器
            - consistencyCheck()

E2          - migrate-w1.ts 脚本                          A1 + A3（Registry + Version 准备好）
            - Phase W1a→W1b→W1c
```

### 补丁标注（3 个隐性风险对应）

| 补丁 | 位置 | 内容 | 被谁依赖 |
|------|------|------|---------|
| ① RuntimeValidator | A1 | 标准错误结构 `{ code, message, details? }` + `validateAsset(type, data)` | B1, C1, C2 |
| ② AssetDiffSchema | A3 | 字段级 diff: `{ field, label, originalValue, optimizedValue, changeType }` | C1, C2 |
| ③ Minimal Graph Index | A1 | `getPredecessors(id)`, `getSuccessors(id)` 查询函数 | D1 |

### 执行顺序（修正后）

```
① A1（含 RuntimeValidator + Graph Index）
   │
   ├──② A2（State Machine，可并行 ①）
   │
   ├──③ A3（Version + DiffSchema，依赖 ①+②）
   │
   ├──④ B1（Envelope，依赖 ①）
   │
   ├──⑤ B2（AI Gateway，依赖 ①+③+④）
   │     │
   │     ├──⑥ B3（Adapter 统一，依赖 ①+⑤）
   │     │
   │     ├──⑦ C1（Card Contract，依赖 ①+③）
   │     │     │
   │     │     └──⑧ C2（Optim Engine，依赖 ①+③+⑤+⑦）
   │     │           │
   │     │           └──⑨ C3（UI 组件，依赖 ⑦+⑧）
   │     │
   │     └──⑩ D1（Continuity Engine，依赖 ① 的 Graph Index）
   │           │
   │           └──⑪ D2（Video Pipeline Hook，依赖 ⑩）
   │
   └──⑫ E1 + E2（迁移，依赖 A 全部完成）
```

### 绝对禁止清单

```
❌ A3 在 A2 之前写（version 需要 state machine）
❌ B2 在 A3 之前写（审计需要 version）
❌ C2 在 B2 之前写（优化必须走 AI Gateway）
❌ D1 在 Minimal Graph Index 之前写（continuity 需要 adjacency query）
❌ E1 在 A 全部完成前写（双写需要全量 schema）
```

### 校验公式

```
每次提交 PR 前检查：
  if (PR.task 依赖的 providers 尚未合并) → 拒绝 PR
```

---

## 执行顺序（原始参考图，已被上方 Lock Map 覆盖）

```
Lane A1 + A2  ───────────────────────────────────── ...
                     ↓
               Lane A3 (Version)
                     ↓
               Lane B1 + B2 (AI Gateway)  ──────── ...
                     ↓
          ┌──────────┴──────────┐
          ↓                      ↓
     Lane C1 + C2           Lane D1 (Continuity)
          ↓                      ↓
     Lane C3 (UI)           Lane D2 (Video Hook)
          ↓                      ↓
          └──────────┬──────────┘
                     ↓
               Lane E1 + E2 (Migration)
```

**并行限制：**
- A1 和 A2 可以并行
- A3 依赖 A1 + A2
- B1 + B2 依赖 A1
- C1 依赖 A1 + A3
- C3 依赖 C1 + C2
- D1 依赖 A1
- D2 依赖 D1
- E1 + E2 依赖所有 Lane 完成
