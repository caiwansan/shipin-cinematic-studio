# GEO Recovery Sprint 1 — 执行令

**生效日期**: 2026-07-27
**目标**: 7 天内将 GEO Workspace 从"演示系统"变成"可上线产品"
**North Star**: 全新用户创建品牌后，3 分钟内完成第一次成功体验

## 铁律
1. 禁止开发任何新功能
2. 禁止新增任何页面
3. 禁止新增任何 Engine
4. 禁止新增任何 Prisma Model
5. 禁止新增任何 Runtime 概念
6. 禁止讨论架构优化
7. 唯一工作：把已经存在的能力全部组装、串联、打通

## Sprint 任务

### P0-1 ✅ — 打通 Golden Path
`createProject` 改为 6 步自动执行：Project → BrandSetting → Workspace → ScoreSnapshot → Timeline → Mission
所有非致命失败都 try/catch，不影响项目创建

### P0-2 ✅ — 移除 Dashboard Memory Truth
`mission-control.ts` 不再引用任何 in-memory store（ObservatoryStore, MissionQueue, VerificationQueue, PublishingQueue, LearningStore 全部移除）

### P0-3 ✅ — 统一 API Contract
`shared/dto/mission-control.dto.ts` 建立为唯一 DTO，前后端都从此文件 import
后端废弃 `MissionControlResponse`，前端 service 改用共享 DTO

### P0-4 ✅ — 删除旧 Dashboard
删除 `GEODashboard-full.vue`、`GEODashboard.page-shell.vue`、`GEODashboard.vue`
`dashboard.vue` 为唯一 Dashboard 入口，包含 Runtime Health Gate + Next Action + 产品层命名

### P0-5 ✅ — 建立 Runtime Health Gate
Dashboard 显示三种状态：
- `uninitialized`: "尚未创建项目，请先创建一个品牌"
- `initializing`: "系统正在初始化，请稍后刷新"
- `healthy`: 显示完整 Dashboard

### P0-6 ✅ — 统一 Dashboard Truth
`mission-control.repository.ts` 建立为 SSOT，封装所有 Dashboard DB 查询
`mission-control.ts` 只调这一个 repository

## Reality Gate
待验证。生产环境不可删库，需要测试环境或手动创建品牌验证。
验证流程：
1. 清空 GEO 相关表（gEOProject, gEOScoreSnapshot 等）
2. 重启 API 服务
3. 创建品牌
4. 检查 Dashboard 是否：显示品牌名称、显示健康评分（可能为 0）、显示 Next Action、无技术术语

## 提交规范
- `16ee686 P0-1 Complete` — 包含 P0-1 到 P0-6

## 最终 Release Gate
全新数据库 → 创建品牌 → 自动初始化 → Dashboard 显示真实数据
无技术术语暴露，无 Mock/默认值冒充数据
