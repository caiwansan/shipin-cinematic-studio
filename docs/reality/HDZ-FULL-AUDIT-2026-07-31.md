# HDZ 混沌珠小说工作台 — 全量审计报告

- **日期**：2026-07-31
- **范围**：前端 `frontend/pages/hdz/*` + `frontend/pages/novel/*` + `frontend/components/hdz/*`（8 文件，8042 行）；后端 `backend/src/routes/hdz/*` + `backend/src/services/hdz/*`（44 文件，13319 行）；全部 Agent 链；全部 AI/LLM 调用配置
- **方法**：三路并行深度审计（前端 / 后端+Agent / AI 配置）+ 关键问题代码级复核验证 + 线上 PostgreSQL 配置比对
- **审计员**：AI 开发助理（杨玉环）· 子代理 ×3
- **性质**：只审计，未修改任何代码

---

## 一、结论摘要

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 P0 安全 | 3 组 | PDF 无鉴权下载 / screenplay 缺归属校验 / 3 处资源级 IDOR |
| 🔴 P0 功能 | 5 项 | 审校审批流短路 / 封面静默失败 / 对话建宗门不落库 / 移动端全 401 / 剧本转换崩溃 |
| 🟠 P1 | ~25 项 | 前端解析 bug 一批、死代码、AI 配置缺陷（provider 缺失、prompt 变量、模型名不一致、配额缺失） |
| 🟡 P2 | ~12 项 | 死组件/死服务/死方法、吞异常、硬编码路径、暗雷 |

**最干净的结论**：19+ 个 LLM 调用点**全部 BYOK、零硬编码 API Key**，密钥加密落库、日志无泄漏。Agent 主链（planner→writer→reviewer→审批→质量飞轮）设计完整。

---

## 二、🔴 P0 — 安全漏洞（必须修）

### 2.1 剧本 PDF 无鉴权可下载任意项目（IDOR）
- **位置**：`backend/src/routes/hdz/agent.ts:15`（preHandler 放行）+ `:293-331`（handler 无归属校验）
- **详情**：`preHandler` 对 URL 含 `/pdf/` 的请求直接跳过 `app.authenticate`；handler `GET /api/hdz/agent/screenplay/:projectId/pdf/:taskId` 内部按 `projectId` 查询剧本任务，**无任何 userId 归属校验**。未登录用户猜中 `projectId + taskId`（UUID）即可下载任意项目剧本全文。
- **修复**：handler 内校验 `task.project.userId === request.user.id`；preHandler 改为精确路径匹配或移除放行（前端 `<a>` 下载可改为带 token 的 fetch blob 方案）。

### 2.2 剧本转换/列表接口缺归属校验
- **位置**：`backend/src/routes/hdz/agent.ts:257-281`（POST /screenplay）、`:284-289`（GET /screenplay/:projectId）
- **详情**：POST 只查项目存在、不校验 `project.userId !== user.id`——任意登录用户可把他人项目章节转剧本并读取全文内容；GET 跨项目剧本列表泄露。
- **修复**：两处补 `if (!project || project.userId !== user.id) return 404`。

### 2.3 资源级越权（3 处）
| 位置 | 问题 |
|------|------|
| `routes/hdz/manuscript.ts:92` | PUT 更新章节 `where: { id: chapterId }` 未限定 projectId——传自己 projectId + 他人 chapterId 可跨项目改写章节 |
| `routes/hdz/character-state.ts:119` | GET 角色详情 `findUnique({ id: characterId })` 未校验 `char.projectId === projectId`——跨项目泄露角色设定 |
| `routes/hdz/character-state.ts:143` | DELETE 状态记录未限定 projectId——跨项目删除 |
| `routes/hdz/story-event.ts:220` | DELETE 事件未限定 projectId——跨项目删除 |

---

## 三、🔴 P0 — 功能损坏（必须修）

### 3.1 审校审批流被强制短路（状态机语义破坏）
- **位置**：`services/hdz/orchestrator.service.ts:186-188` + `continueChain`（:358-375）
- **详情**：Reviewer 评分不通过时任务置 `waiting_approval`（reviewer.service.ts:157），但 orchestrator 立即**无条件强制改回 `completed`**——用户永远看不到审校审批弹窗（`/agent/approve` 返回 400「状态不可审批」）。随后 `continueChain` 在 `score < passScore` 时仍把章节标记为 `reviewed`，且事件源写死 `user_approved`——**不合格章节被标记已审阅，事件日志谎称「用户已通过」**。代码注释「等用户审批决定是否重写」与行为完全不符。
- **修复**：删除 186-188 强制提升；`continueChain` reviewer 分支 `score < passScore` 时保持 `draft` + 任务停留 `waiting_approval`，由用户审批决定重写。

### 3.2 封面图生成静默永久失败
- **位置**：`routes/hdz/project.ts:174` + `:223`
- **详情**：`credentialResolver.resolve({ ownerType: 'user', ownerId: userId, ... })` 中 **`userId` 变量未定义**（应为 `user.id`）→ ReferenceError → 被 `:223` 空 `catch (e) {}` 吞掉 → 封面图片生成静默永久失败，无任何日志。另 `:175-176` 拿到的 `v2.imageApiKey` 是**密文未解密**直接当 apiKey 用。
- **修复**：改 `user.id`；改用 `userModelResolverV2.resolveCapabilityProvider('image', userId)`（内部已解密）；去掉空 catch 并加错误日志。

### 3.3 对话中 AI 建宗门永不落库
- **位置**：`routes/hdz/chat.ts:407-408`
- **详情**：`prisma.hdzFaction.create` 传 `leaderNames: f.leaderNames || []` / `memberNames`，但 schema 字段是 **`leaderIds`/`memberIds`**（已核对 `prisma/schema.prisma` HdzFaction model）→ Prisma 未知字段校验错误 → 被 catch 吞掉 → 对话中 AI 输出的 `FACTION_DATA` 永远不会落库（角色 CARD_DATA 正常，因字段匹配）。
- **修复**：改 `leaderIds/memberIds`，或先按名字解析角色 ID（参考 faction.ts batch 路由写法）。

### 3.4 移动端三页全部 401（手机版不可用）
- **位置**：`pages/hdz/m/index.vue:101`、`pages/hdz/m/workspace/[id].vue:171`、`pages/hdz/m/reader/[id]/[chapter].vue`
- **详情**：移动端 `$api` 为裸 `fetch(url, { credentials: 'include', ... })`，**无 `Authorization: Bearer` 头**；后端 hdz 路由全部走 `app.authenticate`（JWT Bearer 认证）→ 移动端所有 API 请求 401。桌面端走 apiKernel（自动注入 Bearer）正常。
- **修复**：`$api` 统一注入 `getAuthToken()` 的 Bearer 头。

### 3.5 剧本转换成功即崩溃
- **位置**：`pages/hdz/workspace/[id].vue:3268-3269`
- **详情**：`submitScreenplay()` 成功分支写 `screenplayTasks.value = {...screenplayTasks.value, ...}`，但全文件从未 `ref()` 声明该变量（只有 `screenplaySrcTasks`）→ 剧本转换成功时抛 `ReferenceError`，功能必然中断。
- **修复**：改为写 `screenplaySrcTasks`，或补 `const screenplayTasks = ref<Record<number, any>>({})`。

---

## 四、🟠 P1 — 前端组件审计（应该修）

### 4.1 API 端点有效性（3 个调用了但后端不存在）
| 端点 | 调用位置 | 修复建议 |
|------|---------|---------|
| `GET /api/hdz/character/:projectId`（列表） | `pages/hdz/m/workspace/[id].vue:221` | 后端补 GET 列表路由，或前端改走 `GET /api/hdz/projects/:id`（含 characters） |
| `POST /api/hdz/chat/sessions`（建会话） | `pages/hdz/m/workspace/[id].vue:300` | 删除 `newSession()` 调用（`chat/send` 不带 sessionId 会自动建会话，chat.ts:172-180）；或后端补路由 |
| `POST /api/hdz/projects/:id/export` | `pages/hdz/m/workspace/[id].vue:371` | 移除「导出作品」菜单项，或后端实现导出接口 |

### 4.2 移动端数据解析 bug（与 3.4 叠加导致功能全空）
| 位置 | 问题 |
|------|------|
| `m/workspace:214` | `project.value = p` 未剥 `{success,data}` 包装 → 标题永远「加载中...」 |
| `m/workspace:222,226,234` | 角色/记忆/任务 `Array.isArray(c) ? c : []` 恒空（后端返回 `data:[...]`） |
| `m/workspace:230` | `s?.styleDna` 恒空 |
| `m/workspace:320` | 按 SSE 流式读 `res.body`，但 `chat/send` 返回普通 JSON → AI 对话气泡显示原始 JSON |
| `m/workspace:352-359` | `appendToChapter()` 先 `openChapter()` 跳转路由，随后 `saveChapter()` 依赖已为 null 的 `editingChapter.value?.id` 直接 return → 内容丢失 |

### 4.3 桌面端功能 bug
| 位置 | 问题 |
|------|------|
| `workspace/[id].vue:238` | 大纲展开详情 `v-if="expandedChapters.has(ch?.id || ch?.chapterNo)"` 中 `ch` 在 `v-for` 作用域外（undefined）→ 详情永远不显示 |
| `workspace/[id].vue:2741` | `c.status === 'review'`，但状态枚举是 `outline/draft/reviewed/waiting_approval/final`，无 `'review'` → 待审核建议永不出现。应改 `['reviewed','waiting_approval'].includes(c.status)` |
| `workspace/[id].vue:3380` | `loadMasterPlan` 取 `res?.data?.masterPlan || res?.data?.data`，后端返回 `data:{masterPlan,version}` → 取到包装对象，总纲中心内容渲染不出（:3395 generateMasterPlan 写法是对的，两处不一致） |
| `workspace/[id].vue` 聊天头 | `findIndex(...)+1` 当 `currentSessionId` 不在 `chatSessions` 时显示「对话 0/N」 |
| `workspace/[id].vue` :3153 与 :3415 | `watch(tab)` 注册两次，screenplay 加载逻辑重复执行 |
| `LibraryReaderPanel.vue:213` | 层级统计只遍历 `[5,50,100]`，composable 的 `batchLevelCounts` 含 `'10'` → 10 章小结数量不显示 |
| `m/reader` | `toolbarTimer` 无 `onUnmounted` 清理（轻微泄漏） |
| `workspace/[id].vue` | `cleanContent()` 输出经 `v-html` 渲染 AI 文本（低风险 XSS 面，建议 sanitize） |

### 4.4 死代码/不可达
- `pages/hdz/m/characters/:id`：`m/workspace:78` 角色卡片跳转到该页，**文件不存在** → 死链 404
- `pages/novel/index.vue`、`pages/novel/[id].vue`：纯「敬请期待」占位页，全站无导航入口 → 不可达
- `components/hdz/LibraryReaderPanel.vue`：与 `components/LibraryReaderPanel.vue` 内容完全一致（25906 字节 diff 相同），前者注册为 `HdzLibraryReaderPanel` 从未被引用（模板里 `<LibraryReaderPanel>` 解析到根目录副本）→ 重复文件
- `hdz/workspace/[id].vue` 未使用声明：`goModelSettings()`、`styleDnaDirty`、`memoryStatus()`、`readerContentHtml()`、`ttsQueue`、`pendingTask`、`approvalNote`、`approvalModifiedOutput`、`showApprovalPanel`/`toggleApprovalPanel`、`showHistory`、`historyTasks`、`previewExpanded`、`lrReadChars`、`levelIcon`
- `hdz/index.vue:241`：`const route = useRoute()` 未使用
- `hdz/m/index.vue`：`titleInput` ref 声明未访问；底部 4 个 Tab 中 3 个 `to="/hdz/m"` 死链接
- `LibraryReaderPanel.vue`：props `lrCurrentChapterLabel`（:261）、`formatNumber`（:278）声明未使用

### 4.5 认证与权限（桌面端健康项）
- ✅ 桌面端主 API 走 `$api`（apiKernel 自动注入 Bearer）；upload 用 `getAuthToken()` 显式 Bearer；会员接口 Bearer 正确
- ✅ `loadProject`（:2960）、`fetchApprovalTasks`（:2410）检测 401/403 → 停止 10s 轮询 + 刷新提示，处理到位
- ✅ `useLibraryReader` 全部请求带 Bearer（:137/192/249/302）

---

## 五、🟠 P1 — 后端组件审计（应该修）

### 5.1 注册与依赖
- ✅ 16/18 路由文件已注册；57 个 hdz 文件 import 全可解析；无循环依赖
- ❌ **`routes/hdz/novel-reference.ts` 未注册 + 引用不存在的 Prisma model `hdzNovelReference`**（`prisma/schema.prisma` 无此 model）→ 双死代码，注册即运行时 Prisma 校验错误。建议删除文件（功能若还要：补 model + 注册）
- ⚠️ 未使用 import：`orchestrator.service.ts:18`、`consistency-verifier.service.ts:19` 的 `emitEvent`
- ⚠️ 死服务（0 引用）：`entity-contract-checker.service.ts`、`master-plan.service.ts`、`story-context-builder.service.ts`
- ⚠️ 死 repository：`route-config.repository.ts`（reviewer.service 直接 `prisma.routeConfig`）
- ⚠️ 死方法：`orchestrator.service.ts:381 getRewriteCount()`
- ⚠️ `screenwriter.service.ts` `DEFAULT_SYSTEM_PROMPT` 未使用；`getSystemPrompt()` 无 try/catch 无 fallback，PromptRegistry 缺模板时路由 500

### 5.2 Agent 链审计
- ✅ 状态机 `queued → running → completed / failed / waiting_approval / approved / rejected` 基本完整；`failTask` 事务性回写 + 事件
- ✅ planner→writer→reviewer 链：Planner 审批通过 → `continueChain` 找第一章 → writer；writer 完成自动建 reviewer（有 queued/running 去重）
- ❌ Reviewer 审批流被强制短路（见 3.1）
- ⚠️ `reviewer.service.ts:26 execute(ctx)` 忽略 orchestrator 传入的 `userCfg`，内部重新 `getUserLLMConfig(project.userId)`——Enterprise Model Router 的企业路由配置对 reviewer 失效
- ⚠️ `handleApproval` 的 `modified` 操作把 `modifiedOutput` 仅存 `task.output`，**不回写 `hdzChapter.content`**——审批弹窗修改内容丢失
- ⚠️ `agent.ts:202` 手动审校任务 `status: 'pending'` 不在合法状态集（queued/running/completed/failed/waiting_approval）内
- ⚠️ `orchestrator.service.ts:112,168-176` 全部 fire-and-forget：无队列、无重试、无并发去重（并发链可能产生重复 writer 任务）
- ⚠️ `agent.ts:211-222` cancel-writing 只改 DB 状态，**无法中断 in-flight LLM 调用**；writer 完成后仍会写正文并改回 waiting_approval/completed
- ⚠️ `writer.service.ts:441-443` `formatBlueprintForLLM(blueprint)` 无空守卫，缺字段时 TypeError 使 writer 任务失败
- ⚠️ `callLLM` 120s 单次超时 ✅，但任务整体无超时/看门狗

### 5.3 安全
- ⚠️ `worldbuilder.service.ts:258` **SSRF 风险**：`fetchUrlContent(url)` 直接 fetch 任意 http(s) URL（用户消息经 LLM 回显的链接可指向 `127.0.0.1:8080`、`169.254.169.254` 等内网地址）。项目已有 `security/safe-fetch.ts`/`url-policy.ts` 未接入
- ⚠️ `agent.ts:15` 认证绕过规则 `url.includes('/pdf/')` 过宽——未来任何含 `/pdf/` 的新路由都会静默跳过鉴权
- ⚠️ `upload.ts` 仅校验扩展名 `.txt/.docx`，未校验魔数/真实类型
- ⚠️ `admin-review.ts:16-21` GET 评分阈值仅要求登录（非 admin，敏感度低）
- ⚠️ `tts.ts:18` 硬编码绝对路径 `/www/wwwroot/aigc.fushtn.com/tts`（换环境即坏；文件名用内容 MD5，无路径穿越 ✅）
- ⚠️ `library-reader.ts:130` `LEVEL_ORDER.reverse()` **原地修改模块级数组**（共享可变状态，当前因调用次数为偶而侥幸正确）→ 应 `[...LEVEL_ORDER].reverse()`

### 5.4 错误处理
- ✅ orchestrator 主链路 try/catch 覆盖完整，失败回滚 + 写事件 + 企业审计日志
- ⚠️ repository 吞异常：`hdz-agent-task.repository.ts:78-82`、`hdz-project.repository.ts`、`hdz-chapter.repository.ts`、`hdz-memory.repository.ts` 的 `update()` 均为 `catch { return null }`
- ⚠️ 空 catch：`project.ts:223`（封面失败，掩盖 userId bug）、`chat.ts:413/441`（autoSave 失败，掩盖 leaderNames bug）、`library-reader.ts` 多处
- ⚠️ `event-log.service.ts:28-52` `emitEvent()` 写入 `tenantId/userId/traceId/requestId` 字段——**EventLog model 无这些列**，一旦调用必抛错（当前无调用方，暗雷）
- ✅ `reviewer.service.ts:172-210` `$queryRawUnsafe` 参数全绑定无注入；`master-plan.ts` 贪婪匹配有 try/catch 兜底

### 5.5 数据库
- ✅ 22 个 hdz 相关 model 全部存在，字段与代码引用一致（`@@unique([projectId, chapterNo])`、masterPlan/locks/libraryReader*/blueprint 等）
- ❌ `hdzNovelReference` 不存在（见 5.1）
- ❌ `chat.ts:407` leaderNames/memberNames vs schema `leaderIds/memberIds`（见 3.3）
- ✅ repository 使用率健康：hdz-chapter(9)、hdz-character(6)、hdz-project(5)、hdz-agent-task(3)、hdz-style-dna(3)

---

## 六、🟠 P1 — AI/LLM 配置审计

### 6.1 调用点全清单（22 处，全部 BYOK）
| # | 调用点 (文件:行) | 用途 | 配置来源 | Prompt 来源 |
|---|-----------------|------|---------|------------|
| 1 | orchestrator.service.ts:57-67 | 五 agent 统一发配 | Enterprise ModelRouter 优先 → getUserLLMConfig | — |
| 2 | planner.service.ts:88 | 章节大纲 | orchestrator 传入 userCfg | `getAgentPrompt('hdz-planner')` ✅ |
| 3 | writer.service.ts:393 | 写正文（3 次字数重试） | 同上 | `hdz-writer` ✅ |
| 4 | writer.service.ts:546 | 章节摘要 | 同上 | `hdz-summarizer` ✅ |
| 5 | writer.service.ts:580 | 世界状态提取 | 同上 | ⚠️ 内联硬编码 |
| 6 | writer.service.ts:626 | 7-Truths 记忆提取 | 同上 | ⚠️ 内联硬编码 |
| 7 | reviewer.service.ts:64 | 章节审校打分 | getUserLLMConfig（L60） | `hdz-reviewer` ⚠️ 变量替换 bug（见 6.4） |
| 8 | character.service.ts:116 | 角色体系生成 | orchestrator 传入 | `hdz-character` ⚠️ DB 无此条 → 恒走硬编码 fallback |
| 9 | director.service.ts:148 | 写作指导/伏笔 | orchestrator 传入 | `hdz-director` ⚠️ DB 无此条 → 恒走硬编码 fallback |
| 10 | worldbuilder.service.ts:251 | 文曲星对话 | chat.ts:164 getUserLLMConfig | 内联 STATIC_SYSTEM_PROMPT |
| 11 | screenwriter.service.ts:157 | 章节→分镜剧本（唯一带配额检查） | getUserLLMConfig（L134） | `hdz-screenwriter` ✅ |
| 12 | master-plan.service.ts:217 | 总规划 | getUserLLMConfig（L195） | 内联 MASTER_PLAN_SYSTEM_PROMPT |
| 13 | master-plan-analyzer.service.ts:121 | Story Blueprint | getUserLLMConfig（L109） | 内联 BLUEPRINT_SYSTEM_PROMPT |
| 14 | event-extractor.service.ts:138 | 章节事件提取 | getUserLLMConfig（L119） | 内联 EVENT_EXTRACTION_SYSTEM_PROMPT |
| 15 | character-state-evolution.service.ts:353 | 角色状态演化 | getUserLLMConfig（L393） | 内联 EVOLUTION_SYSTEM_PROMPT |
| 16 | llm.client.ts:384 | 文风指纹分析 | getUserLLMConfig | 内联 STYLE_ANALYSIS_SYSTEM_PROMPT |
| 17 | chat.ts:300 | 对话摘要（每 50 轮） | chat.ts:164 | 内联 SUMMARY_SYSTEM_PROMPT |
| 18 | novel-reference.ts:225 | 参考小说分析（死路由） | getUserLLMConfig（L197） | 内联 ANALYSIS_SYSTEM_PROMPT |
| 19 | master-plan.ts:210 | 总规划生成（3 次重试） | Enterprise Router 优先 → getUserLLMConfig（L153） | 内联 MASTER_PLAN_PROMPT |
| 20 | story-event.ts:125 | 剧情事件提取 | getUserLLMConfig（L95） | 内联硬编码 |
| 21 | library-reader.ts:200 | 章节/批次总结 | deepseekChat → getUserLLMConfig | 内联 CHAPTER_SUMMARY_PROMPT |
| 22 | project.ts:158 | 封面 prompt 生成 | deepseekChat → getUserLLMConfig | 内联硬编码 |

### 6.2 配置正确性
- ✅ **BYOK 全覆盖**：22 个调用点无任何绕过；grep `sk-`/硬编码 apiKey 仅命中 tts.ts:69（resolved.apiKey 来自 userModelResolverV2 内部已解密）和 project.ts:175（⚠️ 密文未解密，见 3.2）
- ✅ **无硬编码旧模型名**：`deepseek-chat/reasoner/coder` 仅出现在 resolveDeepSeekModel 映射表（llm.client.ts:268-278）
- ✅ **UserModelConfigV2 字段读取正确**：llmProvider/llmModel/llmApiKey/llmBaseUrl/llmEnabled 与 schema.prisma:1311-1354 一致；忽略过时 `baseUrl` 字段属有意设计（saveUnified.ts:112 按能力写入 llmBaseUrl）；⚠️ 未读取 capabilityLlmConfigs

### 6.3 模型名与 provider（3 个问题）
1. **默认模型名三处不一致**：llm.client.ts:65 fallback `doubao-seed-2-1-pro-260628` ≠ schema.prisma:1321 默认 `doubao-seed-2-0-plus-260428` ≠ saveUnified.ts:90 默认 `doubao-seed-2-0-plus-260428`。新用户落库值与客户端兜底值不同。建议统一到单一配置源（config/env.ts 常量），并人工确认两个 doubao ID 在火山方舟均有效
2. **deepseekChat 不应用旧名映射**：llm.client.ts:296 `model: config.modelName` 原样发送；线上 DB 仍有用户配置废弃的 `deepseek-chat`/`deepseek-reasoner`（2026-07-24 废弃）——callLLM 路径会被修正 ✅，但 library-reader 总结与封面 prompt 走 deepseekChat 会直接 400/404。修复：deepseekChat 复用 resolveDeepSeekModel（或改调 callLLM）
3. **provider 缺失静默错路由**：`getBaseUrl`（llm.client.ts:251-261）只有 volcengine/deepseek/aliyun/longcat，未知 provider **静默回落 `https://api.openai.com/v1`**（L261）。线上 DB 已有 `zhipu`（glm-5）和 `siliconflow`（deepseek-ai/DeepSeek-R1）用户 → 这些用户的所有 hdz 调用打到 openai.com 报鉴权失败且无日志。修复：
   - 补全：`zhipu: https://open.bigmodel.cn/api/paas/v4`、`siliconflow: https://api.siliconflow.cn/v1`、`bailian: https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 未知 provider 应抛 CONFIG_ERROR（参考 resolveRuntimeConfig.ts:414-419 requireModel 模式），不要静默回落
4. ⚠️ longcat 地址两套代码不一致：hdz 用 `https://api.longcat.chat/openai`（llm.client.ts:259），resolveRuntimeConfig.ts:58 用 `/openai/v1`——需人工验证哪个正确

### 6.4 Prompt 变量替换（1 处真实 bug + 1 处泄漏）
- ❌ **reviewer.service.ts:51-56** 传参 `{ TITLE, GENRE, CHAPTER_NO, CHAPTER_TITLE }` **缺 `$` 前缀**，DB 模板用的是 `$TITLE/$GENRE/$CHAPTER_NO/$CHAPTER_TITLE`。`getAgentPrompt` 的 `replaceAll(key)` 是子串替换：`$TITLE` → `$《值》`（残留 `$`），且 `CHAPTER_TITLE` 先被 `TITLE` 子串污染成 `CHAPTER《值》`，后续键永远匹配不到。最终发给模型的 prompt 头部变成 `《$《标题》》（类型：$《类型》）第 $N 章「CHAPTER《标题》」` 乱码。**修复：改 `'$TITLE'/'$GENRE'/'$CHAPTER_NO'/'$CHAPTER_TITLE'`**
- ⚠️ **writer 模板占位符泄漏**：DB 中 hdz-writer 模板含 `$STORY_CONTEXT`（HDZ-NOVEL-INTELLIGENCE-01 最高优先级约束段），但 writer.service.ts:260-273 传入的 12 个变量没有 `$STORY_CONTEXT` → 字面量 `$STORY_CONTEXT` 直接发给 LLM。修复：注入 blueprint/角色状态到该占位符，或删模板字段
- ✅ planner（68-82）、character（63-70）、director（83-92）变量带 `$` 且与 DB 模板匹配

### 6.5 密钥安全
- ✅ 写入加密：saveUnifiedModelConfig 对 6 类能力 key 全走 encryptKey（AES-256-GCM，`iv:tag:ciphertext`）
- ✅ 解密链路：getUserLLMConfig（includes(':') 判定 + decryptKey）、resolveRuntimeConfig、userModelResolverV2、enterprise-llm.service 均正确；.env 已配置 CRYPTO_ENCRYPTION_KEY（42 行）
- ✅ 日志无泄漏：只打印 provider/modelName/userId 前缀；api-keys.ts:47 maskKey 脱敏
- ⚠️ 明文兼容分支（llm.client.ts:52-59）：历史明文 key 仍被接受 + console.warn——建议提供重加密迁移
- ⚠️ **crypto.service.ts:16-22 隐患**：CRYPTO_ENCRYPTION_KEY 未设置时自动生成随机密钥并 console.error **把密钥明文打到日志**，重启后旧密文全部不可解。当前 .env 已配置不触发，但应改为「未配置直接抛错」
- ⚠️ **vault-service.ts 全链路损坏**（高危暗雷，当前因崩溃未实际落库）：
  - schema.prisma **没有 `CredentialVault` 模型**（表是外部 raw SQL 建的 `credential_vault`，列名 `encrypted_payload`）→ `(prisma as any).credentialVault.create/findFirst`（vault-service.ts:26、credential-resolver.ts:40）运行时 TypeError
  - 即便修 model：vault-service.ts:27 把**明文 apiKey 存进 encryptedPayload**，且 getDecryptedCredential 读 `record.apiKey`（L43，列名不存在 → 恒 undefined）
  - providers.ts:168 算了 `encryptedKey = encryptKey(apiKey)` 却从未使用，L195-202 把明文传给 vaultService → 该接口当前行为 500「保存失败」
  - 修复：schema 补 `CredentialVault @@map("credential_vault")` 模型 + 存密文，或直接废弃该 service 统一走 saveUnified

### 6.6 配额与限流（覆盖严重不足）
- `incrementDailyUsage` 全仓仅 2 处：llm.client.ts:312（deepseekChat 成功后异步扣减）、screenwriter.service.ts:174；`checkDailyQuota` 仅 screenwriter.service.ts:151 一处
- **以下调用点既不检查也不计费**：orchestrator 五 agent 链（planner/writer/reviewer/character/director 全部主流程）、chat/worldbuilder（无限对话）、novel-reference、master-plan 路由、story-event、event-extractor、master-plan-analyzer、character-state-evolution、analyzeStyleDna、chat 摘要
- 影响：free 用户默认配额形同虚设，主流程无限使用

---

## 七、🟡 P2 — 死代码与优化（整理清单）

| 类别 | 项目 |
|------|------|
| 死组件 | `components/hdz/LibraryReaderPanel.vue`（与根目录副本重复，删其一） |
| 死页面 | `pages/novel/index.vue`、`pages/novel/[id].vue`（不可达占位页） |
| 死链接 | `m/workspace` 角色卡片 → `/hdz/m/characters/:id`（文件不存在） |
| 死路由 | `routes/hdz/novel-reference.ts`（未注册 + model 不存在） |
| 死服务 | `entity-contract-checker.service.ts`、`master-plan.service.ts`、`story-context-builder.service.ts` |
| 死 repository | `route-config.repository.ts` |
| 死方法 | `orchestrator.service.ts:381 getRewriteCount()` |
| 死代码块 | `screenwriter.service.ts` DEFAULT_SYSTEM_PROMPT；`workspace/[id].vue` 约 12 个未使用声明；`hdz/index.vue:241 route`；`m/index.vue titleInput`；LibraryReaderPanel 2 个未用 props |
| 吞异常 | 4 个 repository 的 update() catch 返回 null；project.ts:223 / chat.ts:413,441 / library-reader.ts 多处空 catch |
| 暗雷 | `event-log.service.ts` emitEvent 写不存在的 EventLog 列；`crypto.service.ts` 无 key 时明文打日志；vault-service 全链路 |
| 硬编码 | `tts.ts:18` 绝对路径 `/www/wwwroot/aigc.fushtn.com/tts` |
| 共享可变状态 | `library-reader.ts:130` LEVEL_ORDER.reverse() 原地修改 |

---

## 八、✅ 健康项确认

1. **Agent 主链设计完整**：planner→writer→reviewer→审批→质量飞轮，任务状态机 + 事件溯源 + 企业审计日志
2. **LLM 调用全部 BYOK**：22 个调用点零硬编码 key、密钥 AES-256-GCM 加密落库、日志脱敏
3. **模型名自动迁移**：resolveDeepSeekModel 已处理 2026-07-24 废弃的 deepseek-chat/reasoner/coder
4. **代码健康度**：57 文件 import 全解析、无循环依赖、22 个 Prisma model 引用一致
5. **桌面端体验**：API 解析、认证注入、401 处理、审批轮询、TTS/PDF 下载均正确
6. **安全基线**：上传 50MB 限制、文件名 MD5 防穿越、SQL 参数绑定、upload 认证齐全

---

## 九、修复优先级建议

### Phase 1 — P0（建议立即）
1. `agent.ts` PDF 下载鉴权 + 归属校验（15、293-331）
2. `agent.ts` screenplay 两接口补 userId 校验（257、284）
3. 资源级 IDOR 三处（manuscript.ts:92、character-state.ts:119,143、story-event.ts:220）
4. 删除 orchestrator 186-188 强制提升 + 修正 continueChain reviewer 分支
5. `project.ts:174` userId 未定义 + 封面 key 解密 + 去空 catch
6. `chat.ts:407` leaderNames → leaderIds/memberIds
7. 移动端三页 $api 注入 Bearer token
8. `workspace/[id].vue:3268` screenplayTasks 未声明

### Phase 2 — P1（AI 配置与功能）
9. getBaseUrl 补 zhipu/siliconflow/bailian + 未知 provider 抛错
10. reviewer prompt 变量补 `$` 前缀
11. deepseekChat 复用 resolveDeepSeekModel
12. 默认模型名三处统一
13. 配额覆盖主流程（orchestrator 链 + chat）
14. 移动端数据解析剥包装、3 个不存在端点、大纲详情、待审核状态、总纲解析、appendToChapter
15. reviewer 复用 llmCfg；handleApproval modified 回写章节；SSRF 接入 url-policy
16. 清理死代码（novel-reference、3 死服务、死组件、死页面、死方法）
17. vault-service 修复或废弃；crypto.service 无 key 直接抛错

### Phase 3 — P2（整理）
18. repository 吞异常改记日志；emitEvent 字段对齐；LEVEL_ORDER 拷贝；TTS 路径配置化；cron/看门狗兜底

---

*报告完毕。审计只读，未修改任何代码。修复待掌柜指令。*
