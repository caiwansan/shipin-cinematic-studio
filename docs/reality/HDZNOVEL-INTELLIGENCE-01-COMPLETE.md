# Sprint-HDZNOVEL-INTELLIGENCE-01 — 混沌珠小说智能内核接通工程

- **日期**：2026-07-31
- **Gate**：全部 Task 完成 + Reality Gate G1-G4 验证通过（掌柜指令启动）
- **原则**：不新建重复系统、复活已有 service、小步提交、每 Task 独立验证

---

## 执行摘要

> 不新建 Novel Intelligence Kernel——**复活 HDZ-NOVEL-INTELLIGENCE-01 已有内核，把断开的插头接上**。

审计发现 `story-context-builder.service.ts`（441 行，注入总纲/卷规划/角色状态/世界状态/一致性）和 `master-plan.service.ts` 均为**死服务**（0 引用），writer 模板 `$STORY_CONTEXT` 占位符从未注入。本次工程将其全部接通，并补齐总纲状态机、状态回写链、双入口统一。

---

## Phase 0 — P0 安全修复 ✅（攻击路径实测通过）

| Task | 修复 | 验证 |
|------|------|------|
| 00.1 PDF 下载鉴权 | `agent.ts:15` 删除 `/pdf/` 全局 bypass；PDF handler 加项目归属校验；前端 `<a>` 直跳改为 fetch blob + Bearer | 无 token → 401；A 访问 B 的 PDF → 404 ✅ |
| 00.2 screenplay 越权 | `POST /screenplay` + `GET /screenplay/:projectId` 补 `project.userId === user.id` | A 转 B 项目 → 404 ✅ |
| 00.3 资源级 IDOR（4 处） | manuscript PUT / character-state GET+DELETE / story-event DELETE 全部加 projectId 资源归属校验 | A 用自己的 projectId 改/删/读 B 的资源 → 404 ✅ |

**验证脚本**：`scripts/verify-hdz-phase0.js` / `phase0c.js`（真实 token + 真实跨用户数据）

---

## Phase 1 — 复活 Story Context 内核 ✅

**改动**：
- `writer.service.ts`：新增 `buildStoryContext(projectId, chapterNo)` 调用 + `formatStoryContextForLLM` 注入 `$STORY_CONTEXT` 变量（消除占位符泄漏）
- `story-context-builder.service.ts`：`formatStoryContextForLLM` 补上遗漏的 **worldState 输出段**（世界观现状/地点状态/时间线/未回收伏笔）

**验证**：真实项目「天外修仙录」→ StoryContext 输出 4855 字符，含总纲/卷规划/世界状态/角色状态/一致性警告，**零占位符泄漏** ✅

---

## Phase 2 — 文曲星小说规划流程 ✅

**改动**：
- `master-plan.ts`：新增**总纲状态机**——`POST /master-plan/confirm`（draft→confirmed）、`POST /master-plan/lock`（confirmed→locked）、`POST /master-plan/unlock`；generate 保存时默认 `status: draft`；每次状态变更记录修订历史
- `workspace/[id].vue`：
  - 修复 `loadMasterPlan` 解析 bug（`res.data.data.masterPlan`）
  - 新增状态徽章（📝草稿/✅已确认/🔒已锁定）+ 确认/锁定/解锁按钮
  - 新增**文曲星规划向导**对话框：类型/目标字数/总章节/卷数/故事创意 → 生成总纲 V1（≥3000 字）

**验证**：真实 API 全流程——confirm→lock→locked 后 confirm 拒绝→unlock→GET 状态 ✅；越权 confirm 404 ✅

---

## Phase 3 — 状态回写链 ✅

**发现并修复致命 bug**：`reviewer.service.ts:37` 把复合唯一键 `projectId_chapterNo` 用于 `findFirst` → PrismaClientValidationError → **审校任务必失败**（质量飞轮断裂）。已修复 + 顺手修复 reviewer prompt 变量缺 `$` 前缀（乱码问题）。

**改动**：
- `writer.service.ts`：`processChapterEvents`（事件提取→StoryEvent 落库→canAffectCharacter→evolveCharacterState→saveStateSnapshot）由同步阻塞改为 **setImmediate 异步执行**（写作不等待，2-4 分钟 LLM 链不再阻塞主流程）

**验证**：DB 层实测——saveStateSnapshot 落库 ✅、createEventsBatch 落库 ✅、测试数据清理 ✅；线上真实数据 StoryEvent=11、HdzCharacterState=63（回写链真实工作）

---

## Phase 4 — 统一双 AI 入口 ✅

**Task-04.1**：`worldbuilder.service.ts` 上下文数据包新增 `[小说总纲与状态]` 段（buildStoryContext + formatStoryContextForLLM）——文曲星回答必须读取总纲/当前剧情/人物状态/世界状态

**Task-04.2**：`chat.ts` 的 `/chat/send` 检测写作指令（「写第X章/写正文/续写/开始写」）→ 解析章节号（无号取下一章）→ 检查大纲（无大纲返回 need_outline 引导）→ **创建 writer 任务并同步走 writerService.execute（与按钮完全同一 pipeline）**→ 返回 `{type: 'chapter_written', wordCount, response}`；前端 chat 超时 180s→300s + 轮询兜底

**验证**：普通对话走 worldbuilder（回复正常）✅；「写第31章」（无大纲）→ need_outline ✅

---

## Phase 5 — Context 分层控制 Token ✅

- **永久上下文**：总纲（worldDirection/结局/禁则/伏笔）— 常驻
- **长期上下文**：当前卷规划（extractCurrentVolume 按 chapterNo 选卷，已实现）
- **短期上下文**：writer 已有金字塔记忆（批次小结 level 100/50/10/5 + 最近 5 章逐章摘要）
- **新增裁剪**：伏笔按兑现距离过滤（已回收 >100 章的省略）+ 上限 15 条，防 token 膨胀

---

## Reality Gate

| Gate | 结果 | 证据 |
|------|------|------|
| G1 小说创建 | ✅ | 「闲话三国」总纲 6122 字符 ≥3000；状态机 confirm/lock/unlock 实测通过（Phase 2） |
| G2 正文一致性 | ✅ | writer 注入 $STORY_CONTEXT + worldbuilder 注入 StoryContext + 对话写作指令走 writerService（三处代码路径同源） |
| G3 长篇状态 | ✅ | StoryEvent=11、HdzCharacterState=63 真实落库；回写链 DB 层实测通过 |
| G4 Prompt Reality | ✅ | 无 $STORY_CONTEXT 泄漏（Phase 1 实测输出零占位符） |

---

## 改动文件清单（11 个）

| 文件 | 改动 |
|------|------|
| `backend/src/routes/hdz/agent.ts` | PDF 鉴权 + screenplay 归属校验 |
| `backend/src/routes/hdz/manuscript.ts` | 章节 PUT 资源级归属 |
| `backend/src/routes/hdz/character-state.ts` | 角色状态 GET/DELETE 资源级归属 |
| `backend/src/routes/hdz/story-event.ts` | 事件 DELETE 资源级归属 |
| `backend/src/routes/hdz/master-plan.ts` | 总纲状态机（confirm/lock/unlock）+ draft 默认 |
| `backend/src/routes/hdz/chat.ts` | 写作指令统一 pipeline + leaderIds 字段修复 |
| `backend/src/services/hdz/writer.service.ts` | $STORY_CONTEXT 注入 + 回写链异步化 |
| `backend/src/services/hdz/story-context-builder.service.ts` | worldState 输出 + 伏笔裁剪 + currentChapterNo |
| `backend/src/services/hdz/worldbuilder.service.ts` | 对话注入小说总纲与状态 |
| `backend/src/services/hdz/reviewer.service.ts` | findFirst 复合键 bug + prompt 变量 $ 前缀 |
| `frontend/pages/hdz/workspace/[id].vue` | 总纲解析修复 + 状态徽章 + 向导 + PDF fetch blob + 长超时 |

**验证脚本**（保留为回归测试）：`backend/scripts/verify-hdz-phase0*.js/ts`、`phase1.ts`、`phase2.ts`、`phase3b.ts`、`phase4.ts`、`gates.ts`

---

## 剩余风险 / 下一步建议

1. **旧总纲无 status 字段**：存量项目 masterPlan 无状态，前端显示草稿、用户一键确认即迁移（不自动改用户数据）
2. **回写链 LLM 时长**：事件提取+角色演化 2-4 分钟（异步化后不阻塞写作），极端情况可考虑队列化
3. **未做（指令外）**：P0 审计项「orchestrator 186-188 审校审批流强制短路」仍在（continueChain 不合格章节标 reviewed + 事件谎称 user_approved）——建议下个 Sprint 修复
4. **配额**：主流程 LLM 调用仍未计费（审计 P1）——建议后续接入 incrementDailyUsage
5. **SSRF**：worldbuilder fetchUrlContent 未接 url-policy（审计 P1）

---

*Sprint-HDZNOVEL-INTELLIGENCE-01 完成。百万字小说宇宙的「总纲→确认→锁定→写作→回写」闭环已打通。*
