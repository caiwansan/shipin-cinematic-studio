# 混沌珠小说工作台 — 技术架构设计

## 一、项目坐标

| 属性 | 值 |
|------|------|
| 项目名 | 混沌珠小说工作台（HunDunZhu） |
| 代码前缀 | `hdz` |
| 前端路由 | `/hdz/` |
| 后端 API | `/api/hdz/` |
| 数据库前缀 | `Hdz*`（表名） |
| 关联系统 | 昆仑镜（共享用户 / BYOK / Model Router） |

## 二、目录结构

### 前端

```
frontend/pages/hdz/
├── index.vue                  # 小说项目列表
├── new.vue                    # 新建项目向导
└── workspace/
    └── [id].vue               # 创作主工作台

frontend/components/hdz/
├── NovelSidebar.vue           # 左侧导航
├── AgentChat.vue              # 聊天/Agent对话区
├── Storyboard.vue             # 故事板/大纲树
├── ManuscriptEditor.vue       # 手稿编辑器
├── MemoryVault.vue            # 记忆库可视化
├── CharacterCard.vue          # 角色卡
├── ApprovalPanel.vue          # HITL 审批面板
└── ReviewNotes.vue            # 审核意见面板
```

### 后端

```
backend/src/routes/hdz/
├── index.ts                   # 路由注册入口
├── project.ts                 # 项目 CRUD
├── agent.ts                   # Agent 任务调度
├── memory.ts                  # 记忆库读写
├── manuscript.ts              # 手稿存取
└── style-dna.ts               # 风格 DNA 提取

backend/src/services/hdz/
├── orchestrator.service.ts    # 主控协调中枢
├── planner.service.ts         # 规划 Agent
├── character-agent.service.ts # 人设 Agent
├── director.service.ts        # 创作指导 Agent
├── writer.service.ts          # 写作 Agent
├── reviewer.service.ts        # 审核 Agent
├── memory.service.ts          # 7-Truths 记忆管理
├── summarizer.service.ts      # 章节摘要压缩
└── style-dna.service.ts       # 风格 DNA 分析
```

### 数据库

```
backend/prisma/schema.prisma → 新增以下模型：

model HdzProject {
  id          String   @id @default(uuid())
  userId      String
  title       String
  genre       String?      // 小说类型
  wordTarget  Int?         // 目标总字数
  chapterWordTarget Int?   // 单章目标字数
  styleDesc   String?      // 写作风格描述
  status      String       // draft / active / completed
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  sessions    HdzSession[]
  characters  HdzCharacter[]
  chapters    HdzChapter[]
  memories    HdzMemory[]
  styleDna    HdzStyleDna?
}

model HdzSession {
  id          String   @id @default(uuid())
  projectId   String
  userId      String
  status      String       // active / paused / completed
  messages    Json         // Agent 对话记录 [{role, content}]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  project     HdzProject  @relation(fields: [projectId], references: [id])
}

model HdzChapter {
  id          String   @id @default(uuid())
  projectId   String
  chapterNo   Int
  title       String?
  status      String       // outline / draft / reviewed / final
  outline     Text?        // 大纲/段落指导
  content     Text?        // 正文
  wordCount   Int?         // 字数
  summary     Text?        // 章节摘要（用于上下文管理）
  reviewNotes Json?        // 审核意见 [{issue, severity, suggestion}]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  project     HdzProject  @relation(fields: [projectId], references: [id])
}

model HdzCharacter {
  id          String   @id @default(uuid())
  projectId   String
  name        String
  role        String       // protagonist / antagonist / supporting / minor
  properties  Json         // 属性 {age, gender, appearance, personality, background, motivation}
  relations   Json?        // 关系 [{target, type, description}]
  arc         String?      // 角色弧
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  project     HdzProject  @relation(fields: [projectId], references: [id])
}

model HdzMemory {
  id          String   @id @default(uuid())
  projectId   String
  type        String       // world_state / character_matrix / pending_hooks / chapter_summary
  content     Json         // 结构化的记忆数据
  version     Int          @default(1)
  createdAt   DateTime     @default(now())

  project     HdzProject  @relation(fields: [projectId], references: [id])
}

model HdzStyleDna {
  id          String   @id @default(uuid())
  projectId   String   @unique
  sourceText  Text?        // 用户上传的参考文本
  fingerprint Json         // 文风指纹 {sentenceLength, vocabulary, emotionPatterns, ...}
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  project     HdzProject  @relation(fields: [projectId], references: [id])
}

model HdzAgentTask {
  id              String   @id @default(uuid())
  projectId       String
  sessionId       String?
  agentType       String   // planner / character_agent / director / writer / reviewer
  status          String   // queued / running / completed / failed / waiting_approval
  input           Json     // 输入参数
  output          Json?    // 输出结果
  approvalStatus  String?  // pending / approved / rejected / modified
  approvalNote    String?  // 用户修改意见
  tokenCost       Int?
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime @default(now())

  project         HdzProject @relation(fields: [projectId], references: [id])
}
```

## 三、多Agent编排流程

### 3.1 核心链路

```
用户输入创意
    │
    ▼
┌─────────────────────────────┐
│  1. Planner Agent           │ ← 生成全局大纲
│     输出: { logline,        │    (三幕结构 + 关键转折)
│              acts,          │
│              key_turns }    │
└─────────┬───────────────────┘
          │ 流程暂停 → 用户确认/修改大纲
          ▼
┌─────────────────────────────┐
│  2. Character Agent         │ ← 生成角色设定
│     输出: { characters[],   │    (外貌/性格/动机/关系)
│              world_rules }  │
└─────────┬───────────────────┘
          │ 流程暂停 → 用户签注人设
          ▼
┌─────────────────────────────┐
│  3. Director Agent          │ ← 拆解第 N 章为段落指导
│     输入: 大纲 + 记忆库     │    (核心冲突/情感基调/节奏)
│     输出: { chapter_n: {    │
│              scenes[] } }  │
└─────────┬───────────────────┘
          │ 流程暂停 → 用户微调段落指导
          ▼
┌─────────────────────────────┐
│  4. Writer Agent            │ ← 生成章节正文
│     输入: 段落指导 +        │    (注入记忆上下文 + 风格DNA)
│           记忆上下文 +       │
│           风格DNA           │
│     输出: chapter_content   │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  5. Reviewer Agent          │ ← 逻辑校验 + 人设一致性
│     输出: { score,          │    (高亮建议修改段落)
│              issues[] }     │
└─────────┬───────────────────┘
          │ 未达标 → 反馈 Writer 重写（质量飞轮）
          │ 达标 → 用户定稿
          ▼
┌─────────────────────────────┐
│  6. 用户定稿                │
│     → 提取章节摘要          │
│     → 更新 7-Truths 记忆库  │
│     → 触发下一章循环        │
└─────────────────────────────┘
```

### 3.2 质量飞轮

```
Writer → Reviewer → 评分
                      │
               ┌──────┴──────┐
               │             │
            score≥7        score<7
               │             │
         写入章节稿    反馈 Writer 重写
               │             │
         更新记忆库    Reviewer 再审（最多 3 轮）
```

## 四、7-Truths 记忆文件系统

每次章节定稿后，系统自动生成以下 7 份结构化的记忆文件（存储在 `HdzMemory` 表）：

| 记忆类型 | 内容 | 用途 |
|---------|------|------|
| `world_state` | 当前世界状态、时间线、已完成事件 | 避免时间矛盾 |
| `character_matrix` | 角色交互矩阵（谁认识谁、关系变化） | 人设一致性 |
| `pending_hooks` | 未闭合伏笔列表（挂起时标记章节） | 伏笔闭环 |
| `chapter_summaries` | 各章节摘要（首段+尾段+关键事件） | 上下文压缩 |
| `location_state` | 场景位置状态（某地当前状况） | 地点连贯 |
| `pov_tracker` | 视角追踪（每章谁叙事） | 避免视角混乱 |
| `timeline` | 精确时间线（日期/季节/时间流逝） | 时间线管理 |

每次 Writer 调用时，从记忆库**动态加载当前章节相关**的记忆片段（非全量），通过预编译的摘要压缩后注入 Prompt。

## 五、上下文窗口管理策略

### 5.1 注入模板

```
[系统指令] ... (固定)
[风格DNA] ... (仅 Phase 3 启用)
[全局设定] 世界观规则 + 主要角色卡
[前情提要] 上一章摘要 + 最近 3 章关键事件
[当前章节指导] Director 输出的段落级指导
[挂起伏笔] 仅当前章节相关的未闭合伏笔
[写作任务] 当前章节编号和目标字数
```

### 5.2 压缩策略

- **全量注入**：系统指令 + 风格DNA + 角色卡（小，不压缩）
- **摘要注入**：前情提要（summarizer 压缩至 ≤500 tokens）
- **稀疏注入**：挂起伏笔（仅匹配当前章节范围）
- **裁剪阈值**：总注入 token 数超过模型上下文 60% 时，裁剪最早的章节摘要

## 六、人机协作（HITL）状态机

```
               ┌──────────┐
               │ 用户触发 │
               │ 章节生成 │
               └────┬─────┘
                    │
              ┌─────▼─────────────────┐
              │ AgentTask.status =     │
              │ 'waiting_approval'     │
              │ approvalStatus = null  │
              └─────┬─────────────────┘
                    │ 用户操作
          ┌─────────┼──────────┐
          │         │          │
    ┌─────▼───┐ ┌──▼────┐ ┌───▼──────┐
    │ approved│ │rejected│ │ modified │
    │ → 继续  │ │ → 重新 │ │ → 保留   │
    │  执行   │ │  生成  │ │  修改意见 │
    └─────┬───┘ └───────┘ └───┬──────┘
          │                    │
          ▼                    ▼
     下一节点             Writer 重写
     或定稿
```

## 七、BYOK 集成方案

**零改动复用**：混沌珠不碰任何 API Key 逻辑，完全走现有链路。

```
用户请求（BYOK 已配置）
    │
    ▼
/api/hdz/agent/run  →  HdzAgentTask.create()
    │
    ▼
orchestrator.service.ts
    │
    ├─ 读取 UserModelConfigV2（BYOK，完全复用）
    ├─ 构造 payload
    ▼
NarrativeGateway (复用)
    │
    ├─ v2-resolver → provider, apiKey, model
    ├─ modelAdapterRegistry → 调用第三方 LLM
    ▼
返回结果 → 写入 HdzAgentTask.output
```

## 八、前端工作台布局

```
┌─────────────────────────────────────────────────────┐
│  混沌珠 · {小说标题}                    [保存] [导出] │
├──────────┬────────────────────┬──────────────────────┤
│ 导航侧栏 │    主工作区         │  右侧面板            │
│          │                    │                      │
│ 📖 大纲  │ ┌────────────────┐ │ ┌──────────────────┐ │
│ 👤 角色  │ │ Agent 对话区   │ │ │ 📝 当前章节手稿   │ │
│ 📝 章节  │ │ （聊天式交互）  │ │ │ （可编辑文本区域）│ │
│ 🧠 记忆  │ │                │ │ │                  │ │
│ 🎨 风格  │ │ 用户: 写第3章  │ │ │ 第3章 密林追踪    │ │
│          │ │ Agent: 已生成  │ │ │                  │ │
│          │ │ 段落指导，请   │ │ │ 夜色如墨，林间   │ │
│          │ │ 确认...        │ │ │ 只有风吹过树梢   │ │
│          │ └────────────────┘ │ │ 的沙沙声...      │ │
│          │                    │ │                  │ │
│          │ [✅ 确认指导]      │ │ [✏️ 编辑] [💾]   │ │
│          │ [🔄 重新生成]      │ │                  │ │
│          │                    │ └──────────────────┘ │
│          │ ┌────────────────┐ │                      │
│          │ │ 审核意见面板    │ │                      │
│          │ │ ⚠️ 第3段: 人设  │ │                      │
│          │ │   与第1章矛盾   │ │                      │
│          │ │ 💡 建议: ...    │ │                      │
│          │ └────────────────┘ │                      │
├──────────┴────────────────────┴──────────────────────┤
│ 底部状态栏: 已写 2/20 章 | 当前模型: LongCat-2.0    │
└─────────────────────────────────────────────────────┘
```

## 九、Phase 1（MVP）里程碑

| 周次 | 交付物 |
|------|--------|
| 第1周 | 数据库模型创建 + Prisma migrate + 后端路由框架 |
| 第2周 | Planner Agent + 大纲生成 + 前端项目列表/新建向导 |
| 第3周 | Writer Agent + 章节生成 + 前端工作台骨架（Split pane） |
| 第4周 | Reviewer Agent + 审核 + 前端手稿编辑器 |
| 第5周 | 基础记忆库读写 + 前端记忆库面板 + 全链路打通 |
| 第6周 | HITL 中断节点 + 审批面板 + 用户微调 |
| 第7-8周 | 打磨 + 测试 + 部署上线 |

## 十、技术栈汇总

| 层 | 技术 |
|----|------|
| 前端框架 | Vue 3 + Nuxt 3（复用昆仑镜） |
| 前端样式 | 深色主题，与昆仑镜一致 |
| 后端 | Fastify + Prisma（复用昆仑镜） |
| 数据库 | PostgreSQL 16（复用昆仑镜实例） |
| LLM 调用 | NarrativeGateway → v2-resolver（复用） |
| 任务队列 | TaskQueue（复用） |
| 编辑器 | 纯 textarea（MVP），后续可升级 CodeMirror |
| 风格DNA | LLM 分析（无向量数据库依赖） |
