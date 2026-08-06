# KUNLUN-BETA0.1-DEMO.md

> 昆仑镜 AI OS Beta 0.1 — 销售演示流程（客户故事版）
> 日期: 2026-08-06 20:45 (CST) | 状态: ✅ **五步全链真实系统验证通过**
> 用途: 销售人员可直接演示的客户故事（非技术演示）
> 定位: 证明「用户第一次打开后的理解 + 购买理由 + 企业采用路径」

---

## 演示总览（30 秒电梯版）

> 昆仑镜不是又一个 AI 工具，而是**企业的一组数字员工**——招聘、内容、营销、法务、财务五类岗位，一个平台统一雇佣、授权、使用、计量。

---

## Step 1: 老板注册企业

**话术**：
> 欢迎来到昆仑镜。你的 AI 员工团队已经准备好。

**屏幕**（登录后桌面）：
```
昆仑镜 Kunlun Desktop
├── 我的应用
├── AI 员工 · Marketplace
├── 企业管理
└── 设备信息
```

**真实证据**（实测）：
```
登录成功: JWT 签发 ✓（企业身份链: Desktop → JWT → Organization → Entitlement）
```

---

## Step 2: 进入 Marketplace —— 不是下载工具，是雇佣员工

**话术**：
> 这里不是应用商店。这里是人才市场——你雇佣的不是软件，是岗位。

**屏幕**（AI 员工 · Marketplace）：
```
分类: [全部] [人力] [内容] [营销] [风险] [财务]     搜索: ____

[人力] 招聘专员Alice — 你的 AI 招聘员工
[内容] 短剧导演 AI Employee — 你的 AI 短剧导演
[营销] 新媒体运营 AI Employee — 你的 AI 新媒体运营
[风险] 法务合同审查 AI Employee — 你的 AI 合同分析员工
[财务] 财务经营分析 AI Employee — 你的 AI 经营分析员工
```

**真实证据**（实测输出）：
```
AI 员工目录: 5 位数字员工
  [人力] 招聘专员Alice — 你的 AI 招聘员工（resume.parse candidate.score interview.evaluate ...）
  [内容] 短剧导演 AI Employee — 你的 AI 短剧导演
  [营销] 新媒体运营 AI Employee — 你的 AI 新媒体运营
  [风险] 法务合同审查 AI Employee — 你的 AI 合同分析员工
  [财务] 财务经营分析 AI Employee — 你的 AI 经营分析员工
```

---

## Step 3: 企业管理员授权（老板视角）

**话术**：
> 购买后，管理员授权 HR 使用 Alice。谁用、用多少、花多少，一屏看清。

**屏幕**（企业管理 → 企业概览）：
```
昆仑镜验收测试企业 · 方案 Enterprise · AI Employee 5/5

AI 员工:
  招聘专员Alice      执行 152 次 · 成功 134
  短剧导演            执行 49 次  · 成功 49
  新媒体运营          执行 49 次  · 成功 49
  法务合同审查        执行 54 次  · 成功 51
  财务经营分析        执行 18 次  · 成功 18

插件增强: JD 模板增强插件（jd-template）
成员权限: demo(owner) / tenant_org_test(CHANNEL_VIEWER) ...
```

**真实证据**（实测输出）：
```
企业套餐: Enterprise · AI Employee 5/10
  已启用: 招聘专员Alice（执行 152 次 · 成功 134）
  已启用: 短剧导演 AI Employee（执行 49 次 · 成功 49）
  ...（五员工全在）
```

---

## Step 4: 真实任务（HR 上传招聘需求 → Alice 执行）

**话术**：
> HR 上传需求「AI 产品经理，3 年以上经验，深圳」。Alice 自动完成简历解析 → 候选评分 → 面试评估。

**屏幕**（工作台）：
```
招聘需求: AI 产品经理, 3 年以上经验, 深圳

Alice 执行中…
  ✓ 简历解析（张伟 — Java/Redis/Spring, 5 年经验）
  ✓ 候选评分（candidate.score, 真实 LLM）
  ✓ 面试评估（interview.evaluate, 真实 LLM）
```

**真实证据**（实测输出）：
```
Alice 任务: COMPLETED
  step: resume.parse        | COMPLETED | source: real
  step: candidate.score     | COMPLETED | source: real
  step: interview.evaluate  | COMPLETED | source: real
```

---

## Step 5: 企业价值反馈（Usage + 增强）

**话术**：
> 老板看到的不只是「AI 能用」，而是「AI 干了多少活、成功率多少、还能怎么增强」。

**屏幕**（企业概览 → 使用统计 + 增强）：
```
本周期活动:
  执行任务: 326 次
  活跃员工: 5
  启用增强: 1（JD 模板包 — 3 个岗位模板: 互联网研发/AI 产品经理/运营）

招聘专员 Alice:
  JD 增强包: jd-template × 3 模板（已启用 → candidate.score 注入行业 JD 标准）
```

**真实证据**（实测输出）：
```
本周期活动: 执行 326 次 · 活跃员工 5 · 增强包 1
JD 增强包: [('jd-template', 3)]
```

---

## 演示要点（销售引导）

| 环节 | 关键话术 |
|---|---|
| Step 2 | 「雇佣员工」而非「下载工具」——岗位化表达（你的 AI 招聘员工） |
| Step 3 | 授权+计量一屏——「买员工、管员工、看价值」 |
| Step 4 | 真实执行——「简历→评分→面试」全链真实 LLM，非演示数据 |
| Step 5 | 价值闭环——「326 次执行 + JD 增强包」——员工能干活、还能更专业 |
| 延伸 | 五部门矩阵——「找人/生产/增长/风控/决策」全岗位覆盖 |

## 环境（演示账号）

```
企业: 昆仑镜验收测试企业（org 11111111-2222-4333-8444-555555555555）
账号: tenant_org_test@audit.local / AuditTest@123
员工授权: Alice + 短剧 + 新媒体 + 法务 + 财务（Enterprise 套餐 5/10）
插件: JD 模板增强（org A EcologyLicense ACTIVE）
模型: 企业 BYOK（TenantProviderCredential → deepseek 真实凭证）
```

## 完成标准

```
✅ 五步客户故事全链真实系统验证（本报告证据 = 实测输出, 非 mock）
✅ 销售可直接演示（话术 + 屏幕 + 证据三段式）
→ 剩余: Windows RG 实机（安装/首启后演示同一流程）→ Beta 0.1 Release Candidate
```
