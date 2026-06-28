# EXECUTION_RESULTS_CONTRACT.md — Project.executionResults 存储规范

**创建时间:** 2026-06-27  
**状态:** ✅ FROZEN (当前实践记录 + 未来规范)  
**当前状况:** ⚠️ 无 schema、无版本、无校验

---

## 1. 现状分析

### 1.1 数据结构

`Project.executionResults` 是 Prisma `Json` 字段，当前体积约数 KB ~ 数百 KB（取决于剧本长度和 Agent 输出）。

当前存储的内容:
- `rawScript` — 原始剧本文本
- `projectName` / `projectDesc` — 项目元数据
- `AigcSpecOutput` 的全部字段（`characterSpecs`、`sceneSpecs`、`videoSegments` 等）
- `analyzeV2Data` — V2 版本的剧本分析快照（被标记为 immutable）
- `targetDuration` / `durationInput` — 目标时长
- 前端 `saveToServer()` 写入的运行时状态（`segments`、`videoStyle`、`aspectRatio`、`styleLocked`）

### 1.2 当前保护机制

- `analyzeV2Data` 在每次更新时**强制保留**（immutable snapshot）
- 关键字段（`targetDuration`、`durationInput`、`rawScript`）在 merge 时被 preserved
- 前端 `loadFromServer()` 对所有字段使用 `?.` optional chaining

### 1.3 风险

1. **无版本号**: 无法判断数据结构是哪个版本的 Agent 输出
2. **无写入校验**: Agent 可以写入任意形状的数据
3. **无迁移机制**: 无法从旧版本平滑升级到新版本
4. **前端解析脆弱**: `loadFromServer()` 400+ 行的解析逻辑依赖字段名精确匹配

---

## 2. 存储规范（建议）

### 2.1 版本化 (v1.1+)

```typescript
interface ExecutionResultsEnvelope {
  // 版本信息
  version: string           // e.g., "1.0"
  updatedAt: string         // 上次更新时间 (ISO 8601)
  updatedBy: string         // 更新源: "agent" | "frontend" | "api"

  // 核心数据 (由 aigcOrchestrator 写入)
  spec: AigcSpecOutput      // 套用 AIGC_SPEC_OUTPUT_V1.md 的 Schema

  // 运行时数据 (由前端 saveToServer 写入)
  runtime: {
    segments?: any[]        // 前端修改后的分镜段
    videoStyle?: string
    aspectRatio?: string
    styleLocked?: boolean
    assets?: any[]
  }

  // 剧本原文
  rawScript: string
  projectName?: string
  projectDesc?: string

  // 遗留数据
  analyzeV2Data?: any       // immutable snapshot
  targetDuration?: number
  durationInput?: any
}
```

### 2.2 写入规则

| 写入方 | 写入范围 | 保护规则 |
|--------|---------|---------|
| `aigcOrchestrator` | `spec.*`, `rawScript` | 不允许覆盖 `runtime.*` |
| 前端 `saveToServer` | `runtime.*`, `projectName` | 不允许覆盖 `spec.*`、`rawScript` |
| 脚本提交 `api/script/submit` | `spec.*`, `rawScript` | Guard: 保留 `analyzeV2Data` |

### 2.3 读取规则

前端 `loadFromServer()` 读取顺序：

```
1. 读取 version
2. 如果 version 不存在或 < 当前版本:
   执行迁移
3. 如果 version 存在:
   直接按 spec.* 和 runtime.* 解析
4. 回退模式:
   如果 version 不存在，按旧格式解析（兼容）
```

---

## 3. 迁移策略

### 3.1 迁移触发器

- 每次读取时检查 `version`
- 如果缺失或低于当前版本 → 执行迁移
- 迁移后更新 `version` + `updatedAt`

### 3.2 迁移流程

```
读取旧 structure
    ↓
判断 version
    ↓
如果 version < targetVersion:
   逐版本应用迁移函数
    ↓
如果 version 不存在（最旧的旧数据）:
   执行"v0 → v1"迁移
```

### 3.3 迁移函数示例

```typescript
type MigrationFn = (old: any) => ExecutionResultsEnvelope

const MIGRATIONS = {
  "v0_to_v1": (old) => ({
    version: "1.0",
    updatedAt: new Date().toISOString(),
    updatedBy: "migration:v0->v1",
    spec: {
      plotBlueprint: old.plotBlueprint,
      characterSpecs: old.characterSpecs || old.characters,
      sceneSpecs: old.sceneSpecs || old.scenes,
      voiceConfigs: old.voiceConfigs || old.voices,
      videoSegments: old.videoSegments || old.segments,
      frameDesign: old.frameDesign,
      videoProduction: old.videoProduction,
      propSpecs: old.propSpecs || old.props,
      effectSpecs: old.effectSpecs || old.effects,
      // ... 迁移所有字段
    },
    runtime: {
      segments: old.segments,
      videoStyle: old.videoStyle,
      aspectRatio: old.aspectRatio,
      styleLocked: old.styleLocked,
    },
    rawScript: old.rawScript || old.script || "",
    projectName: old.projectName,
    projectDesc: old.projectDesc,
    analyzeV2Data: old.analyzeV2Data,
  })
}
```

---

## 4. 数据流控制

当前保护机制（已有代码）:

```
POST /api/script/submit → merge → write:
  ← preserved: analyzeV2Data, targetDuration, durationInput, rawScript
  ← merged: 新的 Agent 输出

PUT /api/v2/workbench/project/:id → merge → write:
  ← 前端 workbench 的增量更新
  ← 不覆盖 Agent 输出字段

GET /api/v2/workbench/project/:id → read:
  → 全量返回 executionResults
  → 前端 loadFromServer() 400+ 行解析
```

---

## 5. 审计日志

建议增加:

```
ExecutionResults:
 写入方: agent | frontend | api
 写入时间: ISO 8601
 写入意图: "重新分析剧本" | "用户修改角色" | "自动保存"
```

当前无法追溯谁在什么时候改了哪个字段。

---

## 6. 当前文件涉及 executionResults 的代码

| 文件 | 操作 |
|------|------|
| `src/routes/workbench-project.ts` | 创建/更新/加载 executionResults |
| `src/routes/script-submit.ts` | Agent 输出写入 + 合并 |
| `src/routes/projects.ts` | 保护 analyzeV2Data immutable |
| `frontend/stores/useStudioStore.ts` | 前端 loadFromServer() / saveToServer() |

---

**本文件是 Architecture Freeze 的一部分。存储规范变更需审批。**
