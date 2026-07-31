# Sprint-RECRUITMENT-CHANNEL-CENTER-01 招聘渠道中心（Phase 1）— COMPLETE ✅

**Date:** 2026-08-01 07:40
**Gate:** 掌柜渠道蓝图（添加渠道 = 授权 AI 招聘团队把岗位投放/同步/追踪到外部招聘生态，不做假渠道）

## 掌柜蓝图 → Phase 1 落地

> 渠道是整个招聘漏斗的入口：企业 → Alice 生成 JD → 发布 → 渠道分发 → 候选人进入昆仑镜 → AI 筛选/面试/评估 → 录用

**定位**：不是「招聘渠道管理」，是 **AI 招聘员工的外部人才入口层**。

## 架构（对齐 KMKI 渠道原则 = BYOK 类比）

| 层 | 交付 |
|----|------|
| 数据层 | `enterprise_candidate` 表（渠道候选人归企业 Organization）：organizationId + channelId + 技能/经历/期望薪资/状态 + aiAnalysis |
| API | `enterprise-channel-center.routes.ts`：overview 聚合统计 / import 手动导入 / candidates 列表 / PATCH 状态流转 |
| 前端 | `/workspace/enterprise/channels` 渠道中心页（招聘子导航新增） |

**候选人双轨语义**（避免污染招聘核心）：
- `candidate_match` = 平台用户 ↔ 岗位匹配（AI 匹配引擎产物，用户档案线）
- `enterprise_candidate` = 企业从渠道获得的候选人（渠道入口 → 昆仑镜 AI 筛选，归企业）

## 诚实状态（Reality 原则）

- 8 渠道（Boss/猎聘/智联/前程无忧/拉勾/脉脉/内推/校招）统一显示 **🟡 接入准备中**，绝不显示「已连接」
- 页面明示三阶段：① 接入准备中（当前）→ ② 真实 API 岗位同步 → ③ AI 招聘闭环
- 渠道定位文案内置（Boss=大量招聘·岗位同步 / 猎聘=中高级猎取·AI猎头 / 智联=校招·大规模）
- AI 评价真实生成：企业配置模型 → 真实 LLM 输出；未配置/失败 → null 显示「未生成」（不假装）

## 验收（浏览器生产域实测）

| 场景 | 结果 |
|------|------|
| 渠道中心页渲染 | 8 渠道卡片 + 定位 + 🟡 接入准备中 ✅ |
| 渠道统计 | 发布岗位/收到候选/AI筛选/转化率 四格真实聚合 ✅ |
| UI 导入候选人 | 点击 → 弹窗 → 填表（5 字段+简介）→ 提交 → 列表新增 ✅ |
| AI 评价 | 张三/李四均真实 LLM 生成（Java 栈 / Python 栈各一段）✅ |
| 状态流转 | 李四 new → screening（「开始筛选」按钮 PATCH）✅ |
| 候选人数据 | `enterprise_candidate` 2 条（验收导入数据，非 mock）✅ |

截图：`RECRUITMENT-CHANNEL-CENTER-01-{channel-center,candidates}.png`

## 冻结清单（持续）

❌ 假渠道状态（无真实 API 不显示已连接）  ❌ 平台保存渠道账号 Token
⏸ Phase 2 前置：Boss Open API / 猎聘企业 API / 智联 API 商务接入（需真实授权能力）

## 下一步（掌柜顺序）

Phase 2（真实 API 岗位同步）需先确认：① 企业侧是否有对应平台企业账号 ② 平台 API 资质/商务。在此之前渠道中心保持 Phase 1 状态，AI 员工能力（Alice 曝光分析建议 / Carol 渠道人才质量分析）可先行接入现有 agent 体系。
