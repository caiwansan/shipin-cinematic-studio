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

### P0-1 — 打通 Golden Path
创建品牌后自动触发：Discovery → ScoreSnapshot → Timeline → Mission → Dashboard

### P0-2 — 移除 Dashboard Memory Truth
Dashboard 只从 MissionControlRepository 读 ScoreSnapshot，禁止读任何 in-memory store

### P0-3 — 统一 API Contract
删除前后端独立 DTO，建立 shared/dto/，整个工程只允许一份

### P0-4 — 删除旧 Dashboard
保留 GEODashboard.page-shell.vue，删除 GEODashboard-full.vue 和所有 .bak

### P0-5 — 建立 Runtime Health Gate
Dashboard 区分"没有数据"和"Runtime 未初始化"

### P0-6 — 统一 Dashboard Truth
建立 MissionControlRepository 作为唯一入口

## Reality Gate
每完成一个 P0：删库 → 重启 → 创建品牌 → 检查全链路
任何步骤失败 → 立即修复，禁止继续开发

## 提交规范
每次提交只允许一个任务，格式：`P0-X Complete`
Commit body 包含 Reality Gate 结果

## 最终 Release Gate
全新数据库 → 创建品牌 → 自动初始化 → Dashboard 显示真实数据
无技术术语暴露，无 Mock/默认值冒充数据
