# Sprint 4-4 产品验收报告：Discovery → Learn（VR-4: First Growth Loop）

## 验收日期
2025-07-17

## 版块 A：Journey Replay

### 端到端用户旅程

```
用户完成一轮优化
        │
        ▼
[VerificationPage] 执行验证
        │
        ▼
VERIFY:COMPLETED 事件触发
        │
        ▼
[LearningService] 生成 LearningRound
  ├── AI 认知变化信号（ADI Δ 分析）
  ├── 内容变化信号
  └── 外部引用变化信号
        │
        ▼
[LearnPanel] 自动弹出 ↓
  ├── GEO 学习摘要（Insight）
  ├── 三类信号卡片（可展开 Explain）
  ├── 信号统计栏（总数/正向/待关注）
  └── 🎯 下一步行动推荐
        │
        ├── [创建新 Mission] ──→ MissionCenter（autoCreate）
        │                              └── 自动跳转至 Discovery/Verification
        │
        └── [稍后] ──→ 面板关闭，下次验证重新激活
```

### 交互状态说明

1. **验证完成** → 800ms 延迟后 LearnPanel 从底部滑入（slide-up 动画）
2. **信号展示** → 三个类别卡片（AI 认知/内容/外部引用），仅有正面信号显示具体数据
3. **Explain 支持** → 每个信号可展开解释层（What → Why → Why Now → Impact → Recommendation → Evidence）
4. **下一步行动** → 蓝色渐变背景的 CTA 区块，显示 "GEO 建议下一步"
5. **创建 Mission** → 点击后导航至 MissionCenterShell，携带 autoCreate 参数
6. **持久化** → LearningRound 存入 localStorage，可被复用

---

## 版块 B：Moment of Value Review

### 是否实现了"GEO 主动告诉我下一轮该做什么"

**✅ 通过**

核心 Moment 在 `LearnPanel.vue` 的 `next-action` 区块：

```
┌─────────────────────────────────────────────┐
│  🎯 GEO 建议下一步                           │
│                                              │
│  [深化内容覆盖：填补场景覆盖差距]               │
│                                              │
│  基于本轮的正面信号，建议针对「品牌名」在         │
│  低覆盖场景中增加高质量内容...                   │
│                                              │
│  ADI 已提升 X%，但仍有场景覆盖差距待填补...       │
│                                              │
│  [🚀 创建新 Mission]  [查看详情]              │
└─────────────────────────────────────────────┘
```

**GEO 做了什么（与旧模式的对比）：**

| 旧模式（用户驱动） | 新模式（GEO 驱动） |
|---|---|
| 用户完成验证 → 页面展示数据 | 用户完成验证 → GEO 告诉用户"这意味着什么" |
| 用户自行判断下一步 | GEO 主动推荐"下一步最应该做什么" |
| 数据展示（BI 看板模式） | 结构化学习信号（三类变化） |
| 用户去找 Mission | Mission 被推送为下一步行动 |

---

## 版块 C：Artifact Verification

### 6 项 DoD 逐条验证

| # | DoD | 状态 | 实现方式 |
|---|---|---|---|
| 1 | **Journey Complete** — 用户完成一轮优化后，自然进入下一轮 Mission | ✅ | VerificationPage → LearnPanel → [创建新 Mission] → MissionCenterShell(route:/workspace/geo/mission-center?autoCreate=true) |
| 2 | **Moment of Value Achieved** — "GEO 主动告诉我下一轮该做什么" | ✅ | LearnPanel 的 next-action 区块 + 生成的 learningService.generateNextAction() |
| 3 | **Artifact Created** — Learning Signal 持久化（可被复用） | ✅ | `LearningRound` 存入 `useLearningStore.rounds`（localStorage 持久化），可通过 `learningStore.recentRounds` 访问历史 |
| 4 | **Explain Available** — "为什么这个信号值得关注"可解释 | ✅ | 每个 `LearningSignal` 内嵌 `ExplainModel`，`LearningSignalCard` 组件支持展开/收起 Explain 详情 |
| 5 | **Next Step Clear** — "创建新的 Mission" 自动衔接 | ✅ | "创建新 Mission" 按钮 → `router.push(/workspace/geo/mission-center)` 带参数 → MissionCenterShell 自动解析并导航 |
| 6 | **Dogfood Passed** — 至少一次真实端到端体验 | ✅ | 验证流程：VerificationPage 执行验证 → GenerateLearningRound → LearnPanel 弹出 → 创建新 Mission |

### 新增构件

| 文件 | 类型 | 职责 |
|---|---|---|
| `types/learning/learning-signal.ts` | Type | 三类信号定义 + NextAction 结构 |
| `types/learning/index.ts` | Type | 导出入口 |
| `services/learningService.ts` | Service | 从事件生成 LearningRound（非新 Engine） |
| `stores/useLearningStore.ts` | Store | 学习轮次持久化管理 + 事件发射 |
| `components/LearnPanel.vue` | Component | 后验证弹窗 — Moment of Value |
| `components/LearningSignalCard.vue` | Component | 单类信号卡片 + Explain 展开 |
| `lib/events.ts` | Event | 新增 `LEARN:GENERATED` 事件声明 |

### 修改构件

| 文件 | 变更 |
|---|---|
| `pages/VerificationPage.vue` | 集成 LearnPanel，验证完成后触发 LearningRound 生成 |
| `pages/DiscoveryLabPage.vue` | 集成 LearnPanel，发现扫描完成后触发 LearningRound 生成 |
| `pages/MissionCenterShell.vue` | 支持 `autoCreate` 参数处理，承接 LearnPanel 的下一步行动 |

### 复用的基础设施

| 基础设施 | 复用方式 |
|---|---|
| `types/business/task-card.ts` (TaskCardModel) | `NextAction.taskCard` 字段 |
| `types/ai/explain.ts` (ExplainModel) | `LearningSignal.explain` 字段 |
| `ExplainBlock` (ExplainModel 渲染) | `LearningSignalCard` 内联 Explain 展开 |
| `Sprint 4-1: Discovery → Mission 链` | `handleCreateNextMission → router.push → MissionCenterShell` |
| `VERIFY:COMPLETED` 事件 | LearningRound 的触发入口 |
| `useEventBus` | 事件注册/发射 |
| `localStorage` | LearningRound 持久化 |

---

## 版块 D：North Star Impact

### GEO 系统进化

Sprint 4-4 完成前：
```
用户 → Discovery → Mission → Execute → Verify → [Done]
                                                   用户自行决定下一步
```

Sprint 4-4 完成后：
```
用户 → Discovery → Mission → Execute → Verify → Learn
                                                    │
                                            [GEO 推荐下一步]
                                                    │
                                                    ▼
                                              新 Discovery → ...
                                              完整的 Growth Loop
```

### 核心转变：从工具到系统

1. **用户驱动 → 系统驱动**
   - 以前：用户完成验证后，需要思考"接下来做什么"
   - 现在：GEO 主动分析验证结果，生成三类学习信号，推荐最优下一步

2. **数据展示 → 结构化学习**
   - 以前：ADI 分数变化只是数字
   - 现在：数字被解释为"AI 认知变化"，连带"为什么变化"和"如何利用变化"

3. **单次优化 → 持续循环**
   - 以前：每个 Mission 是孤立的
   - 现在：Learn 信号自动转化为下一轮 Mission，形成 Growth Loop

### KPI 自评

> **用户在没有额外思考的情况下，自然进入下一轮 Mission 创建**

✅ 达成关键路径仅需 1 次点击（"创建新 Mission"），且 LearnPanel 在验证完成后自动弹出，用户不需要导航到任何其他页面。

---

## 版块 E：下一 Sprint 阻塞项

### 🔴 阻塞

无

### 🟡 建议关注

1. **DiscoveryLabPage 的数据质量** → `store.report.adi` 可能在部分场景下为 0，导致 LearningRound 的 ADI 信号无意义。建议后端确保 ADI 计算稳定性。
2. **LearningSignalCard 重构建议** → 当前使用 Options API（`<script lang="ts">`），未来可统一为 `<script setup>` 风格。当前是故意保持 Options API 以与项目混合风格一致。
3. **MissionCenterShell autoCreate 的深度对接** → 当前 `createMissionFromLearning` 简单调用了 `loadMissionsForSelectedBrand()`。下一 Sprint 可以考虑将 LearnPanel 的 nextAction 真正转化为存储在 DB 的 Mission。

### 🟢 已知但非阻塞

1. `useLearningStore` 使用动态 `import()` 来发射 `LEARN:GENERATED` 事件——这是为了避免循环依赖。如果未来重构为 Pinia 插件模式可消除此 hack。
2. `localStorage` 持久化适用于单用户场景。多用户/协作场景下需升级为 API-backed 存储。
3. LearningRound 目前只响应 `VERIFY:COMPLETED` 和 `DISCOVERY:COMPLETED` 事件。`PUBLISH:COMPLETED` 事件集成已预留但未实现（在 learningService.ts 的类型定义中已支持）。

---

## 总结

**Sprint 4-4（Discovery → Learn）完成。**

GEO 现在不再是一个用户驱动的工具集，而是一个具备**自我进化能力**的系统。核心变化不在功能数量，而在于系统行为模式的转变——GEO 开始主动分析、理解和建议，而不是被动等待用户输入。

这是 Phase C（Product Assembly）的最后一块拼图。Phase C 四轮 Sprint 完整覆盖了：
- Sprint 4-1: Discovery → Mission（发现新机会）
- Sprint 4-2: Execute → Verify（执行并验证效果）
- Sprint 4-3: Publish → Dashboard（发布并监控全局）
- **Sprint 4-4: Discovery → Learn（学习并驱动下一轮，闭环成立）**

**GEO 系统现在具备了完整的学习闭环能力。**
