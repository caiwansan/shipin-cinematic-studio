# SHORTDRAMA-PHASE6-SECURITY-REALITY — 短剧工作台安全隔离 Reality Test

- Sprint: ShortDrama-Reality-Recovery-Phase6
- 日期: 2026-07-31
- 目标: 短剧工作台安全止血（local-file / 权限隔离 / 身份安全 / 配额 Gate）
- 隔离原则: 只改短剧专属文件；共享文件修改前先输出 Shared Boundary Change Proposal

---

## 1. 修改文件列表

### 新增（短剧安全组件）
| 文件 | 说明 |
|------|------|
| `backend/src/services/director/project-ownership.service.ts` | 统一 `verifyProjectOwner()` — 唯一权限源，禁止各 route 复制权限代码 |

### 修改（短剧专属路由，7 文件）
| 文件 | 改动 |
|------|------|
| `backend/src/routes/workbench-project.ts` | local-file 加固（authenticate + basename + UUID 白名单 + 固定目录 + 防穿越）；6 个 :id 端点加归属校验（GET/PUT/DELETE/save-image/save-video/clear-analysis） |
| `backend/src/routes/aigc-spec-db.ts` | save/load 加归属校验（2 端点） |
| `backend/src/routes/project-segment-state.ts` | GET/POST 段状态加归属校验（2 端点） |
| `backend/src/routes/ai-tasks.ts` | ai-generate/status/result/batch-create 归属校验；**并发 Gate（≤20 queued/processing）**；batch 数量上限检查 |
| `backend/src/routes/execution-images.ts` | 19 处归属校验（GET/PUT/POST/DELETE/migrate/refresh/generate-prop-image）；proxy 加 authenticate（保留 SSRF 防护） |
| `backend/src/routes/script-submit.ts` | 3 端点加 authenticate；**移除 base64 decode JWT / body.userId / projectId 反查身份**；userId 只从认证取；projectId 持久化/反查剧本前归属校验 |
| `backend/src/routes/script-breakdown.ts` | 4 端点加 authenticate（@deprecated 标记，前端 0 生产引用）；userId 只从认证取；列表只返回自己的；记录归属校验 |
| `backend/src/routes/projects-v2.ts` | 7 端点加 authenticate（@deprecated 标记，前后端 0 引用）；列表强制自己的项目；:id 端点归属校验 |

### 共享文件 — 等待掌柜确认（见 §4）
| 文件 | 状态 |
|------|------|
| `backend/src/routes/projects.ts`（短剧+GEO+通用用户页共享） | ⏸ Shared Boundary Change Proposal 已输出，等批准 |

---

## 2. 影响范围分析

### 已修改文件均为短剧生产链专属
- **script-submit**：唯一调用方 = `frontend/studio-v2/workspace/script-analysis/ScriptAnalysisWorkspace.vue`（求职/广告/音乐 workspace 0 引用）→ 直接改，无需拆 adapter
- **execution-images / aigc-spec / segment-state / ai-tasks**：调用方全部在 `frontend/studio-v2`（短剧工作台）
- **script-breakdown / projects-v2**：前后端 0 生产引用（遗留路由）→ 只加固不删除
- **project-ownership.service.ts**：新建，只被短剧路由 import；不改任何共享 service/repository

### 明确未修改（隔离原则）
- Enterprise / Career / GEO / Legal / Music / Advertisement Workspace：**0 改动**
- Hermes Runtime / ModelSettings / BYOK 核心：**0 改动**
- authenticate 中间件（`plugins/auth.ts`）：**0 改动**（只在其下新增路由接入）
- narrativeGateway / Task Runtime / BullMQ / Provider：**0 改动**
- projectService（共享 repository）：**0 改动**（归属校验全部在路由层）

---

## 3. 其他 Workspace 验证结果

| Workspace | 验证 | 结果 |
|-----------|------|------|
| GEO | `/api/projects/:id/hydrate` 未被本次修改触及（projects.ts 待确认）| ✅ 不受影响 |
| 通用用户页 | `/api/projects` GET 列表已有 `findAll(user.id)` 过滤，未动 | ✅ 不受影响 |
| Enterprise/Career | 无任何共享文件被改 | ✅ 不受影响 |
| 前端 studio-v2 全量 build | `nuxt build` complete | ✅ 无回归 |
| 后端启动 | PM2 api-server 编译干净（0 TransformError）| ✅ |

---

## 4. Shared Boundary Change Proposal（等待掌柜确认）

**文件：`projects.ts`（/api/projects/*）** — 9 个 :id 端点无归属检查（GET/PUT/DELETE/:id、save-specs、hydrate、execution-results×2、assets×2）

- 调用方：短剧（useStudioStore /assets、save-specs）+ **GEO**（useGeoHydrate /hydrate）+ 通用用户页（列表，已有过滤）
- 影响：GEO 项目均有 userId（实测 9 项目/2 用户，全为创建者本人，无共享证据）→ 加 `verifyProjectOwner` 后 GEO 用户访问自己项目不受影响
- 拟定：9 端点统一插入归属校验，projectService 不改
- **状态：⏸ 等掌柜批准后执行；未批准则维持现状（短剧链风险由前端项目创建流程隔离）**

---

## 5. Reality Gate S1-S6

| Gate | 验证项 | 结果 |
|------|--------|------|
| **S1** local-file 安全 | 认证+合法 UUID 文件 → 200；`../../etc/passwd` → 400/404；非 UUID → 400；未登录 → 401；静态 /uploads/、/api/v1/uploads/ 不受影响 → 200 | ✅ PASS |
| **S2** 项目权限隔离 | 自己的项目 GET/load/segments → 200；User A 访问 User B（workbench/aigc-spec/execution-images/PUT/DELETE/段状态 save）→ 全部 403；未登录 → 401 | ✅ PASS |
| **S3** script-submit 身份安全 | 无 token → 401；无 token+伪造 body.userId → 401；有 token+伪造 userId → 200（认证身份生效）；越权 projectId → 403"无权访问该项目"；真实小剧本分析链 → success（1 segment/1 character，46s 真人生成） | ✅ PASS |
| **S4** AI Task 配额 Gate | 正常 image/video 任务提交 → 200；非法 taskType "hack" → 400 拒绝；batch 21 个 → 429 拒绝；batch 5 个合法 → 200 | ✅ PASS |
| **S5** 真人路径端到端 | 登录 → 剧本分析（script/submit 真实 LLM）→ 角色/场景规格 save（200）→ 图片任务提交（200 queued）→ 视频任务提交（200 queued） | ✅ PASS |
| **S6** 攻击路径全拒 | 未登录请求 → 401；越权 projectId（读/写/删）→ 403；路径穿越 → 400/404；伪造 userId → 认证身份覆盖（无效）；批量刷队列 → 429 | ✅ PASS |

---

## 6. 测试数据清理
- VideoTask 测试任务：全部删除（DELETE 1 + DELETE 10 + DELETE 43）
- ai_character_specs 测试角色"阿福"：已删除（DELETE 1，count=0 确认）
- 未触碰 Demo Project / 真实用户数据

## 7. 未完成 / 待办
- ⏸ projects.ts 归属校验（Shared Boundary Change Proposal 等掌柜批准）
- 已完成本 Sprint 全部 Task；**停止，不进入下一 Sprint**
