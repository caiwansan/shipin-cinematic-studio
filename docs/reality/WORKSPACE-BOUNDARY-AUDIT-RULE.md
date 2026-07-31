# Workspace Boundary Audit Rule — 跨 Workspace Runtime Impact 审计规范

**建立日期:** 2026-08-01
**建立背景:** Sprint-RECRUITMENT-REALITY-06 故障报告中，Runtime 全局健康检查结果与招聘业务审计混报，导致判断污染。
**状态:** 生效中（所有 Reality Audit / 故障报告必须遵守）

---

## 1. 核心原则

> **运行环境审计 ≠ 业务审计。两个层级必须分开报告。**

api-server 是共享后端（招聘 / 小说 / 短剧 / 图片素材 / 平台治理 共用），任何模块的编译错误、运行噪音都可能出现在全局日志中，**不代表任何特定业务域有问题**。

---

## 2. 强制报告格式

所有 Reality Audit / 故障排查报告，输出必须分区：

```
业务域：
<Recruitment | ShortDrama | Novel | Platform | ...>

A. 本业务域结论
   ✅ / ❌ <结论 + 证据>

B. 直接影响（本业务域可观测的影响）
   <页面 / API / 数据 / 用户影响>

C. 共享依赖（跨域共用组件）
   <api-server / nuxt-frontend / nginx / 数据库 / Prisma / 队列>

D. 其他 Workspace 异常（隔离记录，仅备注）
   ℹ️ <短剧线历史错误等，明确标注「不影响本次结论」>

E. 是否阻断
   Yes / No + 原因
```

---

## 3. 故障分类判定表

| 现象 | 分类 | 归属 |
|------|------|------|
| 页面白屏、JS/CSS 404/500 | 前端发布运维 | 构建产物与运行进程版本不一致 → 重启进程即可，与业务代码无关 |
| api-server 编译失败崩溃 | 共享服务部署 | Platform Runtime Fix，需立即 commit 入库防回退 |
| 单模块业务报错（如 HDZ writer） | 业务噪音 | 独立业务域问题，隔离记录，不混入其他 Sprint |
| DB / 网络 / 证书 故障 | 基础设施 | 全局影响，单独报告 |
| 路由 404 / 参数错误 / 权限 | 业务代码 | 归入对应业务域审计 |

---

## 4. 修复入库规则

- 线上已运行但未 commit 的稳定性修复 → **立即单独 commit**（不混入业务 commit）
- Commit message 前缀：`fix(runtime):` = Platform Runtime Fix；`fix(recruitment):` = 招聘业务；`fix(hdz):` = 短剧业务
- 禁止把 Runtime Fix 包装成业务修复，反之亦然

---

## 5. 触发条件

以下场景**必须**套用本规则：
1. 跨业务域故障排查（如"后台打不开"）
2. 任何 Reality Audit 报告
3. 崩溃循环 / 重启风暴 / 全局日志扫描

---

## 6. 本次案例（参考模板）

```
业务域：Recruitment
A. 招聘业务结论：✅ PASS（页面/API/DB 均正常）
B. 直接影响：前端 5 个页面白屏 → 已通过重启 nuxt-frontend 恢复
C. 共享依赖：api-server（曾编译失败 486 次重启，已修复并 commit 01d1334f）
D. 其他 Workspace 异常：ℹ️ 短剧线 HDZ 历史错误（prevNotes/prisma is not defined/pipelineStage UUID），不影响招聘结论
E. 是否阻断：No
```
