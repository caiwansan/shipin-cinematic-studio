# WORKBENCH-HARDENING-01 Phase 1

## 执行日期
2026-07-22

## 执行身份
昆仑镜第三方 CTO + Security Architect — Architecture Governance

---

## 一、URL Hardening 结果

### 结论：✅ 无需修正，目标文件已合规

扫描范围：
- `frontend/studio-v2/workspace/director-workbench/composables/useRuntimeBinding.ts`
- `frontend/studio-v2/workspace/director-workbench/stores/director-replay-store.ts`

| 文件 | 状态 | 详情 |
|------|------|------|
| `useRuntimeBinding.ts` | ✅ 已合规 | `const API_BASE = '/api/workbench'` — 纯相对路径 |
| `director-replay-store.ts` | ✅ 已合规 | `EventSource('/api/workbench/replay/stream/${tid}')` — 纯相对路径 |

### 环境无关性验证
```
development  → localhost        → /api/workbench → Nginx → api-server
staging      → staging 域名     → /api/workbench → Nginx → api-server
production   → aigc.fushtn.com → /api/workbench → Nginx → api-server
```
三套环境共用同一套代码，无环境分支。

### Nginx Boundary 确认
浏览器仅发出 `/api/workbench/*` 相对路径请求，必须经过 Nginx 代理转发。不存在 `https://aigc.fushtn.com/api/workbench` 硬编码绕开网关的风险。

---

## 二、Brand Alignment 结果

### 修正清单

| 文件 | 字段 | Before | After |
|------|------|--------|-------|
| `frontend/package.json` | name | `"shipin-frontend"` | `"kunlun-frontend"` |
| `backend/package.json` | name | `"scs-backend"` | `"kunlun-backend"` |
| `frontend/nuxt.config.ts` | title | `"昆仑镜 - AI 短剧制作平台"` | `"昆仑镜 AI工具系统"` |
| `frontend/nuxt.config.ts` | og:title | `"昆仑镜 - AI 短剧制作平台"` | `"昆仑镜 AI工具系统"` |
| `frontend/nuxt.config.ts` | description | `"从剧本到成片，AI 全自动完成短剧制作..."` | `"昆仑镜 AI 工具系统 — 面向 AI 创作与智能办公的工作台集合..."` |
| `frontend/nuxt.config.ts` | og:description | `"输入一个故事，AI 自动生成一部好剧..."` | `"昆仑镜 AI 工具系统，让 AI 创作与智能办公一体化。"` |
| `frontend/nuxt.lowmem.config.ts` | title | `"昆仑镜 - AI 短剧制作平台"` | `"昆仑镜 AI工具系统"` |
| `frontend/nuxt.lowmem.config.ts` | og:title | `"昆仑镜 - AI 短剧制作平台"` | `"昆仑镜 AI工具系统"` |
| `frontend/nuxt.lowmem.config.ts` | description | `"从剧本到成片..."` | `"昆仑镜 AI 工具系统 — 面向 AI 创作与智能办公的工作台集合。"` |

### 残留说明（不在 Scope 内，不修改）

以下文件仍含旧品牌引用，但属于 Scope 之外或历史文档：

| 文件 | 内容 | 处置理由 |
|------|------|----------|
| `docs/production-readiness-report.md:4` | `"昆仑镜 AI 短剧制作平台 (aigc.fushtn.com)"` | 历史审计纪要，保留真实性 |
| `backend/audit/SECURITY-CLOSURE-REPORT-2026-06-26.md:4` | `"昆仑镜 AI 短剧制作平台"` | 历史安全报告，保留真实性 |
| `reports/third-party-audit-20260531.md:11` | `"大型 AI 短剧制作平台"` | 历史三方审计报告，保留真实性 |
| `reports/BETA-06.6.2-PRODUCTION-SURFACE-VERIFICATION.md:104` | `"<title>昆仑镜 - AI 短剧制作平台</title>"` | Snaphots 引用的历史 HTML 片段，保留真实性 |

---

## 三、Verification

| 检查项 | 结果 |
|--------|------|
| git diff 确认（9 处核心文件） | ✅ 全部符合预期 |
| 旧品牌字符串残留扫描 | ✅ 9 处核心引用全部清除 |
| 环境无关性确认 | ✅ 无环境分支，纯相对路径 |
| JSON 语法校验 | ✅ package.json 有效 |

---

## 四、Risk Remaining（Phase 1 不修复，等待后续阶段）

| 编号 | 风险 | 目标阶段 |
|------|------|----------|
| R-1 | Mock Runtime（LocalMockRenderer 仍在生产链路） | Phase 2: RenderAdapter Isolation |
| R-2 | 任务状态内存存储（mockJobs Map，重启丢失） | Phase 3: Task Persistence |
| R-3 | 假视频 URL 输出（https://mock.video/*.mp4） | Phase 3: Outcome Reality |
| R-4 | 真实 Production RenderAdapter 未接入 | Phase 4（独立 ticket） |

---

## 五、Gate — 等待 CTO Review

**WORKBENCH-PHASE1 执行完成。进入 Review Gate。**

待 CTO 批准通过后，解锁：

```
Phase 2: RenderAdapter Isolation
├── 禁止生产环境 new LocalMockRenderer()
├── 建立 RenderAdapter Interface
├── MockRenderAdapter 仅允许 NODE_ENV=test/dev
└── StubRenderAdapter 处理过渡期 FAIL FAST
```

---

*Report generated: 2026-07-22 by OpenClaw (CTO Context)*
*Messaged via QQ to requesting executive*
