# State Governance Architecture

**目标**: 建立「唯一状态真相源协议」，终结 Multi-Source of Truth
**阶段**: Phase 1 — State Governance

---

## 1. 状态分类矩阵

### 🔵 DB — 唯一真相源（持久化，不可丢失）

| 状态 | 当前存储 | 目标存储 | 迁移方案 |
|------|----------|----------|----------|
| 用户模型配置 (provider/apiKey/model) | localStorage + UserModelConfig | ✅ DB (UserModelConfig) | 已存DB，需删除localStorage冗余 |
| 供应商选择 (每类模型) | localStorage.modelCardProviderMap | DB UserModelConfig.provider | 新增字段 perTypeProvider |
| Runtime Graph | Pinia memory | DB Project.runtimeGraph | 新增 JSON 字段 |
| Execution State | Pinia memory | DB Project.executionState | 新增 JSON 字段 |
| Pipeline Stage | Pinia memory | DB Project.pipelineStages | 新增 JSON 字段 |
| AI 生成结果 (image/voice/video) | Pinia memory | DB Project.generatedAssets | 新增 Asset 表 |
| VIP Plan | 前端 mock 数组 | DB vipPlans | 新建表 |

### 🟡 Pinia — 只做 DB 的内存镜像（不创造状态）

| Store | 角色 | 约束 |
|-------|------|------|
| projectHydration | characterSpecs 的内存缓存 | 只从 DB 加载，不直接修改 |
| pipelineStore | pipeline 状态的内存缓存 | 修改时同步写 DB |
| authStore | token + userInfo 缓存 | token 存 localStorage，userInfo 从 DB 加载 |

**黄金规则**: Pinia state 只能通过 `loadFromDB()` 初始化，不允许 `ref(defaultValue)` 凭空创造状态。

### 🟢 localStorage — 只存临时/会话状态

| 允许 | 禁止 |
|------|------|
| ✅ token / auth_token | ❌ provider 映射 |
| ✅ draft（未提交草稿） | ❌ runtime graph |
| ✅ UI 偏好（折叠/展开） | ❌ API Key |
| ✅ build version 检测 | ❌ 项目配置 |

---

## 2. 数据流协议

### 读取路径（Read）

```text
Component
  ↓ useStore().load()
  ↓
Store
  ├─ 检查 version 是否最新 → 是 → 返回缓存
  └─ 否则 →
        ↓
        fetch('/api/get-state') 
          ↓
        DB (Prisma)
          ↓
        返回 → 更新 store._version → 更新 state
```

### 写入路径（Write）

```text
Component
  ↓ store.updateField('xxx', val)
  ↓
Store
  ↓ 乐观更新 state + increment _version
  ↓
POST /api/save-state
  ↓
DB write (await)
  ↓
成功 → done
失败 → rollback store state
```

### 刷新恢复路径（Recovery）

```text
Page Load
  ↓
authGuard → 验证 token
  ↓
Store.initializeAll()
  ├─ for each store:
  │     ├─ store._loading = true
  │     ├─ fetch DB state
  │     ├─ 如果 DB 有值 → 覆盖默认值
  │     └─ store._loading = false
  │
  └─ watch 在此期间检查 _loading → 跳过所有副作用
```

---

## 3. 关键变更：Provider 选择入 DB

### 当前问题
`modelCardProviderMap` 存在 localStorage：
```typescript
// VoiceGeneration.vue / ai-task-util.ts
const raw = localStorage.getItem('modelCardProviderMap')
const map = JSON.parse(raw)
provider = map.tts  // ← 不可靠
```

### 目标方案

**方案 A（推荐）**: UserModelConfig 扩展字段
```prisma
model UserModelConfig {
  id              String  @id @default(uuid())
  userId          String
  provider        String  // aliyun/volcengine/siliconflow/custom
  
  // 每类模型独立指定哪个 provider（新增）
  llmProvider     String?  // 为空则用默认
  imageProvider   String?
  videoProvider   String?
  ttsProvider     String?
  
  // 已有字段
  apiKey          String  // AES-GCM encrypted
  baseUrl         String?
  llmModel        String?
  imageModel      String?
  videoModel      String?
  ttsModel        String?
  llmEnabled      Boolean @default(true)
  ttsEnabled      Boolean @default(true)
  imageEnabled    Boolean @default(true)
  videoEnabled    Boolean @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([userId, provider])
}
```

**前端读取协议**:
```typescript
// 正式：从后端读取
async function loadProviderMap(): Promise<Record<string, string>> {
  const configs = await fetch('/api/user-model-config/all')
  // [{ provider: 'siliconflow', ttsProvider: 'siliconflow', ... }, ...]
  return {
    llm: configs.find(c => c.llmProvider)?.llmProvider || 'aliyun',
    image: configs.find(c => c.imageProvider)?.imageProvider || 'aliyun',
    video: configs.find(c => c.videoProvider)?.videoProvider || 'volcengine',
    tts: configs.find(c => c.ttsProvider)?.ttsProvider || 'siliconflow',
  }
}

// 写入时同步到 DB
async function saveProviderMap(map: Record<string, string>) {
  await fetch('/api/user-model-config/provider-map', {
    method: 'POST',
    body: JSON.stringify(map)
  })
}
```

**迁移节奏**: 
1. 先双写（localStorage + DB），在所有读取点加 DB fallback
2. 2 周后删除 localStorage 读取代码
3. 最终 localStorage 只存 token + UI 偏好

---

## 4. 实施优先级

| # | 变更 | 工作量 | 影响范围 |
|---|------|--------|----------|
| 1 | Provider 映射写入 DB（ModelSettingsModal.save → 新增 DB 字段） | 小 | ModelSettingsModal + api-router.service |
| 2 | Runtime Graph 持久化（Project.runtimeGraph JSON 字段） | 中 | Studio + GraphEditor + DB schema |
| 3 | Execution State 持久化 | 中 | Pipeline + Worker + DB |
| 4 | AI 结果 Asset 表 | 大 | 所有 provider + Worker + Store |
| 5 | 删除 localStorage 读取 | 小 | VoiceGeneration + ai-task-util |

---

## 5. 风险控制

- **双写期间**: 以 DB 优先，localStorage 降级
- **迁移期**: 添加 `console.warn('DEPRECATED: localStorage modelCardProviderMap')` 
- **回滚**: 所有 DB 迁移都有 down migration
- **验证**: 每次部署后运行 `npm run audit:state-consistency`
