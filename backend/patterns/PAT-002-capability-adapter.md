# PAT-002: Capability Adapter

**适用场景：** 模块需要与多个 Provider 交互，但业务逻辑不应依赖具体 Provider

## 问题

传统模式中，Agent 直接调用 Provider API，导致：
- 切换 Provider 需要修改 Agent 代码
- 新增 Provider 需要重新设计 Prompt
- Agent 无法做出"这个模型不支持 X、换那个模型做 X"的决策

## 方案

```
Agent / Planner（感知 Capability，不感知 Provider）
        │
        ▼
Capability Planner（唯一感知 Provider 的模块）
        │
        ▼
Provider Adapter（只做字段映射）
        │
        ▼
Provider API
```

### 核心机制

1. **Capability 枚举**：定义平台支持的所有能力（camera-path / physics-constraint / lip-sync 等）
2. **Provider Capability Matrix**：每个 Provider 注册它支持的能力和质量评分
3. **Capability Planner**：根据 FilmIR 需求 → 能力矩阵 → 拆分任务到不同 Provider
4. **Zero-Business Adapter**：Adapter 只做字段映射，不做推理

### 示例

```typescript
// Provider 注册能力
matrix: ProviderCapabilityMatrix = {
  provider: 'volcengine',
  model: 'doubao-seedance-1-5-pro',
  capabilities: ['camera-path', 'character-reference', 'physics-constraint'],
  quality: { 'camera-path': 0.9, 'physics-constraint': 0.7 },
}

// Agent 不写：
// if (provider === 'volcengine') { ... }
// 而是写：
// if (capabilities.includes('camera-path')) { ... }
```

## 约束

- Agent 中禁止出现 Provider 名称（volcengine / veo / seedance）
- Adapter 中禁止出现业务推断逻辑（narrative.includes / text.match）
- 新增 Provider 只需要新增 Adapter + 注册 Capability Matrix

## 相关模式

- PAT-001: Immutable Object（Adapter 的输入是冻结的 FilmIR）
- PAT-005: Execution DAG（Planner 的输出是 DAG）
