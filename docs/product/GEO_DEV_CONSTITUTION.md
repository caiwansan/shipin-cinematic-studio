
# GEO Development Constitution（2026-07-01 生效）

> 所有 GEO Workspace 开发任务必须遵守以下原则。违反任意一条将导致 Sprint 不予验收。

## 1. UI First（默认原则）
除纯基础设施（Prisma Migration、安全修复、性能优化）外，每个 Sprint **必须** 包含至少一个用户可见的前端变化。
- 新的 Workspace Block / 图表 / 操作流程 / 卡片 / 向导 / 交互 / Dashboard 信息
- 不能只有 `Service + API + Repository + Build PASS`

## 2. Every Backend Capability Must Have a UI
任何新增能力都必须回答：**用户在哪里看到它？**
- Opportunity Engine → Opportunity Card
- Verification Engine → Verification Dashboard
- Action Plan Engine → Action Panel
- Publishing → Publishing Center
- 如果没有对应 UI，该功能默认不能算完成

## 3. Workspace First
优先优化 `/workspace/geo/*`。
Workspace 是用户每天使用的地方，后台管理管理员偶尔使用。

## 4. Sprint 必须包含 Demo Changes
每个 Sprint 的 TASK_RESULT 必须包含：
```
Backend           ✅
Frontend          ✅
User Visible      ✅
Demo Script       ✅
```
以及 `What can users see now?` 说明。

## 5. 禁止 Invisible Feature
如果 Sprint 产出是：
```
新增：10 个 Service、6 个 DTO、4 个 Repository
但是：Workspace 没有变化
```
→ 不予验收。用户完全感觉不到升级。

## 6. Workspace = Product
所有 GEO 能力必须最终体现在 Workspace 中。禁止出现：
- Repository / Service / API 都有 → Workspace 没有入口
- 功能存在 → 需要 Postman 才能使用

## 7. Sprint 默认执行模式
```
Phase 1: Backend
Phase 2: API
Phase 3: Workspace UI
Phase 4: Build
Phase 5: Deploy
Phase 6: Demo Verification
```
而不是：Backend → Build → Commit

## 默认开发规范（Default Engineering Policy）
> **GEO Workspace 的所有新功能必须遵循"UI 可见、流程可达、用户可操作"的原则。除基础设施类任务外，每个 Sprint 默认应包含可见的 Workspace UI 变化，并明确说明普通用户现在能看到什么、如何使用、为什么值得使用。任何新增后端能力都应在 `/workspace/geo` 中提供对应入口、展示或交互；仅有后端实现而无前端体现的功能，默认视为未完成产品集成。**
