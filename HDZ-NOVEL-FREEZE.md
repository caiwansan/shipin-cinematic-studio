# HDZ-NOVEL-INTELLIGENCE-01/02 FREEZE

## 冻结日期: 2026-07-21
## 冻结版本: INT-01 v2, INT-02 v1（含 Freeze Patch-01/02）

---

## 冻结模块清单

### 数据库 Schema

| 表/字段 | 操作 | 说明 |
|---------|------|------|
| `HdzProject.masterPlan` | 冻结 | JSONB，小说总规划 |
| `HdzProject.masterPlanVersion` | 冻结 | INT，当前版本号 |
| `HdzPlanRevision` | 冻结 | 修订历史表，含 planBefore/planAfter |
| `HdzCharacterState` | 冻结 | 角色状态时间线，8 种状态类型 |

**禁止**: 新增表、新增列（除非必要的高优先级 bug fix）

### Backend Service

| 文件 | 操作 | 说明 |
|------|------|------|
| `story-context-builder.service.ts` | 冻结 | StoryContext 构建器 |
| `writer.service.ts` ($STORY_CONTEXT) | 冻结 | 章节生成上下文注入 |

### API Routes

| 路由 | 操作 |
|------|------|
| `/api/hdz/projects/:id/master-plan` (GET/PUT) | 冻结 |
| `/api/hdz/projects/:id/master-plan/revisions` (GET) | 冻结 |
| `/api/hdz/projects/:id/master-plan/generate` (POST) | 冻结（含质量检查+重试） |
| `/api/hdz/projects/:id/character-states` (GET/POST) | 冻结 |
| `/api/hdz/projects/:id/character-profiles` (GET) | 冻结 |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `pages/hdz/workspace/[id].vue` (novel-planning tab) | 冻结 | Master Plan 编辑器/预览 |
| `pages/hdz/workspace/[id].vue` (character-state tab) | 冻结 | 角色状态面板/时间线 |

---

## 已验证功能 Matrix

| 功能 | 状态 | 备注 |
|------|------|------|
| AI 生成 1000 章总规划 | ✅ | 5 卷/伏笔/禁条/世界观 |
| 规划版本控制 | ✅ | v1→v2，revision 记录完整 |
| LLM 上下文注入 | ✅ | 总规划+当前卷+角色状态 |
| 角色状态时间线 | ✅ | INJURY/RECOVERY/POWER 等 8 类型 |
| 状态自动闭环 | ✅ | RECOVERY 自动标记 INJURY 已解决 |
| 用户可编辑控制 | ✅ | JSON 编辑器 + 原因记录 |
| Master Plan 质量检查 | ✅ | 3 次重试，最低 3000 字 |
| 鉴权 | ✅ | JWT + tokenVersion 检查 |

---

## 已知限制（非 Bug）

1. **diffSummary 为 null**: PlanRevision 只存快照，不做文本 diff
2. **LLM 截断**: maxTokens=12000 时偶尔截断，质量检查触发重试
3. **RECOVERY 类型**: 不在 8 种 currentState 类型中，仅作为 INJURY 解决标记

---

## 下一阶段：HDZ-NOVEL-PRODUCTION-GATE-01

目标：验证商业可用性（用户能否真正写完一本书）

建议优先级：
1. **P0 章节生产流水线**: 卷规划→章节大纲→生成→审核→修改→发布
2. **P1 章节状态仪表盘**: 总进度/当前卷/人物状态/伏笔追踪
3. **P2 世界状态系统**: PhaseX 增强层

冻结模块入口点（用于 Production-Gate-01）：
- `buildStoryContext(projectId, chapterNo)` → 获取完整 StoryContext
- `formatStoryContextForLLM(ctx)` → 格式化为 LLM 可消费的文本
- `POST /master-plan/generate` → 生成/重新生成规划
- `PUT /master-plan` → 编辑规划
- `GET /character-profiles` → 获取角色当前状态

---

*此文档作为冻结点，任何对冻结模块的修改需经 CTO 审批。*
