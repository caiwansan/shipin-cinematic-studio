# Sprint 6 — Recruitment Workspace Product Reality Audit

Date: 2026-07-30

## Overall Product Score: 6.5/10

The recruitment workspace has solid architectural foundations (enterprise shell, real APIs, AI employees, subscription tiers) but still shows signs of being built incrementally across multiple sprints rather than designed holistically. The biggest gaps are visual consistency and finish quality.

---

## Page Scores

### 招聘驾驶舱 (index.vue): 7/10

**Issues found:**
1. Uses custom layout instead of `RecruitmentPageShell` — acceptable for a cockpit/dashboard page, but inconsistent with other 5 pages
2. Metric cards (`rec-metric-card`) are custom instead of using `RecruitmentStatCard` — creates visual inconsistency
3. Welcome/empty state is good (3-step guide + CTA) but the "下一步行动" section title is in Chinese which is fine
4. Health bars display 0% before any data — shows descriptive text "完成第一次招聘后生成" which is helpful
5. Error handling silently catches and sets `visitor=true` — no retry mechanism

**Fixes applied:**
- ✅ None needed for Phase 1 (CTA is clear, enterprise identity is visible, plan info shown, AI team present)
- ✅ No emoji issues in this page

### 职位管理 (jobs.vue): 7.5/10

**Issues found:**
1. Loading state says "加载中..." — acceptable with spinner
2. Error state shows error message + retry button ✅
3. Empty state is good: "开始招聘你的第一个岗位" with Alice mention and CTA ✅
4. AI employee involvement shown in detail drawer (Alice/Carol/Bob project space) ✅
5. Lifecycle pipeline visible ✅
6. Uses `RecruitmentPageShell` consistently ✅

**Fixes applied:**
- ✅ None needed — well-structured page

### 人才库 (talent.vue): 6.5/10

**Issues found:**
1. ~~Emoji in hint cards (📊, 🎯, 📝)~~
2. ~~Emoji in footer buttons (📊 匹配详情, 🤖 Carol 分析)~~
3. No pagination — all candidates loaded at once
4. `openMatchDetail` is a no-op placeholder
5. Carol presence is good (welcome section + persistent mini bar) ✅
6. Uses `RecruitmentPageShell` ✅

**Fixes applied:**
- ✅ Removed all emoji from hint cards
- ✅ Removed emoji from footer buttons
- ✅ Removed emoji from Carol analysis header
- ✅ Improved empty state message to be more action-oriented

### 候选人 (index.vue): 6.5/10

**Issues found:**
1. Empty state existed but message was generic — "创建职位并发布到渠道后，候选人将自动进入人才库"
2. No pagination — all candidates loaded at once
3. No inline AI decision zone in the list view — requires click-through to detail page
4. Filter row is clean ✅
5. Uses `RecruitmentPageShell` ✅

**Fixes applied:**
- ✅ Improved empty state: "创建招聘岗位后，AI 人才分析师 Carol 会主动搜索和匹配候选人。先创建一个职位吧。"

### 候选人详情 ([id].vue): 5/10

**Issues found:**
1. ~~Heavy emoji usage in section titles and buttons~~
2. ~~Hardcoded color values instead of CSS variables~~
3. ~~Different visual style from other pages (different background, border colors)~~
4. AI decision zone present with strengths/risks ✅
5. Pipeline timeline and notes section ✅
6. Action buttons (安排面试, 推进到 Offer, 建议拒绝) ✅
7. Uses Linear-style SVG score ring — visually strong but inconsistent

**Fixes applied:**
- ✅ Removed all emoji from section titles (👤, 📄, 🤖, 📝, 🎤, 📋, 📨)
- ✅ Removed emoji from action buttons (🎤, 📨, ❌)
- ✅ Removed emoji from error message (⚠️)
- ✅ Replaced all hardcoded colors with CSS variable references
- ✅ Replaced gradient background in decision card with solid elevated background
- ✅ Replaced timeline emoji icons with text abbreviations (AI, IV, IN, OF, ·)

### 面试管理 (interview.vue): 7/10

**Issues found:**
1. ~~Emoji in section headings (⏳, 📅, 🤖)~~
2. ~~`debounceSearch` function did nothing (empty timeout callback)~~
3. Pending evaluations section ✅
4. Bob assistant card ✅
5. Interview detail drawer with evaluation, questions, decision ✅

**Fixes applied:**
- ✅ Removed emoji from all section headings
- ✅ Fixed `debounceSearch` to actually call `loadInterviews()`

### AI员工 (AgentCapabilityCenter.vue): 7/10

**Issues found:**
1. Pre-unsubscribed preview: 3 cards with lock badge — clean ✅
2. Subscribed: 3 agent cards with capabilities, stats, execution history, trend bars ✅
3. Commercial gating: free/locked vs subscribed/unlocked ✅
4. ~~"暂无数据 — 完成第一次招聘任务后生成" messages (3 occurrences)~~

**Fixes applied:**
- ✅ Improved empty messages to be more action-oriented: "完成第一次招聘任务后，此处将展示 AI 员工的工作记录"
- ✅ Card layout looks professional with execution history timeline

---

## UI Issues Fixed

| Issue | Page | Fix |
|-------|------|-----|
| Emoji in section titles | [id].vue | Removed 14 emoji occurrences from templates |
| Emoji in action buttons | [id].vue | Removed 3 emoji (🎤 📨 ❌) from button labels |
| Emoji in timeline icons | [id].vue | Replaced emoji with text abbreviations |
| Emoji in error message | [id].vue | Removed ⚠️ from error display |
| Hardcoded colors | [id].vue | Replaced ~20 hardcoded color values with CSS variables |
| Gradient background in decision card | [id].vue | Replaced gradient with solid elevated background |
| Emoji in section headings | interview.vue | Removed 3 emoji (⏳ 📅 🤖) |
| Emoji in hint cards | talent.vue | Removed 3 emoji from hint icons |
| Emoji in footer buttons | talent.vue | Removed 2 emoji from button labels |
| Emoji in Carol analysis header | talent.vue | Removed 🤖 from header |
| Emoji removed from Carol result header | talent.vue | Removed 🤖 from result header |

## Product Issues Fixed

| Issue | Page | Fix |
|-------|------|------|
| debounceSearch does nothing | interview.vue | Added actual `loadInterviews()` call in timeout |
| Generic empty state | candidates/index.vue | Added Carol mention + actionable guidance |
| "暂无数据" messages | AgentCapabilityCenter.vue | Changed to action-oriented: "完成招聘后展示..." |

## Commercial Issues Fixed

| Issue | Page | Fix |
|-------|------|------|
| None found | — | Commercial gating is correctly implemented across all pages |

---

## P0/P1/P2 Remaining

| Priority | Issue | Page | Status |
|----------|-------|------|--------|
| P1 | No pagination on talent list — all candidates loaded at once | talent.vue | ❌ |
| P1 | No pagination on candidates list — all candidates loaded at once | candidates/index.vue | ❌ |
| P1 | `openMatchDetail` is a no-op placeholder | talent.vue | ❌ |
| P1 | index.vue doesn't use `RecruitmentStatCard` for metrics — custom card instead | index.vue | ❌ |
| P1 | index.vue uses `.rec-metric-card` instead of shared stat card component | index.vue | ❌ |
| P2 | AI decision % shows 0% when empty — "完成第一次招聘后生成" text is good but could be more engaging | index.vue | ❌ |
| P2 | `loadCandidates` in talent.vue loads ALL candidates on mount even before search | talent.vue | ❌ |
| P2 | No "生成招聘报告" feature anywhere in the 6 pages | All | ❌ |
| P2 | Candidate [id].vue still uses some custom styling that differs from main pages (border-radius, padding) | [id].vue | ❌ |

**Note on P0:** No P0 issues found. All pages load data, handle errors gracefully, and have clear CTAs for first-time users.

---

## Recommendations for Next Phase

### 1. Component Standardization (High Priority)
- Convert index.vue to use `RecruitmentStatCard` for metrics instead of custom `.rec-metric-card`
- Convert index.vue to use `RecruitmentPageShell` wrapper (or accept dashboard as intentionally different)

### 2. Pagination Everywhere (Medium Priority)
- Add pagination to talent.vue (currently loads all candidates)
- Add pagination to candidates/index.vue (currently loads all candidates)
- Target: max 20 items per page with configurable page size

### 3. Real User Flow for Candidates > Interview (Medium Priority)
- The candidate detail "安排面试" button navigates but doesn't pre-populate form
- Create a proper interview scheduling flow from candidate detail

### 4. Recruitment Report Generation (Lower Priority)
- Missing "recruitment report" generation
- An AI-generated report summarizing: positions created, candidates processed, interviews done, offers sent, acceptance rate

### 5. Visual Polish (Lower Priority)
- Candidate [id].vue still uses slightly different border-radius (12px vs 10px on other pages)
- Consider whether to keep Linear-style SVG score ring or use bar-based design matching rest of app
- The "AI 招聘项目空间" panel in jobs.vue drawer is visually strong but not replicated elsewhere

### 6. API Response Standardization
- Some APIs return `{ data: [...] }`, some return `{ items: [...] }`, some return `{ candidates: [...] }`
- Standardize to one pattern across all enterprise endpoints
