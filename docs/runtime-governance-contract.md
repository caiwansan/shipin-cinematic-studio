# Runtime Governance Lite Contract v1

> 不是设计文档，是"系统法律"。
> 所有代码修改必须遵守以下规则，否则视为违规。

---

## 1. State Truth Rule

**DB is source of truth. Pinia is cache. localStorage is ephemeral.**

```
DB       → 持久化，权威版本
Pinia    → 运行时快照，刷新重建
localStorage → 用户偏好/缓存，非核心数据
```

### 强制条款
- ✅ 用户创作数据（project, character, scene, execution result）**必须**存 DB
- ✅ 前端刷新后必须从 DB 重建状态（hydrate/resume）
- ❌ 禁止将创作数据作为"主要存储"放在 Pinia 或 localStorage
- ❌ 禁止 `localStorage` 存储 execution state

---

## 2. Runtime Lifecycle

所有 AI 生产流程必须遵循固定生命周期：

```
init → hydrate → restore → execute → checkpoint → persist
```

| 阶段 | 说明 |
|------|------|
| **init** | 前端 store 初始化，空状态 |
| **hydrate** | 从 DB 加载项目基础数据 + executionResults |
| **restore** | 从 runtimeCheckpoint 恢复执行状态 |
| **execute** | 执行 AI 任务（图片/视频/TTS 等） |
| **checkpoint** | 每完成一个 stage 写入 checkpoint |
| **persist** | 最终结果写入 executionResults |

### 强制条款
- ✅ 所有 page 级组件在 `onMounted` 中必须调用 hydrate
- ✅ hydrate 完成后必须检查 runtimeCheckpoint
- ❌ 禁止跳过 restore 直接执行（会导致重复创建）

---

## 3. Forbidden Patterns

### ❌ process.env 运行时修改
```ts
// 禁止
process.env.ALIYUN_API_KEY = userKey
// 必须
RuntimeContext.set({ userId, secrets })
```

### ❌ UI-driven runtime state
```ts
// 禁止
const runtimeState = ref()
// 必须
// 所有 execution state 必须通过 pipelineStore 管理
```

### ❌ Store-as-database
```ts
// 禁止
pinia state = 唯一存储
// 必须
pinia state = cache, DB = source of truth
```

### ❌ 无版本 localStorage key
```ts
// 禁止
localStorage.setItem('pipeline-state', data)
// 必须
localStorage.setItem('pipeline-store-v3', data)
// 并在 upgrade 时清理旧版本 key
```

---

## 4. Checkpoint Protocol

执行 AI 任务时必须遵循：

### 写入时机
| 事件 | checkpoint 动作 |
|------|----------------|
| stage 开始 | `POST /checkpoint/stage/{key}/start` |
| stage 完成 | `POST /checkpoint/stage/{key}/complete` |
| stage 失败 | `POST /checkpoint/stage/{key}/fail` |
| job 创建 | `runningJobs.push()` |
| job 完成 | `runningJobs.filter()` |

### 恢复流程
```
用户刷新 → hydrateProject() → checkResume()
  ├─ canResume = false → 正常进入
  └─ canResume = true  → 显示恢复提示
    ├─ 用户确认 → executeResume() → 进入中断 stage
    └─ 用户拒绝 → clearResume() → 重新开始
```

---

## 5. Async Contract

### Request Versioning
- 每个异步请求携带 `_reqVersion`（递增数字）
- 组件收到 response 时检查版本号
- 版本过期 → 丢弃结果（防 stale）

### Abort on Unmount
- 所有 `fetch` / SSE 必须在 `onUnmounted` 时 abort
- 使用 `AbortController` 绑定组件生命周期

### SSE Lifecycle
- SSE 连接必须绑定到组件 `onUnmounted`
- 收到 complete 事件后自动关闭连接
- 心跳超时（30s）自动重连

---

## 6. Provider Context Rule

所有 AI Provider 调用必须使用 RuntimeContext，禁止全局可变状态。

```
provider.generate({
  apiKey: runtimeContext.secrets.aliyunApiKey,  // ✅
  model: runtimeContext.secrets.aliyunImageModel  // ✅
})
```

### 禁止
```ts
provider.generate()   // 内部读 process.env
```

### 现在状态
- ✅ 阿里系 4 个 provider 已接入 RuntimeContext
- ❌ 其他 provider（硅基流动/DeepSeek/OpenAI/火山引擎）尚未接入
- ✅ withUserKey 和 withUserModelConfig 已停止写 process.env

---

## 7. Deployment Contract

### Frontend Build
- 每次部署前 `rm -rf .nuxt .output && nuxi build`
- build 成功后 `pm2 restart frontend`
- 前端构建产物不可增量更新

### Backend Deploy
- `tsc` 编译通过后 `pm2 restart api-server`
- prompt 等静态资源需要 `cp -r src/prompts/* dist/prompts/`
- Schema 变更需要 `npx prisma generate`（不自动 migrate）

### Cache
- build 后必须 Ctrl+F5 刷新（清 CDN/hydration cache）
- 旧 version key 必须清理
- 禁止前端缓存 API 响应

---

*这份 Contract 不是最终版。随着系统成熟，会逐步升级为完整的 Runtime Governance Architecture。当前阶段的目标是先让系统"不会失忆"。*
