# Kirin Studio — 前端页面结构表

## 项目信息
- 源码目录: `/root/shipin-cinematic-studio/frontend/`
- 技术栈: Nuxt 3 (SPA) + Pinia + Tailwind CSS
- 部署: PM2, localhost:4001
- 域名: shipin.fushtn.com

---

## 一、路由结构

| 路由 | 页面文件 | 状态 | 说明 |
|------|---------|------|------|
| `/` | `pages/index.vue` | ✅ | 自动 redirect → `/studio/` |
| `/login` | `pages/login.vue` | ✅ | 登录/注册 |
| `/projects` | `pages/projects.vue` | ⚠️ 占位 | 项目列表（功能开发中） |
| `/studio/` | `pages/studio/index.vue` | ✅ | 主工作室（StudioPage 组件） |
| `/studio/workspace` | `pages/studio/workspace.vue` | ✅ | 个人工作空间 |
| `/studio/image` | `pages/studio/image.vue` | ✅ | AI 图片生成 |
| `/studio/video` | `pages/studio/video.vue` | ✅ | AI 视频生成 |
| `/dashboard/governance/` | `pages/dashboard/governance.vue` | ✅ | 治理/反思/模拟/Agent 社会面板 |
| `/dashboard/contentEconomy/` | `pages/dashboard/contentEconomy.vue` | ✅ | 内容经济/订单/收益面板 |

---

## 二、组件树

### StudioPage（核心工作室，`/studio/`）
```
StudioPage.vue
├── StudioHeader.vue         — 顶部导航栏 + GPU 状态 + 用户信息
├── ProjectSidebar.vue       — 左侧项目/场景列表面板
├── PreviewViewport.vue      — 中间预览视口 + 连续性/镜头/状态
├── TimelineEditor.vue       — 底部时间线
├── InspectorPanel.vue       — 右侧检查器面板
├── GpuRenderFarm.vue        — GPU 渲染农场（集成）
└── DirectorOverlay.vue      — AI Director 悬浮覆盖层
```

### 仪表盘页面（独立完整页面，非组件嵌套）
```
contentEconomy.vue            — 内容经济仪表盘
  ├── 摘要卡片 ×7（订单/收入/利润/效率/交付/满意度/高风险）
  ├── 创建订单表单
  ├── 上次生产周期结果
  ├── 成本分解
  └── 订单历史表格

governance.vue                — 治理/反思仪表盘
  ├── 系统评分卡片 ×5
  ├── 治理规则状态
  ├── 最近审计追踪
  ├── 决策解释
  ├── Simulation 引擎面板
  ├── Multi-Agent 社会面板
  └── 自优化报告
```

---

## 三、Store（Pinia）

| Store | 文件 | 用途 |
|------|------|------|
| `useStudioStore` | `stores/studio.ts` | 核心工作室状态：项目/场景/镜头/GPU/连续性/控制/director 状态 |
| `useAuthStore` | `stores/auth.ts` | 登录/用户 token |
| `useProjectStore` | `stores/project.ts` | 项目 CRUD（stub） |

> `useStudioStore` 是核心枢纽，全部 AI 引擎、Agent、治理、模拟都通过它读取/写入状态

---

## 四、Composables（逻辑层）

### 运行时（4个）
| 文件 | 用途 |
|------|------|
| `usePreviewRuntime.ts` | 预览流更新 |
| `useDirectorRuntime.ts` | Director 动态覆盖 |
| `useGpuRuntime.ts` | GPU 渲染状态轮询 |
| `useContinuityRuntime.ts` | 连续性监控 |
| `useTimelineRuntime.ts` | 时间线交互 |

### 智能循环（Phase 3-9 核心）
| 文件 | 用途 |
|------|------|
| `useIntelligenceLoop.ts` | **总编排器** — 每 tick 调用所有引擎/Agent/治理/反思 |
| `useEmotionEngine.ts` | 情绪引擎 |
| `useContinuityEngine.ts` | 连续性检查引擎 |
| `usePacingEngine.ts` | 节奏分析引擎 |
| `useRenderPrediction.ts` | 渲染预测引擎 |
| `useDirectorDecision.ts` | Director 决策引擎 |

### 模拟数据
| 文件 | 用途 |
|------|------|
| `useFakeStudioStream.ts` | 旧版模拟流（被 intelligence loop 替代，仍保留） |

---

## 五、AI Director OS 模块（Phase 3-10）

### 📁 agents/ — Phase 4: 自治 Agent
| 文件 | 用途 |
|------|------|
| `types.ts` | AgentAction 类型 |
| `agentCoordinator.ts` | Agent 协调器（runCycle） |
| `cameraDirectorAgent.ts` | 镜头导演 Agent |
| `continuityAgent.ts` | 连续性 Agent |
| `gpuSchedulerAgent.ts` | GPU 调度 Agent |
| `pacingAgent.ts` | 节奏 Agent |
| `renderOptimizationAgent.ts` | 渲染优化 Agent |

### 📁 simulation/ — Phase 8: 模拟层
| 文件 | 用途 |
|------|------|
| `types.ts` | SimulationReport, CostPrediction |
| `costPredictor.ts` | GPU/VRAM/时间/瓶颈预测 |
| `scenarioPredictor.ts` | 蒙特卡洛场景模拟 |
| `simulationEngine.ts` | 编排器：成本→场景→评分→风险 |

### 📁 multiAgent/ — Phase 9: 多 Agent 社会
| 文件 | 用途 |
|------|------|
| `types.ts` | AgentVote, ConsensusResult |
| `agentSociety.ts` | 8 Agent 社会成员 + 共识引擎 |

### 📁 memory/ — Phase 5: 电影记忆系统
| 文件 | 用途 |
|------|------|
| `types.ts` | 全部记忆类型 |
| `cinematicMemory.ts` | 滑动窗口记忆存储 |
| `characterMemory.ts` | 角色同步/稳定性追踪 |
| `renderMemory.ts` | 渲染瓶颈检测 |
| `pacingMemory.ts` | 节奏稳定性/情绪分布 |
| `continuityMemory.ts` | 连续性漂移检测 |

### 📁 planning/ — Phase 5: 规划引擎
| 文件 | 用途 |
|------|------|
| `planningEngine.ts` | 3 步未来预测 + 风险预估 |

### 📁 evaluation/ — Phase 6: 评估
| 文件 | 用途 |
|------|------|
| `types.ts` | 评估/审计/检查点类型 |
| `evaluators.ts` | 5 个评估器（渲染/连续性/节奏/电影/Agent） |

### 📁 audit/ — Phase 6: 审计
| 文件 | 用途 |
|------|------|
| `auditTrail.ts` | 输入/输出快照 + 差异 + 检查点 |

### 📁 explainability/ — Phase 6: 可解释性
| 文件 | 用途 |
|------|------|
| `explainabilityEngine.ts` | 5 段自然语言解释模板 |

### 📁 governance/ — Phase 6: 治理
| 文件 | 用途 |
|------|------|
| `governanceRules.ts` | 5 条治理规则（GPU/连续性/节奏/质量/冲突） |
| `rollbackSystem.ts` | 状态检查点 + 回滚 |
| `governancePanel.ts` | 治理面板编排器（10 步执行顺序） |

### 📁 reflection/ — Phase 7: 反思
| 文件 | 用途 |
|------|------|
| `types.ts` | ReflectionRecord, StrategyInsight |
| `reflectionEngine.ts` | 主编排引擎（每 N=50 触发） |
| `failureCluster.ts` | 故障聚类 |
| `strategyRanker.ts` | 策略排名 |
| `promptOptimizer.ts` | Prompt 优化 |
| `continuityLearner.ts` | 连续性学习 |

### 📁 reports/ — Phase 7: 报告
| 文件 | 用途 |
|------|------|
| `reportEngine.ts` | 自优化报告生成 |

### 📁 contentEconomy/ — Phase 10: 内容经济
| 文件 | 用途 |
|------|------|
| `types.ts` | Order / ProductionPlan / ExecutionReport / RevenueReport |
| `orderIntake.ts` | 接单 + ProductionPlan |
| `pricingEngine.ts` | 3 层报价 |
| `productionDispatcher.ts` | 生产调度（→Simulation→Multi-Agent） |
| `deliveryAndRevenue.ts` | 交付 + 收益分析 |
| `contentEconomyDashboard.ts` | 主编排器（6 步闭环） |

---

## 六、数据流全景
```
                 ┌──────────────────────────────┐
                 │    contentEconomy.vue         │ ← 新订单
                 │    (Order → Plan → Price)     │
                 └──────────┬───────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────┐
  │           productionDispatcher.ts                    │
  │  ┌──────────┴──────────┐  ┌────────────────────┐    │
  │  │ simulationEngine.ts │  │ multiAgent/        │    │
  │  │ (成本/场景/风险预测)  │  │ agentSociety.ts   │    │
  │  └─────────────────────┘  │ (8 Agent + Vote)   │    │
  │                           └────────────────────┘    │
  └──────────────────────┬──────────────────────────────┘
                         ↓
  ┌──────────────────────────────────────────────────────┐
  │         useIntelligenceLoop.ts (每 tick)             │
  │  Emotion → Continuity → Pacing → Render → Director │
  │  → AgentCoordinator → Simulation → Governance →     │
  │    Audit → Explain → Reflection                     │
  └──────────────────────┬──────────────────────────────┘
                         ↓
              ┌─────────────────────┐
              │  governancePanel.ts  │ ← 10 步执行顺序
              │  + reflectionEngine  │ ← 每 50 动作
              └─────────────────────┘
                         ↓
              ┌─────────────────────┐
              │  deliveryEngine.ts   │ ← 交付
              │  revenueOptimizer.ts │ ← 收益分析
              └─────────────────────┘
```

---

## 七、"不能创建新项目"分析

`/projects` 页面和 `/studio/` 里的 ProjectSidebar 都**没有实现创建新项目的功能**。

- `stores/project.ts` — 只有 stub actions（`fetchProjects`, `toggleFavorite` 都是空函数）
- `stores/studio.ts` — `projects` 是硬编码的 mock 数据（StudioPage.vue 里初始化），没有添加接口
- `/studio/` 的 `ProjectSidebar.vue` 虽然有`"新项目"`按钮但**只有 UI 占位，没有事件绑定**
- `/projects` 页面直接写死了 `"创作空间（功能开发中）"`

**如果你要创建新项目，需要至少：**
1. 实现 `useStudioStore` 的 `addProject(id, name)` action
2. 在 `ProjectSidebar.vue` 的"新项目"按钮绑定创建逻辑
3. 或者直接在当前 `contentEconomy.vue` 里点了 Create Order 就能跑完整流程
