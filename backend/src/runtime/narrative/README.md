# Narrative Operating System (NOS) — Runtime Layer

领域隔离：**Novel Domain Only**
不得被任何其他工作台引用。

## Runtime 列表

| Runtime | 文件 | 职责 |
|---------|------|------|
| NarrativeRuntime | `index.ts` | 领域门面，协调所有子 Runtime |
| CharacterRuntime | `character/` | 角色状态、生命周期、位置、Flags |
| EventRuntime | `event/` | 事件数据库（Event Store） |
| TimelineRuntime | `timeline/` | 统一时间轴 |
| RelationshipRuntime | `relationship/` | 动态关系图谱 |
| KnowledgeRuntime | `knowledge/` | 人物认知差异 |
| WorldRuntime | `world/` | 世界观状态、势力格局 |
| ForeshadowRuntime | `foreshadow/` | 伏笔系统 |

## 核心原则

1. **SSOT (Single Source of Truth)**：所有小说"事实"必须由 Runtime 保存，不得依赖正文推断
2. **Queryable**：可直接回答"林辰现在在哪？"而不需要翻正文
3. **Traceable**：每个事实可追溯到来源章节和证据
4. **Evolvable**：每个状态变化都有 Timeline 记录

## 架构

```
Runtime → Repository (Prisma/JSON Files) → Database
```

每个 Runtime 通过接口交互，不互相直接耦合。
