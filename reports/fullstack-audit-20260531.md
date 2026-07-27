# 🕵️ 影剧厂全栈深度审查报告

**审查员**: 独立第三方
**审查时间**: 2026-05-31 14:38 CST
**审查范围**: 全栈（TS 后端 + Nuxt 前端）
**项目路径**: `/root/shipin-cinematic-studio/`

---

## 一、概览

| 指标 | 状态 |
|------|------|
| api-server-aigc 可用 | ❌ 崩溃（15/15 重启失败） |
| `tsc --noEmit` 编译 | ❌ 失败（2 errors） |
| 前端 Nuxt build | ⚠️ 需手动 patch cold-start |
| Git 版本控制 | ❌ 无 |
| 重复文件 | 6 组镜像目录 |
| runtime 追踪日志 | 600+ JSON 文件，持续增长 |

| 严重级别 | 问题数 |
|----------|--------|
| 🔴 S级（致命） | 2 |
| 🟠 A级（架构） | 4 |
| 🟡 B级（质量） | 3 |
| 🟢 C级（建议） | 3 |
| **合计** | **12** |

---

## 二、🔴 S级（致命 — 生产阻塞）

### S-1 `narrative-llm.ts` aigc-spec 废弃代码 → 服务强行崩溃

**位置**: `backend/src/routes/narrative-llm.ts:248-300`

**问题描述**:
第 248-300 行的代码**不是合法的 route handler**。它没有 `app.post(...)` 包裹，没有 `start` 定义，没有 `body` 提取，`provider` 和 `userPrompt` 变量是未定义的引用。这段代码在模块加载时就在同步作用域执行（在 `narrativeLLMRoutes` 函数体内、两个 app.post 之外），导致 Fastify 注册插件时直接崩溃。

**错误日志证实**:
```
ReferenceError: provider is not defined
    at narrativeLLMRoutes (dist/routes/narrative-llm.js:231:30)
    at Plugin.exec (avvio/lib/plugin.js:125)
```

**影响**: api-server-aigc 启动即崩，PM2 重启 15 次全部失败，服务完全不可用。

**根因**: 开发者写了一个完整的 LLM 调用逻辑（async/await、JSON 解析、响应构建）但**没有包裹 route 定义**。缺少 `app.post(...)`、`const start = Date.now()`、`const { text } = request.body`、`let userPrompt` 的构建四要素。形似完成但功能为零——"半成品灾难"的典型案例。

### S-2 `tsc` 编译永远失败

**位置**: `backend/tsconfig.json` + `backend/src/routes/narrative-llm.ts:293`

**问题描述**:
由于 S-1 的废弃代码中 `catch (err: any) { ... }` 和 `});` 不在任何函数体/route handler 内，TypeScript 编译器无法解析：
```
src/routes/narrative-llm.ts(293,7): error TS1005: 'try' expected.
src/routes/narrative-llm.ts(300,4): error TS1128: Declaration or statement expected.
```

**影响**: `npm run build`（tsc）永远失败。当前 dist 目录全靠手工 patch，无法进行自动化部署。这也是 PM2 崩溃的核心原因 — 手工 patch 后的 dist 仍然有语法问题。

**讽刺之处**: 开发模式用 `tsx watch` 绕过了编译（因为 tsx 按需转译不报文件级错误），导致这个问题**在本地开发时完全不可见**，只有到构建/部署时才爆炸。典型的环境间隙 bug。

---

## 三、🟠 A级（架构/代码质量）

### A-1 前端文件大量镜像复制（Copy-Paste 病）

**问题**: 前端的多个目录存在**嵌套的自身镜像副本**：

```
frontend/config/          ← 原始文件（renderPipeline.ts 等）
frontend/config/config/   ← 镜像副本（所有文件完全重复）
├── config/
│   ├── renderPipeline.ts
│   ├── shotTemplates.ts
│   ├── stageFlow.ts
│   └── workerMap.ts
├── renderPipeline.ts     ← 原始
├── shotTemplates.ts
├── stageFlow.ts
└── workerMap.ts

同样问题出现在：
- services/services/services/ (三层嵌套?)
- types/types/
- ui/ui/
- utils/utils/
- bridge/bridge/
- runtime/runtime/
```

**影响**:
- 代码库规模膨胀 ≥ 30%
- nuxt build 产物体积增大，编译时间延长
- 开发者不知道该改哪个副本（两个文件内容可能不同步）
- 增加认知负担，每次审代码要多看一层目录

**根因诊断**: 极可能是构建脚本中某个 `cp -rf src/ dest/` 操作在工作目录已经等于 `dest` 时执行，导致目录不断自复制。或者 `nuxt build` 的 output 目录与 source 目录冲突。

### A-2 前端双运行时冲突（Kernel vs Runtime）

**问题**: 前端存在两个并列的运行时系统：
- `frontend/runtime/` — ExecutionRuntime + JobDispatcher（约 400 行）
- `frontend/kernel/` — runtime-kernel + lifecycle-manager + shadow-runtime + scheduler（约 2000 行）

**详细对比**:

| 维度 | `runtime/` | `kernel/` |
|------|-----------|-----------|
| 定位 | 作业执行运行时 | 内核运行时 |
| 工作调度 | JobDispatcher | kernel-scheduler + priority-coordinator |
| 状态管理 | 无 | state-tree, shadow-state |
| 生命周期 | 无 | lifecycle-manager, lifecycle-guard |
| 断路器 | 无 | kernel-circuit-breaker |
| 内存管理 | 无 | memory-manager, GC, pressure-controller |
| 指标观测 | 无 | metrics, health-comparator |
| 资源管理 | 无 | gpu-resource, worker-resource |

`kernel/` 层明显是 `runtime/` 的替代者/进化版，但**两者在 Nuxt 客户端同时存活**。`kernel/cutover/` 目录尝试做渐进切换，但不存在明确的关断点。

**影响**:
- 同一功能（作业调度）有两条执行路径
- 前端内存消耗膨胀
- 调试时不知道代码走哪条路径
- 状态一致性风险（runtime 和 kernel 可能维护两套状态）

### A-3 注册代码缩进混乱

**位置**: `backend/src/index.ts:210-250`

**问题**: 各个 `app.register()` 调用的缩进不一致，从 0 空格到 4 空格都有：
```typescript
  await app.register(communityCategoryRoutes)    // 2空格
  await app.register(communityPostRoutes)        // 2空格
await app.register(projectV2Routes)              // 0空格！
```

**影响**: 功能不受影响，但暴露了代码管理纪律的缺失——许多行是后期通过 sed/vim 快速拼贴上去的，没有格式化步骤。

### A-4 硬编码 Provider Name（违反宪法）

**位置**: `backend/src/routes/narrative-llm.ts:120-126`

```typescript
const provider = getProvider('deepseek')  // deepseek 硬编码
```

系统收敛宪法第 6 条「禁止硬编码」明确要求所有 provider/模型/API/端点到数据库。此处的硬编码意味着：
- 如果 deepseek 被禁用/下线，这个 route 无条件失败
- 用户不能通过管理后台选择其他 provider
- 与用户自配 Key 的原则冲突

---

## 四、🟡 B级（代码质量/维护性）

### B-1 无 Git 版本控制

**问题**: 整个项目不是 git 仓库。唯一的版本管理是手工备份：
```
backups/code_20260531_121714/
backups/code_20260531_131636/
backups/code_20260531_142404/
```

并且 narrative-llm.ts 有 4 个 `.bak` 文件：
```
narrative-llm.ts
narrative-llm.ts.bak2
narrative-llm.ts.bak3
narrative-llm.ts.bak4
```

**影响**:
- 无法回滚特定文件的变更
- 无法做 code review diff
- 无法 blame 定位引入 bug 的变更
- 无法有组织地协作

### B-2 Runtime Trace 日志风暴

**位置**: `reports/runtime-trace/`

**问题**: 该目录有 **600+ 个 JSON 追踪文件**（还在持续增长），每个约 1-5KB，总计约 2-3MB。这些是每次 API 调用的执行追踪日志。

**影响**:
- 每分钟多次磁盘 IO 写入
- 日志文件膨胀，生产环境长期运行可达 GB 级
- 无人查阅（600+ 文件中没有删除/轮转机制）
- 暴露执行详情到文件系统，存在安全风险

### B-3 前端 Cold-Start 运行时补丁

**位置**: `frontend/nuxt.config.ts`

**问题**: 配置中的 nitro hook 在编译后用正则 patching 修改 nitro.mjs：
```typescript
hooks: {
  'compiled': () => {
    // Patch generated nitro.mjs after compile to eagerly import renderer chunk
    // instead of lazy-loading it on first request
    const nitroFile = resolve(serverDir, 'chunks/nitro/nitro.mjs')
    // ... regex patching logic
  }
}
```

**影响**: Nuxt SSR 冷启动时有一个懒加载竞态条件（race condition），这个补丁用运行时替换来掩盖。根因未修复，补丁可能在 Nuxt 升级后失效。属于"修症状不修病根"的典型。

---

## 五、🟢 C级（建议/可改进）

### C-1 多余花括号
**位置**: `narrative-llm.ts:103-105`
```typescript
export default async function narrativeLLMRoutes(app: FastifyInstance) {
{            // ← 无用花括号
{
```
JS 允许匿名花括号，但增加认知噪声和括号匹配难度。

### C-2 前端常量与配置混用
`frontend/config/` 中的文件本质上是纯常量定义（sceneTypeMap、actionWhitelist 等），但命名与配置系统混为一谈。没有使用 `.env` 或运行时配置机制用于这些值。

### C-3 无中央错误处理中间件
后端 50+ 个 route 的错误响应格式大部分已经是 `{ success: false, error: string }`，但缺少一个统一的 error handler 中间件，导致：
- 部分资源如上传路由的 413/415 错误返回裸状态码
- 错误格式不统一的风险持续存在
- 无法集中监控/记录错误率

### C-4 前端路径歧义
前端存在 `/services/services/` 三层目录结构，但部分 import 可能还引用旧路径：
```typescript
import { projectService } from '~/services/projectService'
// 同时也可能存在：
import { projectService } from '~/services/services/projectService'
```
这种路径不确定是冷编译残留还是有人在使用。

---

## 六、定量汇总

```
S级 (致命) .................... ████████████████████████  2
A级 (架构/质量) .............. ████████████████████████  4  
B级 (代码维护性) ............ ████████████████████████  3
C级 (建议) .................. ████████████████████████  3
───────────────────────────────────────────────
总计 ...................................... 12 个严重问题
```

---

## 七、恢复优先级路线图

```
优先级       任务               预估时间      依赖
─────────────────────────────────────────────────────────
🚨 P0   删除 aigc-spec 废弃代码    5min       → tsc 通过
   P1   编译通过 + clean dist      10min      ← P0
   P1   删除前端镜像副本            30min      独立
   P2   前端 kernel/runtime 合并   2h        ← P1
   P3   建立 git 仓库              1h         独立
   P3   Runtime trace 日志轮转     30min      独立
   P4   冷启动 patch 根因修复      3h        ← P1
   P5   Provider 名称去硬编码      2h         独立
   P6   中央 error handler         1h         独立
```

---

*报告结束。审查员: Clawdbot AI Audit Engine | 时间戳: 1780209594861*
