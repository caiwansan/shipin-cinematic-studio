# Runtime Execution Graph — 工程级 Blueprint

> 昆仑镜 AI Director OS | v2.3-kernel | 2026-05-26
> 这不是架构图，这是代码级调用链和模块拆分。

---

## 一、全局调用链

```
用户操作 (click / type / drag)
  │
  ▼
Frontend OS Shell (三栏)
  │ dispatch(KernelCommand)
  ▼
/api/v2/kernel/command
  │ Kernel.validate(command) ← 运行时强制隔离
  │ Kernel.route(command)
  ▼
┌────────────────── Kernel ──────────────────┐
│                                              │
│  ├─ EntityGraph.apply()    ← Agent / PATCH  │
│  ├─ Timeline.apply()      ← TimelineStage  │
│  ├─ EventLog.append()     ← 所有变更       │
│  └─ SnapshotManager.ops() ← 冻结/续集      │
│                                              │
└──────────────────────────────────────────────┘
  │ 变更完成后
  ▼
GET /api/v2/kernel/read → 前端 re-render
```

---

## 二、Kernel 模块拆分

### 2.1 文件结构

```
backend/src/kernel/
├── index.ts                    ← 导出 CanonicalKernel 单例
├── kernel.ts                   ← CanonicalKernel 主类
├── types.ts                    ← KernelCommand / ReadResult / Violation
├── validate.ts                 ← 权限矩阵 + 运行时拦截
├── entity-graph.ts             ← EntityGraph CRUD + version + diff
├── timeline.ts                 ← Timeline CRUD（Season→Episode→Scene→Shot）
├── event-log.ts                ← append-only EventLog（Event Sourcing 基础）
├── snapshot-manager.ts         ← freeze + spawn + list
├── creative-dna.ts             ← CreativeDNA CRUD
└── routes/
    ├── read.ts                 ← GET /api/v2/kernel/read
    ├── write.ts                ← POST /api/v2/kernel/write
    └── command.ts              ← POST /api/v2/kernel/command
```

### 2.2 KernelCommand 类型

```typescript
// 所有进入 Kernel 的写入请求
type KernelCommand = {
  // 来源标识（Kernel 用这个做 enforce）
  source: 'UI' | 'Agent' | 'TimelineStage' | 'Sequel' | 'SnapshotManager' | 'Execution'

  // 操作类型
  type: 'ENTITY_UPDATE' | 'ENTITY_CREATE' | 'ENTITY_DELETE'
      | 'ENTITY_REGENERATE'
      | 'TIMELINE_UPDATE' | 'TIMELINE_REORDER'
      | 'SNAPSHOT_FREEZE' | 'SNAPSHOT_SPAWN'
      | 'DNA_UPDATE'
      | 'EVENT_LOG'

  // 目标
  target: 'EntityGraph' | 'Timeline' | 'Snapshot' | 'CreativeDNA' | 'EventLog'

  // 载荷
  payload: {
    projectId: string
    entityType?: string        // character / scene / prop / voice / effect
    entityId?: string
    data?: any                 // 变更数据
    diff?: {                  // PATCH 时走 diff
      before: any
      after: any
    }
    reason?: string            // 变更原因，写 EventLog
  }
}
```

### 2.3 CanonicalKernel 主类

```typescript
class CanonicalKernel {
  private entityGraph: EntityGraphStore
  private timeline: TimelineStore
  private eventLog: EventLogStore
  private snapshotManager: SnapshotManager
  private validator: KernelValidator

  // === 唯一读入口 ===
  async read(projectId: string): Promise<CanonicalProjectState> {
    return {
      creativeDNA: await this.entityGraph.getDNA(projectId),
      entityGraph: {
        characters: await this.entityGraph.getByType(projectId, 'character'),
        scenes: await this.entityGraph.getByType(projectId, 'scene'),
        props: await this.entityGraph.getByType(projectId, 'prop'),
        voices: await this.entityGraph.getByType(projectId, 'voice'),
        effects: await this.entityGraph.getByType(projectId, 'effect'),
      },
      timeline: await this.timeline.get(projectId),
      snapshotVersion: await this.entityGraph.getVersion(projectId),
      frozenStateRef: await this.snapshotManager.getCurrent(projectId),
    }
  }

  // === 唯一写入口 ===
  async write(command: KernelCommand): Promise<WriteResult> {
    // Step 1: 运行时验证
    this.validator.validate(command)

    // Step 2: EventLog（所有变更先记录）
    const event = await this.eventLog.append({
      projectId: command.payload.projectId,
      type: command.type,
      source: command.source,
      payload: command.payload,
      timestamp: Date.now(),
    })

    // Step 3: 路由到具体 Store
    switch (command.target) {
      case 'EntityGraph':
        return this.entityGraph.apply(command.payload)
      case 'Timeline':
        return this.timeline.apply(command.payload)
      case 'Snapshot':
        if (command.type === 'SNAPSHOT_FREEZE')
          return this.snapshotManager.freeze(command.payload)
        if (command.type === 'SNAPSHOT_SPAWN')
          return this.snapshotManager.spawn(command.payload)
      case 'CreativeDNA':
        return this.entityGraph.updateDNA(command.payload)
      case 'EventLog':
        return event // already written
    }
  }

  // === UI dispatch 快捷入口 ===
  async dispatch(source: string, type: string, target: string, data: any) {
    return this.write({ source, type, target, payload: data } as KernelCommand)
  }
}
```

### 2.4 Validator（强制执行层）

```typescript
class KernelValidator {
  // 权限矩阵
  private static ACCESS_MATRIX = {
    // source: { target: { read, write } }
    UI: {
      EntityGraph:   { read: true,  write: false },
      Timeline:      { read: true,  write: false },
      Snapshot:      { read: true,  write: false },
      CreativeDNA:   { read: true,  write: false },
      EventLog:      { read: false, write: false },
    },
    Agent: {
      EntityGraph:   { read: true,  write: true  },  // Agent 唯一能写
      Timeline:      { read: true,  write: false },
      Snapshot:      { read: false, write: false },
      CreativeDNA:   { read: true,  write: false },
      EventLog:      { read: false, write: false },
    },
    TimelineStage: {
      EntityGraph:   { read: true,  write: false },
      Timeline:      { read: true,  write: true  },  // TimelineStage 唯一能写
      Snapshot:      { read: false, write: false },
      CreativeDNA:   { read: true,  write: false },
      EventLog:      { read: false, write: false },
    },
    SnapshotManager: {
      EntityGraph:   { read: true,  write: true  },  // freeze 需要读全部
      Timeline:      { read: true,  write: true  },
      Snapshot:      { read: true,  write: true  },
      CreativeDNA:   { read: true,  write: true  },
      EventLog:      { read: false, write: false },
    },
    Sequel: {
      EntityGraph:   { read: true,  write: false },  // Sequel 只读不写
      Timeline:      { read: true,  write: false },
      Snapshot:      { read: true,  write: false },
      CreativeDNA:   { read: true,  write: false },
      EventLog:      { read: false, write: false },
    },
    Execution: {
      EntityGraph:   { read: true,  write: false },
      Timeline:      { read: false, write: false },
      Snapshot:      { read: false, write: false },
      CreativeDNA:   { read: true,  write: false },
      EventLog:      { read: false, write: false },
    },
  }

  validate(command: KernelCommand): void {
    const access = KernelValidator.ACCESS_MATRIX[command.source]?.[command.target]
    if (!access) {
      throw new KernelViolation(
        `Source "${command.source}" has no access to target "${command.target}"`
      )
    }
    const isWrite = command.type !== 'READ'
    if (isWrite && !access.write) {
      throw new KernelViolation(
        `Source "${command.source}" cannot write to target "${command.target}". ` +
        `Only readable.`
      )
    }
  }
}

class KernelViolation extends Error {
  code = 'KERNEL_VIOLATION'
  constructor(message: string) {
    super(`[Kernel] 🚫 ${message}`)
  }
}
```

---

## 三、EntityGraph 模块

### 3.1 文件

```
backend/src/kernel/entity-graph.ts
```

### 3.2 类型

```typescript
type EntityType = 'character' | 'scene' | 'prop' | 'voice' | 'effect' | 'shot'

interface Entity {
  id: string                    // UUID
  projectId: string
  type: EntityType
  version: number               // 版本号，每次 update +1
  spec: any                     // 实体数据（具体结构由 Agent 决定）
  createdAt: number
  updatedAt: number
  parentId?: string             // 关联关系（如：shot.parentId = scene.id）
  tags: string[]                // 标签索引
  regenerateCount: number       // regenerate 次数
  lastRegenerateAt?: number
  imageRefs: string[]           // 已生成的图片 URL 引用
}

interface EntityDiff {
  entityId: string
  fromVersion: number
  toVersion: number
  changes: {
    field: string
    before: any
    after: any
  }[]
}
```

### 3.3 DB Schema（最小改动，复用现有 Project 表）

```sql
-- 新增 entity_graph 表
CREATE TABLE entity_graph (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        VARCHAR(32) NOT NULL,  -- character / scene / prop / voice / effect / shot
  version     INTEGER NOT NULL DEFAULT 1,
  spec        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_id   UUID,
  tags        TEXT[] DEFAULT '{}',
  regenerate_count INTEGER DEFAULT 0,
  last_regenerate_at TIMESTAMPTZ,
  image_refs  TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_entity_graph_project ON entity_graph(project_id, type);
CREATE INDEX idx_entity_graph_parent ON entity_graph(parent_id);

-- 旧 AigcSpecOutput 数据迁移
-- INSERT INTO entity_graph (project_id, type, version, spec)
-- SELECT id, 'character', 1, execution_results->'characterSpecs'
-- FROM projects WHERE execution_results IS NOT NULL;
```

### 3.4 CRUD 方法

```typescript
class EntityGraphStore {
  async getEntity(projectId: string, type: EntityType, id: string): Promise<Entity | null>
  async getByType(projectId: string, type: EntityType): Promise<Entity[]>
  async create(projectId: string, type: EntityType, spec: any): Promise<Entity>
  async update(id: string, spec: any): Promise<Entity>       // version +1
  async patch(id: string, diff: Partial<Entity>): Promise<Entity>  // diff 更新
  async delete(id: string): Promise<void>
  async batchCreate(projectId: string, entities: { type: EntityType; spec: any }[]): Promise<Entity[]>

  // Agent 专用
  async regenerate(id: string, newSpec: any): Promise<Entity>  // version + regenerateCount +1

  // 版本/diff
  async getDiff(id: string, fromVersion: number, toVersion: number): Promise<EntityDiff>
  async getVersion(id: string): Promise<number>
  async rollback(id: string, toVersion: number): Promise<Entity>

  // 辅助
  async getDNA(projectId: string): Promise<CreativeDNA>
  async updateDNA(projectId: string, dna: Partial<CreativeDNA>): Promise<CreativeDNA>
}
```

---

## 四、Timeline 模块

### 4.1 文件

```
backend/src/kernel/timeline.ts
```

### 4.2 类型

```typescript
interface Timeline {
  projectId: string
  seasons: Season[]
  version: number
}

interface Season {
  id: string
  seasonNumber: number
  title: string
  episodes: Episode[]
  frozen: boolean            // Season 1 冻结只读
  frozenSnapshotId?: string  // 引用 SnapshotManager
}

interface Episode {
  id: string
  episodeNumber: number
  title: string
  scenes: SceneRef[]          // 引用 EntityGraph 的 sceneId
  duration: number            // 总时长（秒）
  status: 'draft' | 'generating' | 'complete' | 'frozen'
}

interface SceneRef {
  entityId: string             // EntityGraph 的 scene.id
  order: number                // 在剧集中的顺序
  duration: number             // 本场景时长
  shots: ShotRef[]             // 引用 EntityGraph 的 shot.id
}

interface ShotRef {
  entityId: string             // EntityGraph 的 shot.id
  order: number
  duration: number
  camera: string               // 运镜描述
  dialogue?: string            // 对白
}
```

### 4.3 关键规则

```typescript
// Season 1 Episode 1..N → frozen（只读）
// Season 2 Episode 1..N → 可变（当前创作）
// 跨 Season 引用所有 scene/shot 走 EntityGraph ID，不走实体数据
```

---

## 五、SnapshotManager 模块

### 5.1 文件

```
backend/src/kernel/snapshot-manager.ts
```

### 5.2 类型

```typescript
interface FrozenSnapshot {
  id: string
  projectId: string
  seasonNumber: number
  episodeNumber: number
  creativeDNA: CreativeDNA         // 冻结时刻的 DNA
  entityRefs: {                   // 只存 ID 和版本号，不拷贝数据
    characters: { id: string; version: number }[]
    scenes: { id: string; version: number }[]
    props: { id: string; version: number }[]
    voices: { id: string; version: number }[]
    effects: { id: string; version: number }[]
  }
  timelineRef: {                  // Timeline 冻结引用
    version: number
    shotsOrder: string[]          // shot ID 顺序
  }
  imageRegistry: {                // 所有已生成图片的注册表
    characterImages: { entityId: string; url: string; type: string }[]
    sceneImages: { entityId: string; url: string }[]
    storyboardImages: { entityId: string; url: string }[]
    videoUrls: { shotId: string; url: string }[]
  }
  frozenAt: number
  label: string                   // "S01E01 最终版"
}
```

### 5.3 方法

```typescript
class SnapshotManager {
  // 冻结当前项目状态
  async freeze(projectId: string, label: string): Promise<FrozenSnapshot>

  // 基于冻结快照创建续集
  async spawn(input: SequelInput): Promise<SequelJob>

  // 查询
  async list(projectId: string): Promise<FrozenSnapshot[]>
  async get(id: string): Promise<FrozenSnapshot>
  async getCurrent(projectId: string): Promise<FrozenSnapshot | null>
}
```

---

## 六、CreativeDNA 模块

```typescript
// 持久化在 entity_graph 表的特殊 type='dna' 行
interface CreativeDNA {
  projectId: string
  genre: string[]                         // 剧情/喜剧/悬疑/科幻...
  emotionalTone: string                   // 温暖/沉重/轻松/紧张
  pacing: 'slow' | 'normal' | 'fast'     // 节奏
  audience: string                        // 目标受众
  cinematicStyle: string                  // 写实/动画/3D/油画...
  visualMood: string[]                    // 色调关键词
  platformTarget: string                  // 抖音/B站/YouTube...
  colorPalette: string[]                  // 主色调
  cinematicTechnique: string[]            // 常用运镜手法
}
```

---

## 七、前端 useCanonicalCore() Composable

```typescript
// frontend/composables/useCanonicalCore.ts

export function useCanonicalCore() {
  const kernel = useKernelAPI()

  const projectState = ref<CanonicalProjectState | null>(null)
  const loading = ref(false)

  // === 读 ===
  async function load(projectId: string) {
    loading.value = true
    projectState.value = await kernel.read(projectId)
    loading.value = false
  }

  // === 写（dispatch command，不直接操作数据） ===
  async function dispatch(
    type: string,
    target: string,
    data: any,
    reason?: string
  ) {
    await kernel.command({
      source: 'UI',
      type,
      target,
      payload: { projectId: projectState.value.projectId, ...data },
      reason,
    })
    // 写完后自动 reload
    await load(projectState.value.projectId)
  }

  // === 便捷访问 ===
  const characters  = computed(() => projectState.value?.entityGraph.characters ?? [])
  const scenes      = computed(() => projectState.value?.entityGraph.scenes ?? [])
  const timeline    = computed(() => projectState.value?.timeline)
  const creativeDNA = computed(() => projectState.value?.creativeDNA)

  return {
    load,
    dispatch,
    characters,
    scenes,
    timeline,
    creativeDNA,
    loading,
  }
}
```

---

## 八、完整运行时流程图

```
                   FRONTEND                          BACKEND
                   ────────                          ──────
                                          
┌──────────┐     dispatch()                                           
│ ThreePanel │ ────────── KernelCommand ──────→  POST /api/v2/kernel/command
│  Shell   │                                       │
│  ↓        │                                       │ Kernel.validate()
│ Stage    │                                       │   ├─ source === 'UI'
│  ↓        │                                       │   ├─ target === 'EntityGraph'
│ Stage    │                                       │   └─ write: false → 🚫 VIOLATION
│  Content │                                       │
│  ↓        │                                       │ Kernel.route()
│ Agent UI │                                       │   └─ EntityGraph.apply()
│  ↓        │                                       │       └─ EventLog.append()
│ IdePanel │                                       │
└──────────┘     load()                             │
                 ── GET /api/v2/kernel/read ←───────┘
```

### 关键路径示例

**用户点击 "AI 生成角色"：**
```
1. AgentStage dispatch({ source: 'UI', type: 'ENTITY_REGENERATE', target: 'EntityGraph' })
2. Kernel.validate() → UI cannot write EntityGraph → 🚫 DENIED
3. UI 必须通过 Kernel 路由到 Agent
4. Agent 执行 → dispatch({ source: 'Agent', type: 'ENTITY_REGENERATE', target: 'EntityGraph' })
5. Kernel.validate() → Agent can write EntityGraph ✅
6. EntityGraph.apply() → 更新 DB + version++
7. EventLog.append() → 记录变更
8. UI re-render via load()
```

**用户拖拽调整分镜顺序：**
```
1. TimelineStage dispatch({ source: 'TimelineStage', type: 'TIMELINE_REORDER', target: 'Timeline' })
2. Kernel.validate() → TimelineStage can write Timeline ✅
3. Timeline.apply() → 更新 shot order
4. EventLog.append()
5. UI re-render
```

**用户创建续集：**
```
1. UI dispatch({ source: 'UI', type: 'SNAPSHOT_SPAWN', target: 'Snapshot', ... })
2. Kernel.validate() → UI cannot write Snapshot → 🚫 DENIED
3. UI 弹窗 → 用户确认 → Kernel 路由到 SnapshotManager
4. SnapshotManager.spawn() → 读 EntityGraph + Timeline + DNA
5. → 冻结 → 创建 Season 2 → 注入 Agent 约束
6. EventLog.append('SEQUEL_CREATED')
```

---

## 九、迁移策略（零崩溃）

### Step 1: 新增 Kernel 代码（不删旧代码）
```
新增 backend/src/kernel/* 
新增 routes/canonical-core.ts
新增 frontend/composables/useCanonicalCore.ts
```

### Step 2: 双写（短期）
```
旧 AigcSpecOutput ← Agent 继续写这里
新 EntityGraph    ← Agent 同时写这里（batchCreate）
```

### Step 3: 前端切到 useCanonicalCore()
```
页面        ← 旧读法     → 新读法
/studio      hydrationStore → useCanonicalCore()  ← 当前改造
/studio/production 保持不动  → Legacy Maintenance
```

### Step 4: 废弃旧存储
```
AigcSpecOutput 不再使用 → 数据迁移到 entity_graph 表
hydrationStore 改为 useCanonicalCore() 的 cache 层
```

---

## 十、最终架构（一句话总结）

```
Kernel（强制执行层）
  ├── validate（权限矩阵拦截）
  ├── route（路由到正确 Store）
  └── enforce（违反权限 → 拒绝）

UI → 只读 Kernel，dispatch command
Agent → 只写 EntityGraph（通过 Kernel）
Timeline → 只写时间结构（通过 Kernel）
Sequel → 只通过 SnapshotManager（通过 Kernel）
Execution → 只读 EntityGraph（通过 Kernel）
```
