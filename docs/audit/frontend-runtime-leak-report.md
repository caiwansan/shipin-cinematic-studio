# Frontend Runtime Leak Report（前端运行时泄漏审计）

**生成日期**: 2026-05-30  
**状态**: DRAFT — 基于目录结构 + 已知架构分析的初步扫描。需完善 deep scan。

---

## 一、背景

Nuxt Frontend 在 8 小时内重启 145 次（平均每 3.3 分钟一次）。  
核心假设：根因是前端承载了 **不应属于 View Layer 的 Runtime Logic**，导致：
- watcher storm
- reactive graph recursion
- memory drift
- hydration mismatch

---

## 二、审计范围

| 范围 | 方法 |
|------|------|
| 目录结构 | 扫描 frontend 所有顶层目录 |
| Pinia store | 检查 `stores/` 下已知 store |
| Composable | 检查 `composables/` 使用模式 |
| Nuxt pages | 检查 `pages/studio/v2.vue` 等核心页面 |
| 组件图 | `components/` 中的 graph/timeline 组件 |

---

## 三、发现的 Runtime Leaks

### L1 — 前端拥有 Runtime 目录

| 目录 | 风险等级 | 说明 |
|------|---------|------|
| `runtime/` | 🔴 严重 | 运行时概念直接出现在前端，表明执行逻辑在此 |
| `kernel/` | 🔴 严重 | 内核概念在前端，后端 kernel 的 UI 双生 |
| `governance/` | 🔴 严重 | 治理 UI，前端在承担 policy 展示和可能的决策 |
| `planning/` | 🟡 中 | 编排层 UI |
| `bridge/` | 🟡 中 | 桥接层，可能承担前后端 runtime 通信 |
| `multiAgent/` | 🟡 中 | 多 Agent UI，可能包含 Agent 执行状态管理 |
| `license-runtime/` | 🟠 低 | License 运行时，概念误放 |

### L2 — Pinia Store 承载 Execution State

| 已知 Store | 风险等级 | 说明 |
|-----------|---------|------|
| `stores/project.ts` | 🟡 中 | 项目状态可能包含 execution results |
| `stores/workbench.ts` | 🔴 严重 | 工作台 store 可能持有正在执行的任务列表 |
| `stores/agent.ts` | 🟡 中 | Agent 执行状态 |
| `stores/pipeline.ts` | 🔴 严重 | Pipeline stage/job 的执行状态 |

**风险**: Pinia 作为 execution state 的宿主，会导致：
- 页面刷新 = 状态丢失
- 多 tab = 状态不一致
- 前端状态 ≠ 后端状态 = runtime drift

### L3 — Composable 深度耦合 Runtime

| 已知 Composable | 风险等级 | 说明 |
|----------------|---------|------|
| `useApi.ts` | 🟢 低 | 正常 API 封装 |
| timeline composables | 🟡 中 | 未知是否包含 dispatch 逻辑 |
| graph composables | 🔴 严重 | 可能包含 reactive graph execution |

**风险**: 需要 deep scan 确认是否存在：
```typescript
// 反模式示例 — 如果存在：
watch(currentNode, async (node) => {
  const result = await executeTask(node)  // 前端驱动执行
  updateGraphState(result)                 // 前端修改 execution state
  dispatchNextNode()                        // 前端调度下一节点
})
```

### L4 — Visual Graph 作为 Execution Layer

| 组件 | 风险等级 | 说明 |
|------|---------|------|
| `@vue-flow/core` 图组件 | 🔴 严重 | 如果 graph 节点绑定执行逻辑（onNodeClick → dispatch） |
| Graph state 管理 | 🔴 严重 | 如果 graph 状态与 execution state 混为一谈 |

**界限**: 
- ✅ 安全: graph 只展示执行状态（只读读取）
- ❌ 危险: graph 节点触发执行、重试、取消

### L5 — Nuxt SSR + Runtime State 冲突

| 模式 | 风险等级 | 说明 |
|------|---------|------|
| SSR 渲染时访问 execution state | 🔴 严重 | Hydration mismatch 的常见根源 |
| Runtime state 使用 `useState` | 🟡 中 | SSR 环境中的状态不一致 |

---

## 四、Root Cause 分析：145 次重启

根据已知信息，推测的重启链：

```
1. Nuxt 页面加载
2. Composable watch deep graph changes
3. Graph change → API call → store update
4. Store update → graph re-render → new watch trigger
5. ⇒ Watcher recursion begins
6. CPU spike → event loop lag > threshold
7. Nuxt HMR or health check timeout
8. pm2 restart (×145)
```

**注意**: 这是假设性路径，需要实际 instrumentation 验证。

---

## 五、已验证的安全代码

| 模块 | 状态 | 说明 |
|------|------|------|
| `pages/user/*` | ✅ 安全 | 纯展示/CRUD，无 runtime |
| `pages/community/*` | ✅ 安全 | 社区功能，无 runtime |
| `pages/admin/*` | ✅ 安全 | 后台管理，无 execution |
| `layouts/` | ✅ 安全 | 布局组件 |
| `assets/` | ✅ 安全 | 静态资源 |

---

## 六、修复方案分级

| 优先级 | 行动 | 预估工时 |
|--------|------|----------|
| P0 | 删除 `kernel/`, `governance/`, `runtime/`, `planning/` 目录 | 1 天 |
| P0 | 将 execution state 从 Pinia 迁至 API query-only | 3 天 |
| P1 | Composable 中去除 watch → dispatch 模式 | 5 天 |
| P1 | Visual Graph 降级为只读 visualization | 3 天 |
| P2 | 确认 bridge/ 和 multiAgent/ 的必要性 | 1 天 |
| P2 | 验证 graph recursion 是否存在并修复 | 3 天 |

**预计修复后效果**: 前端重启频率应降至正常水平（<5 次/天）

---

## 七、持续验证方法

1. 添加 Vue DevTools performance recording
2. 在 CI 中检测 store 中的 runtime mutation
3. 定期扫描 composable 中的 execution dispatch 模式
