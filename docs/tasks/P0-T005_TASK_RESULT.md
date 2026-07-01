# P0-T005 — AI Discovery Lab MVP

**状态**: ✅ 完成  
**日期**: 2026-07-01  
**负责人**: Agent Subagent

---

## 1. 本 Task 实现了什么

AI Discovery Lab MVP 是一个**实体发现评估系统**，用户输入一个 Entity（如"昆仑镜AI"、"特斯拉"），系统通过以下流程生成完整的发现评估报告：

1. **SIE 场景匹配** — 复用已有的 Scenario Matcher，匹配 Entity 到所有需求场景
2. **Mock 发现扫描** — 模拟 AI 在各场景中的发现能力表现（覆盖率、置信度、趋势）
3. **ADI 评估** — 综合三个子维度（Coverage / Share / Position）计算 ADI 分数
4. **报告生成** — 包含场景覆盖详情、优化机会识别、Top/Bottom 场景对比

### 核心价值

- 让用户直观了解其品牌/产品在 AI 发现生态中的表现
- 识别未被覆盖的高价值场景（Opportunity）
- 提供可执行的优化建议
- 为后续接入真实 AI Provider 提供框架基础

---

## 2. 从底层到前端完整数据流

```
┌─────────────────────────────────────────────────────────────────┐
│  User Input                                                     │
│  "昆仑镜AI"                                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: DiscoveryLabPage.vue                                 │
│  • Entity 输入框 + 搜索按钮                                       │
│  • 调用 discoveryService.fetchDiscoveryReport("昆仑镜AI")          │
│  • 通过 geoApi（base: /api/v1/geo）发送 GET 请求                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ GET /api/v1/geo/discovery/report?entity=昆仑镜AI
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend: geo-discovery.route.ts                                │
│  • Fastify Route Handler                                        │
│  • 调用 discoveryService.evaluateEntity(entity)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. SIE Scenario Matching                                       │
│  ┌──────────────────────────────────────┐                       │
│  │ scenarioMatcher.matchTopK(entity, N)  │                       │
│  │ • 基于规则的关键词/意图匹配            │                       │
│  │ • 返回所有 Scenario 的置信度分数       │                       │
│  │ • 置信度 > 0 记为"匹配"              │                       │
│  └──────────────┬───────────────────────┘                       │
│                 │ scenarioId → confidence Map                    │
│                 ▼                                               │
│  2. Mock Discovery Scan                                         │
│  ┌──────────────────────────────────────┐                       │
│  │ mockScanner.scan(entity, confidences) │                       │
│  │ • 匹配场景 → 60-90% 覆盖率（随机）      │                       │
│  │ • 未匹配场景 → 0-30% 覆盖率（随机）     │                       │
│  │ • 确定性伪随机（基于实体名 + index）    │                       │
│  └──────────────┬───────────────────────┘                       │
│                 │ scenarios[], coverage, share, position         │
│                 ▼                                               │
│  3. ADI Calculation                                             │
│  ┌──────────────────────────────────────┐                       │
│  │ ADI = coverage×0.35 + share×0.35     │                       │
│  │      + position×0.30                 │                       │
│  └──────────────┬───────────────────────┘                       │
│                 ▼                                               │
│  4. Opportunity Identification                                  │
│  ┌──────────────────────────────────────┐                       │
│  │ gap = 100 - coverageScore            │                       │
│  │ gap > 40  → high priority            │                       │
│  │ gap 20-40 → medium priority          │                       │
│  │ gap < 20  → 不标记                    │                       │
│  └──────────────┬───────────────────────┘                       │
│                 │                                               │
└─────────────────┼───────────────────────────────────────────────┘
                  │ DiscoveryReport JSON
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: DiscoveryLabPage.vue                                 │
│  • ADI 大卡片（环形进度 + 分数）                                   │
│  • 三子维度（Coverage / Share / Position）                       │
│  • Scenario Coverage 表格（含趋势、状态徽标）                      │
│  • Opportunity 列表（按优先级分组）                                │
│  • Top 5 / Bottom 5 场景对比                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 模块依赖关系

```
DiscoveryLabPage.vue
  └─ useDiscoveryStore (Pinia)
       └─ discoveryService.ts
            └─ geoApi (ofetch) → GET /api/v1/geo/discovery/report
                 └─ geo-discovery.route.ts (Fastify)
                      └─ discoveryService.evaluateEntity()
                           ├─ scenarioMatcher.matchTopK()  ← SIE (已有)
                           ├─ mockScanner.scan()            ← Mock
                           ├─ ADI 公式计算
                           └─ 机会识别逻辑
```

---

## 3. 当前限制

| 限制 | 说明 |
|------|------|
| **纯 Mock 扫描** | MockScanner 使用确定性伪随机算法模拟 AI 发现表现，不调用任何真实 AI Provider |
| **无真实 Provider 调用** | 未调用 DeepSeek / Claude / 豆包 / 任何 LLM |
| **无 Embedding 匹配** | SIE 匹配基于规则（关键词 + 意图），不使用向量数据库或 Embedding |
| **In-Memory 数据** | Scenario Library 和 Demand Corpus 均使用内存 seed-data，无持久化 |
| **单次扫描** | 每次请求独立扫描，无缓存、无状态持久化 |
| **无认证要求** | 当前路由无 `preHandler: [fastify.authenticate]`，可供调试 |

---

## 4. 下一 Task 如何接入真实 Provider

### 短期（可立即做）

1. **替换 MockScanner 为真实 AI 扫描**
   - 在 `mock-scanner.ts` 同级创建 `ai-scanner.ts`
   - 实现相同接口 `scan(entity, scenarioIds) → { scenarios, coverage, share, position }`
   - 使用已有的 `provider-registry` 或 `llm-client` 调用真实模型
   - 通过 prompt 让 LLM 评估实体在各场景中的表现

2. **添加 Embedding 相似度匹配**
   - 引入向量存储，用 Embedding 替代/补充规则匹配
   - 计算实体描述与场景描述的语义相似度

### 中期

3. **接入 ADI Store 数据**
   - Discovery Lab 当前使用独立的 ADI 计算
   - 可对接 `useAdiStore` / `adiService.ts` 共享 ADI 数据

4. **缓存结果**
   - 对同一实体的扫描结果做缓存（TTL 策略）
   - 避免重复扫描

### 架构建议

```
┌──────────────────────────────────────────────────┐
│              DiscoveryService                      │
│  evaluateEntity(entity)                            │
│  ┌───────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ SIE Match │→│ AI Scan │→│ Report Gen   │   │
│  └───────────┘  └──────────┘  └───────────────┘   │
│                    │                               │
│                    ▼                               │
│           ┌────────────────┐                       │
│           │ AI Provider    │ ← 替换 MockScanner    │
│           │ Adapter        │                       │
│           └────────────────┘                       │
└──────────────────────────────────────────────────┘
```

---

## 验收清单

- ✅ DiscoveryReport 类型完整（ADI + 3维度 + Scenario + Opportunity）
- ✅ MockScanner 产生合理模拟数据
- ✅ 后端 API `GET /api/v1/geo/discovery/report?entity=X` 返回报告
- ✅ 前端 DiscoveryLabPage 展示报告（ADI + 场景 + 机会）
- ✅ 侧边栏可导航到 Discovery 页面
- ✅ 用户输入 Entity 后能看到完整报告
- ✅ Build PASS（frontend .ts + backend .ts）
- ✅ 单 Commit
- ✅ TASK_RESULT.md 生成
- ✅ 未调用任何真实 AI Provider

---

## 新增/修改文件清单

### 后端 (backend/src/)

| 文件 | 操作 |
|------|------|
| `benchmark/discovery/types.ts` | 新增 — DiscoveryReport 类型定义 |
| `benchmark/discovery/mock-scanner.ts` | 新增 — Mock Scanner 实现 |
| `benchmark/discovery/discovery-service.ts` | 新增 — 主服务 |
| `benchmark/discovery/index.ts` | 新增 — 统一导出 |
| `services/geo/routes/geo-discovery.route.ts` | 新增 — Fastify 路由 |
| `index.ts` | 修改 — 注册 Discovery 路由 |

### 前端 (frontend/)

| 文件 | 操作 |
|------|------|
| `workspaces/geo/services/discoveryService.ts` | 新增 — API 调用服务 |
| `workspaces/geo/stores/useDiscoveryStore.ts` | 新增 — Pinia Store |
| `workspaces/geo/pages/DiscoveryLabPage.vue` | 新增 — 页面组件 |
| `workspaces/geo/router.ts` | 修改 — 添加 Discovery 路由 |
| `workspaces/geo/layouts/GeoWorkspaceLayout.vue` | 修改 — 侧边栏添加入口 |
