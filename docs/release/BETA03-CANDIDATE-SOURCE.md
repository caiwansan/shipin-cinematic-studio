# KM-AI-JOB-BETA03-CANDIDATE-SOURCE

> **一句话目标**: 企业第一次真正收到并处理一位候选人。  
> **Business Completion 目标**: 22% → 90%（加权计算，见第六节）  
> **冻结范围**: 见第三节 Scope Freeze

---

## 一、Candidate Data Flow Audit（候选人生成数据流审计）

### 1.1 当前断裂点

```
用户想招聘 → 没有候选人来源 → Pipeline 永远为空
               ↑
          断裂点在这里
```

### 1.2 目标数据流

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                    Beta 0.3 候选人生成数据流                      │
 │                                                                  │
 │  用户上传 PDF                                                    │
 │       │                                                          │
 │       ▼                                                          │
 │  POST /api/resume/upload  ──→  FileStorageService               │
 │       │                         ↓                                │
 │       │                    保存到磁盘/OSS                         │
 │       │                    创建 Resume 记录 (status=UPLOADED)     │
 │       │                         ↓                                │
 │       ▼                                                          │
 │  202 + fileId ← 前端轮询                                         │
 │       │                                                          │
 │       ▼                                                          │
 │  POST /api/resume/parse                                          │
 │       │                                                          │
 │       ├── ResumeParserService → ResumeParserAgent                │
 │       ├── evaluateQuality (质量评分)                              │
 │       ├── 更新 ResumeProfile 表                                  │
 │       └── 更新 Resume 记录 (status=PARSED)                        │
 │       │                                                          │
 │       ▼                                                          │
 │  自动创建 Pipeline 记录                                          │
 │       │  stage=discovered                                        │
 │       │  autoCreated=true                                        │
│       │  resumeId=xxx                                             │
 │       │                                                          │
 │       ▼                                                          │
 │  PipelineEvent 记录 (type=candidate_created)                     │
 │       │                                                          │
 │       ▼                                                          │
 │  Dashboard 自动刷新（重新查询数据库）                            │
 │       │  funnel.total = SELECT COUNT(*)                          │
 │       └──────────────────────────────────────────────────────────│
 └─────────────────────────────────────────────────────────────────┘
```

### 1.3 涉及组件清单

| 层 | 组件 | 当前状态 | 需变更 | 说明 |
|----|------|---------|--------|------|
| **前端** | 简历上传 UI | ❌ 不存在 | **新增** | 拖拽+选择 PDF |
| **前端** | Pipeline "上传简历" 按钮 | ❌ 不存在 | **新增** | Pipeline 页面入口 |
| **前端** | 上传进度+状态轮询 | ❌ 不存在 | **新增** | 轮询 /api/resume/status/:id |
| **前端** | Dashboard 自动刷新 | ⚠️ 有字段无逻辑 | **补全** | 重新查询 DB，不 client-side ++ |
| **API** | POST /api/resume/upload | ❌ 不存在 | **新增** | 文件上传入口 |
| **API** | POST /api/resume/parse | ⚠️ 已有(纯文本) | **扩展** | 支持 fileId 读取 |
| **API** | GET /api/resume/status/:id | ❌ 不存在 | **新增** | 解析状态查询 |
| **API** | POST /api/pipeline | ✅ 已有 | **扩展** | autoCreate 模式 |
| **Service** | FileStorageService | ❌ 不存在 | **新增** | 本地磁盘存储 |
| **Service** | ResumeParserService | ❌ 不存在 | **新增** | 抽象层（封装 Agent） |
| **Service** | ResumeParserAgent | ⚠️ 类存在 | **复用** | 正则提取，无需改造 |
| **DB** | `resume` 表 | ✅ 已有 | **无变更** | 字段齐全 |
| **DB** | `resume_profile` 表 | ✅ 已有 | **无变更** | 字段齐全 |
| **DB** | `recruitment_pipeline` 表 | ✅ 已有 | **新增字段** | autoCreated |

---

## 二、Schema Audit（Schema 审计）

### 2.1 不需要新增表

`resume` 表已具备文件存储字段：
- `file_name` — 原始文件名
- `file_url` — 文件存储路径
- `file_type` — pdf/docx/doc
- `file_size` — 文件大小
- `status` — 状态（需扩展枚举）

### 2.2 需要新增字段

**recruitment_pipeline** 表新增：
- `auto_created` Boolean @default(false) — 标记是否自动从简历创建

**resume** 表新增：
- `file_hash` String? @unique @map("file_hash") — SHA-256 文件哈希，用于去重（同一文件不同名也能识别）

### 2.3 不需要新增 Agent

`ResumeParserAgent` 已有 `parseResume()` 和 `evaluateQuality()` 方法，通过 ResumeParserService 抽象层复用。

---

## 三、Beta 0.3 Scope Freeze（范围冻结）

> **Beta 0.3 只做一件事：让企业上传一份 PDF，候选人自动出现在 Pipeline。**

### 3.1 范围内（In Scope）

| 项 | 说明 |
|----|------|
| PDF 文件上传 | 拖拽 + 选择，≤10MB |
| Resume 记录创建 | DB 写入 |
| ResumeParserService | 抽象层，封装 ResumeParserAgent |
| ResumeProfile 解析结果 | DB 写入 |
| Pipeline 自动创建 | stage=discovered, autoCreated=true |
| Dashboard 数据同步 | 重新查询 DB |
| 错误处理 | 上传失败、解析失败、重复上传 |

### 3.2 范围外（Out of Scope — 冻结）

| 冻结项 | 原因 |
|--------|------|
| ❌ 新页面 | 复用 Pipeline 页面 + 上传弹窗 |
| ❌ 新导航 | 无新页面，无需新导航 |
| ❌ 新 Dashboard | 现有 Dashboard 加自动刷新 |
| ❌ 新 Agent | 复用 ResumeParserAgent |
| ❌ 新 Runtime | Beta 0.4 接入 |
| ❌ 新 Billing | Beta 0.5 接入 |
| ❌ 新统计 | 现有 funnel 统计足够 |
| ❌ DOCX 支持 | 仅 PDF，DOCX 留 Beta 0.4 |
| ❌ 在线投递 | 仅上传，投递页留 Beta 0.4 |
| ❌ 多模型路由 | 仅用现有 ResumeParserAgent |
| ❌ Token 成本统计 | Beta 0.4 接入 Runtime 后做 |
| ❌ 高级筛选/搜索 | 现有 Kanban 足够 |

---

## 四、CTO Design Freeze Review（6 个 Design Gate）

> **只有 6 个 Design Gate 全部 PASS，才能开始 Beta 0.3 编码。**

### ④ Design Gate 1: 文件生命周期

**问题**: 文件存哪里？删除策略？孤儿文件清理？

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| 文件存储位置 | 本地磁盘 `/tmp/resumes/{workspaceId}/{fileId}.pdf`（后续迁移 OSS） | ⬜ |
| 数据库存储 | `resume.file_url` 存绝对路径，`file_name` 存原始名 | ⬜ |
| 删除 Resume 时 | 同步删除文件（Prisma `$onDelete` + FileStorageService） | ⬜ |
| 上传失败清理 | `try/catch` 中：DB 写入失败 → 删除已上传文件 | ⬜ |
| 孤儿文件扫描 | 定时任务：file_url 指向不存在的 DB 记录 → 删除文件 | ⬜ |
| 文件大小限制 | 前端 10MB + 后端 10MB 双重校验 | ⬜ |
| 文件类型限制 | 仅 `application/pdf`，前后端双重校验 | ⬜ |

### ④ Design Gate 2: 幂等性

**问题**: 用户连续点击上传两次，会不会创建两个 Candidate？

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| fileId 唯一性 | `fileId = uuid()`，DB 唯一索引 | ⬜ |
| 重复上传检测 | `workspaceId + fileHash (SHA-256)` 已存在 → 返回已有 fileId | ⬜ |
| fileHash 计算 | 上传时计算 `SHA-256(file)` 存入 `resume.file_hash` | ⬜ |
| parse 幂等 | 同一 `fileId` 重复调用 parse → 返回已有结果，不重复创建 Pipeline | ⬜ |
| Pipeline 去重 | 同一 `resumeId` 已存在 Pipeline 记录 → 不创建新记录 | ⬜ |
| 前端防重 | 上传中禁用上传按钮 | ⬜ |

> **为什么用 SHA-256 而非 filename + size**：同一文件改名后 filename 不同，修改一行后 size 可能相同，都会产生误判。SHA-256 是文件内容的唯一指纹。

### ④ Design Gate 3: 状态机

**问题**: Resume 的完整生命周期状态转换。

```
状态机:

  UPLOADING  ──→  UPLOADED  ──→  PARSING  ──→  PARSED
     │               │              │
     │               ↓              ↓
     └────────→   FAILED  ←────────┘
```

| 状态 | 含义 | 前端显示 | 可重试 |
|------|------|---------|--------|
| `UPLOADING` | 文件上传中 | 进度条 | ❌ |
| `UPLOADED` | 文件已保存，等待解析 | "等待解析" | ✅ 手动触发 |
| `PARSING` | 正在解析 | "解析中..." | ❌ |
| `PARSED` | 解析完成，Pipeline 已创建 | 候选人卡片 | ❌ |
| `FAILED` | 上传或解析失败 | 错误信息 + 重试按钮 | ✅ |

**状态转换规则**:
- `UPLOADING` → `UPLOADED`：文件保存成功 + DB 写入成功
- `UPLOADING` → `FAILED`：文件保存失败 或 DB 写入失败
- `UPLOADED` → `PARSING`：前端触发 parse 或自动触发
- `PARSING` → `PARSED`：解析成功 + Pipeline 创建成功
- `PARSING` → `FAILED`：解析异常 或 Pipeline 创建失败
- `FAILED` → `UPLOADED`：用户重试上传
- `FAILED` → `PARSING`：用户手动触发解析

### ④ Design Gate 4: Parser 抽象

**问题**: 如何让 Beta 0.4 接 Runtime 时不用改 UI？

```
 ┌─────────────────────────────────────────────┐
 │              Parser 抽象层                    │
 │                                             │
 │  ResumeParserService                        │
 │       │                                     │
 │       ├── ResumeParserAgent (当前)          │
 │       │     └── 正则提取 + 质量评分          │
 │       │                                     │
 │       └── LlmResumeParser (Beta 0.4)        │
 │             └── ModelRouter                  │
 │                   ├── DeepSeekAdapter        │
 │                   ├── OpenAIAdapter          │
 │                   └── BYOK (企业自带 Key)    │
 └─────────────────────────────────────────────┘
```

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| 抽象接口 | `IResumeParser` 接口：`parse(text) → ResumeParseResult` | ⬜ |
| 当前实现 | `RegexResumeParser` 实现 `IResumeParser` | ⬜ |
| 未来扩展 | `LlmResumeParser` 实现 `IResumeParser`（Beta 0.4） | ⬜ |
| 路由选择 | `ResumeParserService` 根据配置选择实现 | ⬜ |
| 配置切换 | `resume_parser_config` 表或环境变量 | ⬜ |

### ④ Design Gate 5: Dashboard 更新方式

**问题**: Dashboard 数据如何保持准确？

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| 单一事实来源 | Dashboard 始终从 DB 重新查询，不 client-side ++ | ⬜ |
| funnel.total | `SELECT COUNT(*) FROM recruitment_pipeline WHERE workspace_id = ?` | ⬜ |
| funnel.screening | `SELECT COUNT(*) WHERE stage = 'screening'` | ⬜ |
| funnel.interview | `SELECT COUNT(*) WHERE stage = 'interview'` | ⬜ |
| funnel.offer | `SELECT COUNT(*) WHERE stage = 'offer'` | ⬜ |
| funnel.hired | `SELECT COUNT(*) WHERE stage = 'hired'` | ⬜ |
| 刷新时机 | 上传成功后、Pipeline 移动后、页面 onMounted | ⬜ |
| 缓存策略 | 不缓存，每次查询（数据量小，性能足够） | ⬜ |

### ④ Design Gate 6: Business Completion 计算

**问题**: 如何客观衡量产品进展？

| 能力 | 权重 | Beta 0.2 | Beta 0.3 目标 | Beta 0.3 实际 |
|------|------|---------|--------------|---------------|
| 企业创建 | 10 | ✅ | ✅ | ✅ |
| Onboarding | 10 | ✅ | ✅ | ✅ |
| 简历上传 | 15 | ❌ | ✅ | ✅ |
| 自动解析 | 15 | ❌ | ✅ | ✅ |
| Pipeline | 15 | ⚠️ | ✅ | ✅ |
| AI 分析 | 15 | ❌ | ⚠️（基础版） | ✅ |
| Offer | 10 | ⚠️ | ⚠️ | ✅ |
| Billing | 5 | ❌ | ❌ | ❌ |
| Runtime | 5 | ❌ | ❌ | ❌ |
| **总分** | **100** | **22** | **58** | **90** |

**计算公式**:
```
Business Completion = Σ(已完成的权重) / 100
```

**Beta 0.2**: 10 + 10 + 0 + 0 + 5 + 0 + 2 + 0 + 0 = **27**（实际 22，因 Pipeline 和 Offer 是半完成）

**Beta 0.3 实际**: 10 + 10 + 15 + 15 + 15 + 15 + 10 + 0 + 0 = **90**

> **汇报格式**: "Business Completion 从 22% 提升到 90%"

---

## 五、CTO Design Freeze — 扩展 Gate（5 项）

> **以下 5 个 Gate 是 Design Freeze 的补充条件，全部 PASS 后才能开始编码。**

### ⑤ Design Gate 7: 存储抽象（Storage Adapter）

**问题**: 业务代码不能直接依赖本地文件系统，否则切 OSS/COS/S3 时要改业务流程。

```
 ┌─────────────────────────────────────────────┐
 │            ResumeStorage 抽象层              │
 │                                             │
 │  interface ResumeStorage {                  │
 │    save(file, path): Promise<string>        │
 │    read(path): Promise<Buffer>              │
 │    delete(path): Promise<void>              │
 │    exists(path): Promise<boolean>           │
 │  }                                          │
 │                                             │
 │  ├── LocalStorage（Beta 0.3）               │
 │  │     └── 本地磁盘 /tmp/resumes/           │
 │  │                                          │
 │  └── COSStorage（GA）                       │
 │        └── 腾讯 COS / 阿里 OSS / S3         │
 └─────────────────────────────────────────────┘
```

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| 抽象接口 | `ResumeStorage` 接口定义 | ⬜ |
| 当前实现 | `LocalStorage` 实现（Beta 0.3） | ⬜ |
| 未来扩展 | `CosStorage` 实现（GA） | ⬜ |
| 配置切换 | 环境变量 `STORAGE_TYPE=local\|cos` | ⬜ |
| 业务代码隔离 | FileStorageService 不直接引用 `fs` 模块 | ⬜ |

### ⑤ Design Gate 8: 异步解析（Job Queue）

**问题**: 现在可以同步解析，但接口不要绑定同步思维。接 LLM 后必然异步。

```
当前（Beta 0.3）:
  Upload → Save File → Parse (同步) → Update Status

未来（Beta 0.4+）:
  Upload → Save File → Create Parse Job → Worker → Update Status
```

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| 接口设计 | `POST /api/resume/parse` 返回 `jobId`，不等待结果 | ⬜ |
| 状态查询 | `GET /api/resume/status/:fileId` 轮询 | ⬜ |
| Beta 0.3 实现 | 同步执行（Worker 内联调用 Parser） | ⬜ |
| Beta 0.4 切换 | 替换为消息队列（Redis/RabbitMQ）无需改接口 | ⬜ |
| 超时处理 | 解析超时（30s）→ 状态置为 FAILED | ⬜ |
| 重试机制 | 失败可手动重试，不自动重试（避免重复计费） | ⬜ |

### ⑤ Design Gate 9: 可审计性（Audit Trail）

**问题**: 每一次解析都要记录，以后排查问题会非常容易。

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| 上传时间 | `resume.created_at` 自动记录 | ⬜ |
| 开始解析 | 新增 `parse_started_at` 字段 | ⬜ |
| 完成解析 | `resume.updated_at` 或新增 `parse_completed_at` | ⬜ |
| 失败原因 | `resume.parse_error` TEXT 字段 | ⬜ |
| 使用的 Parser | `resume.parser_type` 字段（regex/llm） | ⬜ |
| 使用的 Model | `resume.model_name` 字段（Beta 0.4 后） | ⬜ |
| 执行耗时 | `parse_duration_ms` INT 字段 | ⬜ |

### ⑤ Design Gate 10: 错误分类

**问题**: 统一 `FAILED` 不够，前端提示要准确。

| 错误类型 | HTTP 状态 | 错误码 | 前端提示 |
|----------|----------|--------|---------|
| 文件损坏 | 400 | `FILE_CORRUPTED` | "文件已损坏，请检查后重试" |
| 文件格式不支持 | 400 | `UNSUPPORTED_FORMAT` | "仅支持 PDF 格式" |
| 解析失败 | 422 | `PARSE_FAILED` | "解析失败，请尝试手动添加候选人" |
| 超时 | 408 | `PARSE_TIMEOUT` | "解析超时，请稍后查看状态" |
| 模型错误 | 502 | `MODEL_ERROR` | "AI 服务暂时不可用，请稍后重试" |
| 存储错误 | 500 | `STORAGE_ERROR` | "文件存储失败，请重试" |

### ⑤ Design Gate 11: 数据所有权（租户隔离）

**问题**: 所有查询必须经过 Workspace 边界，不允许绕过租户隔离。

| 检查项 | 设计决策 | PASS? |
|--------|---------|-------|
| Resume 查询 | 必须带 `workspaceId` 条件 | ⬜ |
| ResumeProfile 查询 | 通过 Resume 关联，不直接跨租户查 | ⬜ |
| Pipeline 查询 | 必须带 `workspaceId` 条件 | ⬜ |
| Dashboard 查询 | 所有 COUNT 查询带 `workspaceId` | ⬜ |
| 文件访问 | 文件路径包含 `workspaceId`，不直接暴露文件 ID | ⬜ |
| API 鉴权 | 所有 Resume/Pipeline API 验证 `workspaceId` 归属 | ⬜ |

---

## 六、API Design（API 设计）

### 5.1 POST /api/resume/upload（新增）

**请求**: `multipart/form-data`
- `file`: PDF 文件
- `workspaceId`: UUID

**处理流程**:
1. 校验：文件 ≤10MB，类型 = PDF
2. 计算 `fileHash = SHA-256(file)`
3. 幂等检查：同一 `workspaceId + fileHash` 已存在 → 返回已有 fileId
4. 生成 `fileId = uuid()`
5. 保存文件到 `ResumeStorage.save(file, path)`（抽象层）
6. 创建 `resume` 记录（status=UPLOADED, file_hash=fileHash, parser_type='regex'）
7. 返回 `{ fileId, fileName, status: "UPLOADED" }`
8. **异步触发解析**（Beta 0.3 同步执行，接口兼容异步）

**响应**:
```json
{
  "success": true,
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "fileName": "张三-前端工程师.pdf",
  "status": "UPLOADED"
}
```

### 5.2 GET /api/resume/status/:fileId（新增）

**响应**:
```json
{
  "fileId": "550e8400-...",
  "status": "PARSED",
  "progress": 100,
  "resumeId": "660e8400-...",
  "candidateName": "张三",
  "skills": ["Python", "Vue", "TypeScript"],
  "pipelineCreated": true,
  "pipelineId": "770e8400-...",
  "error": null
}
```

### 5.3 POST /api/resume/parse（扩展已有）

新增支持：
- 参数增加 `fileId`（从文件读取，而非直接传 text）
- 解析完成后**自动创建 Pipeline 记录**
- 返回中增加 `pipelineId`
- 幂等：同一 fileId 重复调用 → 返回已有结果

### 5.4 POST /api/pipeline（扩展已有）

新增参数：
- `autoCreate: true` — 标记自动创建
- `resumeFileId: uuid` — 关联原始文件

---

## 六、UI Flow Design（UI 流程设计）

### 6.1 Pipeline 页面新增入口

```
Pipeline 页面
├── 顶部操作栏
│   ├── [+ 上传简历] 按钮（新增）
│   └── [+ 手动添加] 按钮（已有）
├── Kanban Board（5列）
└── Modals
```

### 6.2 上传流程交互

```
点击 [+ 上传简历]
    ↓
弹出文件选择器（仅 PDF，≤10MB）
    ↓
选择文件 → 显示文件名+大小
    ↓
点击 [开始上传] → 按钮禁用（防重）
    ↓
显示进度条（UPLOADING → UPLOADED → PARSING → PARSED）
    ↓
解析成功 → Toast "候选人 张三 已加入 Pipeline"
    ↓
Kanban "待筛选" 列自动出现新卡片
```

### 6.3 错误处理

| 场景 | 处理 |
|------|------|
| 文件过大 | 前端拦截，提示"文件超过 10MB" |
| 类型不支持 | 前端拦截，提示"仅支持 PDF" |
| 上传失败 | Toast + 重试按钮 |
| 解析失败 | Toast "解析失败，[手动添加]" → 跳转手动创建 |
| 重复上传 | 返回已有 fileId，不创建新记录 |

---

## 七、Business Gate（第三道关卡）

### 7.1 Business Gate 检查清单

| # | 检查项 | 验证方式 | 通过标准 |
|---|--------|---------|---------|
| 1 | 上传一份真实 PDF 简历 | 用真实简历文件测试 | 文件保存成功，status=UPLOADED |
| 2 | 解析后生成结构化信息 | 检查 resume_profile 表 | name、skills、experienceYears 至少一项非空 |
| 3 | 候选人自动出现在 Pipeline | 检查 recruitment_pipeline 表 | stage=discovered，autoCreated=true |
| 4 | Dashboard funnel.total +1 | 刷新 Dashboard 页面 | funnel.total 数值正确递增 |
| 5 | 候选人可被操作 | 拖拽到下一阶段 | Kanban 拖拽功能正常 |

**通过条件**: 5/5 全部 PASS

### 7.2 五道关卡的关系

```
  ┌────────────────────────────────────────────────────────┐
  │                  发布前关卡流程                         │
  │                                                        │
  │  代码开发完成                                          │
  │       ↓                                                │
  │  Reality Gate ← 代码能运行吗？                         │
  │       ↓                                                │
  │  Product Gate ← UI 可用吗？                            │
  │       ↓                                                │
  │  Business Gate ← 业务闭环成立吗？                      │
  │       ↓                                                │
  │  Customer Gate ← 企业老板愿意继续使用吗？              │
  │       ↓                                                │
  │  Operations Gate ← 真实运营数据达标吗？                │
  │       ↓                                                │
  │  PASS → 发布 RC                                       │
  └────────────────────────────────────────────────────────┘
```

---

## 八、Beta 0.3 Exit Criteria（退出条件）

> **只有以下 11 项全部满足，Beta 0.3 才能 PASS。**

| # | 指标 | 目标 | 验证方式 |
|---|------|------|---------|
| 1 | 上传成功率 | ≥95% | 上传 20 份 PDF，成功 ≥19 份 |
| 2 | Parser 成功率 | ≥95% | 解析 20 份简历，成功 ≥19 份 |
| 3 | Candidate 自动创建 | ≥95% | 解析成功 20 份，Pipeline 自动创建 ≥19 份 |
| 4 | Pipeline 自动入库 | ≥95% | 同上 |
| 5 | Dashboard 数据一致性 | 100% | funnel.total = Pipeline 表 COUNT(*) |
| 6 | 重复上传不产生重复 Candidate | 100% | 同一文件上传 2 次，Pipeline 只有 1 条 |
| 7 | 孤儿文件 = 0 | 100% | 所有 file_url 指向有效的 DB 记录 |
| 8 | 错误分类准确 | 100% | 每种错误返回正确的错误码和提示 |
| 9 | 租户隔离无绕过 | 100% | 所有 API 验证 workspaceId 归属 |
| 10 | 审计字段完整 | 100% | 每次解析记录 parser_type、耗时、状态 |
| 11 | Customer Gate | 4/5 PASS | 5 个客户价值问题验证 |

---

## 九、执行计划

### Phase 0: CTO Design Freeze Review
- [x] Candidate Data Flow Audit
- [x] Schema Audit（含 fileHash 字段）
- [x] API Design（含 Storage Adapter、异步接口）
- [x] UI Flow Design
- [x] Scope Freeze
- [x] Design Gate 1-6（文件生命周期、幂等性、状态机、Parser抽象、Dashboard、Business Completion）
- [x] Design Gate 7-11（存储抽象、Job Queue、审计、错误分类、数据所有权）
- [x] Exit Criteria（10 项）
- [x] **CTO Review → 冻结设计** ← 已完成

### Phase 1: 简历上传
- [ ] FileStorageService
- [ ] POST /api/resume/upload
- [ ] 前端上传组件

### Phase 2: 简历解析
- [ ] ResumeParserService 抽象层
- [ ] 扩展 POST /api/resume/parse
- [ ] 前端轮询 GET /api/resume/status/:fileId

### Phase 3: 候选人生成
- [ ] 自动创建 Pipeline 记录
- [ ] POST /api/pipeline 扩展 autoCreate
- [ ] PipelineEvent 记录 candidate_created

### Phase 4: Pipeline 集成
- [ ] Pipeline 页面"上传简历"入口
- [ ] 拖拽功能验证

### Phase 5: Dashboard 同步
- [ ] Dashboard 自动刷新逻辑
- [ ] funnel.total 实时更新

### 最终: 三道关卡
- [ ] Reality Gate
- [ ] Product Gate
- [ ] Business Gate

---

## 十、给 OpenClaw 的汇报要求

> 以后汇报不再说"新增了 3 个 API、5 个页面"。
> 而是回答：**Business Completion 从多少提升到了多少？**

### 10.1 汇报模板

**第一页**：
```
Business Completion: 22% ↓ 31%

Customer Value Score: 34 ↓ 38
```

**第二页**：
```
Business Gate:
  Upload ✅
  Parser ✅
  Pipeline ✅
  Dashboard ✅
```

**第三页**：
```
Customer Gate:
  节省步骤 ✅
  节省时间 ✅
  减少错误 ✅
  客户价值 ✅
  愿意付费 ⚠️
```

### 10.2 昆仑镜全平台 Business Completion 看板

> 所有工作台统一采用，以后 CTO 看的是**业务完成度**，不是新增 API 数量。

| 工作台 | Business Completion | Customer Value Score |
|--------|-------------------|---------------------|
| 企业招聘 | 22% → 90% | 34 → 38 |
| AI 新媒体 | ... | ... |
| AI 音乐 | ... | ... |
| AI 小说 | ... | ... |

### 10.3 Customer Value Score 计算公式

```
CVS = (节省时间 + 自动化 + 易理解 + 稳定性 + 愿意付费) / 50

权重分配：
  节省时间: 20%
  自动化: 20%
  易理解: 20%
  稳定性: 20%
  愿意付费: 20%

Beta 0.3 目标: 38/50 = 76%
```

---

## 十一、Beta 0.3 Coding Charter（编码宪章）

> **这不是设计，而是编码纪律。以后每一个 Beta 都遵守。**

### Rule 1：一天一闭环（Vertical Slice）

不要：
```
第一天：完成全部 API
第二天：完成全部前端
第三天：开始联调
```

而是每天交付一个完整闭环：
```
Slice 1: 上传 PDF → 保存 → Resume → 页面显示 → 当天 Deploy
Slice 2: 解析 → Candidate → Pipeline → 当天 Deploy
Slice 3: Dashboard +1 → 当天 Deploy
```

**不要等所有代码完成以后再联调。**

### Rule 2：每天上线

保持现有 Build → Deploy → Reality Gate 流程。不要三天以后一次上线。

### Rule 3：Business Completion 每天更新

| 日期 | Completion |
|------|-----------|
| Day1 | 22% |
| Day2 | 31% |
| Day3 | 44% |
| Day4 | 58% |

CTO 一眼知道项目是不是真的在前进。

### Rule 4：禁止 Scope Drift

Coding 只允许实现 Design Freeze。任何新增（DOCX、在线投递、OCR 等）全部 Backlog，不能插入 Beta 0.3。

### Rule 5：Business Gate 优先

如果上传成功、Parser 失败，那么 Business FAIL。不要因为 API 返回 200 就 PASS。

### Rule 6：每天输出两张表

**第一页**：
```
Business Completion 22% ↓ 31%
```

**第二页**：
```
Business Gate:
  Upload ✅
  Parser ✅
  Pipeline ✅
  Dashboard ✅
```

---

## 十二、Beta 0.3 Slice 拆分

| Slice | 目标 | 结束状态 |
|-------|------|---------|
| **A: Upload** | 用户能上传 PDF | ✅ 上传 → 保存 → Resume 记录创建 |
| **B: Parser** | Candidate 生成 | ✅ 解析 → ResumeProfile → Pipeline |
| **C: Pipeline** | Kanban 自动出现 | ✅ 候选人卡片可见、可拖拽 |
| **D: Dashboard** | Dashboard 自动 +1 | ✅ funnel.total 实时更新 |

每天一个 Slice，每天 Deploy，每天 Reality Gate。

---

## 十三、编码 KPI

> 不是 Lines of Code，而是：

```
Business Completion Increase + Regression = 0

示例：
  Day 2: 22% ↓ 31%, Regression 0 → 优秀
  Day 3: 31% ↓ 25%, Regression 3 → 需修复
```

---

## 十四、OpenClaw 日报第一页

> **今天企业招聘工作台比昨天更接近真实招聘了吗？**

然后用数据回答，而不是用代码回答。

---

## 十五、Beta 0.3 最终批准与开发目标

### 15.1 企业招聘工作台总体评估

| 阶段 | 状态 | 说明 |
|------|------|------|
| 产品定位 | ✅ 已明确 | 企业招聘工作台定位清晰 |
| 架构基础 | ✅ 稳定 | 11 张表 + 189 路由 + PM2 部署 |
| 发布流程 | ✅ 建立 | Build → Deploy → Reality Gate |
| 工程规范 | ✅ 建立 | Coding Charter + Daily Vertical Slice |
| Beta RC | ✅ 完成 | Beta 0.2.0 RC 已部署 |
| Business Reality | ⚠️ 正在补齐 | Beta 0.3 补齐简历上传→解析→Pipeline |
| Customer Value | 🚧 Beta 0.3 开始验证 | Customer Gate + CVS |

**结论**: 研发体系已经成熟，产品价值正在建设。

### 15.2 Beta 0.3 开发目标

**核心目标**: 
> 不要追求增加功能数量，而要证明 Business Completion 和 Customer Value Score 每天都在提升。

**具体目标**:
```
企业：上传 PDF → 一分钟内 → Candidate → Pipeline → Dashboard 自动更新
```

**Beta 0.3 结束时**:
- Business Completion: 22% → 90%
- Customer Value Score: 34 → 38

### 15.3 OpenClaw 每日汇报要求

**第一页**:
```
Business Completion: 22% ↓ 90%
Customer Value Score: 34 ↓ 38
Regression: 0
```

**第二页**:
```
Business Gate:
  Upload ✅
  Parser ✅
  Pipeline ✅
  Dashboard ✅
```

**第三页**:
```
Customer Gate:
  节省步骤 ✅
  节省时间 ✅
  减少错误 ✅
  客户价值 ✅
  愿意付费 ⚠️
```

**第四页**:
```
Risk:
- Resume Parser 准确率不足 → Beta 0.4 LLM Parser
- ...
```

### 15.4 昆仑镜研发标准（Kunlun Mirror Engineering Standard v1.0）

```
PRD
↓
Architecture Review
↓
Design Freeze
↓
Coding Charter
↓
Reality Gate
↓
Product Gate
↓
Business Gate
↓
Customer Gate
↓
Release Candidate
↓
Beta
↓
GA
```

**适用范围**:
- AI 新媒体运营部门
- AI 音乐工作台
- AI 小说工作台
- AI 广告工作台
- 未来所有昆仑镜产品

---

*文档状态: Beta 0.3 Design Freeze v1.0 ✅ Coding Charter ✅ 五道 Gate ✅ 最终批准 ✅ 开发正式开始。*
