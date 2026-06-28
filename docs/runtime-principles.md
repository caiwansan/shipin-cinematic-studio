# Runtime Principles（运行时宪法）

> 这些是不可破坏的规则。任何代码变更、新功能、架构调整都必须遵守。

## 1. DB 是唯一的真相源

`DB = source of truth`

- 所有持久化状态只信任 `pipeline_stages` 表
- UI 状态、localStorage、Queue 状态都只是投影或缓存
- 系统恢复时，永远从 DB 开始，不依赖任何前端缓存

## 2. UI 不拥有执行权

`UI is a projection surface, never an executor`

- 前端只负责：展示状态、提交任务、接收结果
- 前端不负责：决定"这个任务是否应该执行"、"这个 stage 是否真的完成"
- 状态推导由 Runtime 完成，UI 只消费推导结果

## 3. Stage 状态是推导的，不是假设的

`Stage state is derived, never assumed`

- 任何 stage 的 `status` 由上游依赖 + worker 执行结果共同决定
- 前端不能直接设置 `completed`，状态须由 execution runtime 返回确认
- `completeAndExecuteNext` 只是 UI 侧的"提交流程推进请求"，不是最终状态裁决

## 4. Worker 独占 Provider 执行权

`Worker owns provider execution`

- 所有 AI Provider 调用（百炼、火山引擎、siliconflow 等）必须通过 Worker Runtime
- 任何代码路径不得绕过 Queue/Worker 直接调用 Provider
- Provider 选择、fallback 链、重试策略都由 `api-router.service.ts` 统一管理

## 5. localStorage 只是缓存

`localStorage is cache only, never authority`

- localStorage 的唯一作用是：DB 不可用时做恢复回退
- localStorage 的数据永远不会反向写回 DB（除非 DB 明确为空）
- localStorage 可能在任何时刻被清空，系统不能依赖它运行

## 6. Queue 执行必须是幂等的

`Queue execution must be idempotent`

- 同一个 job 执行两次必须产生相同的结果
- Worker 不支持事务性提交，因此必须处理重复执行的情况
- Job 状态由 DB `pipeline_jobs` 表跟踪，而非 Queue 自身

## 7. Runtime 版本化

`Every persisted state carries a runtime version`

- 每次写入 `pipeline_stages` 必须附带 `runtimeVersion`
- 读取旧版本数据时，Runtime 负责兼容性处理
- 版本号变更意味着 schema 或语义发生变化，需同步更新 migration 策略

## 8. 系统自观察优先于系统控制

`Introspection before intervention`

- 任何自动化的修复/回退机制必须先提供可观测性
- Runtime 状态必须能被外部查询（`/system/status`），才能做自动化决策
- 没有 observable 的自动化是危险的

---

> 这些原则构成了 Runtime 的物理定律。违反任何一条都会导致系统 integrity 受损。
