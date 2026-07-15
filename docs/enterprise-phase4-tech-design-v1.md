# Enterprise Revenue Intelligence — Phase 4

## Technical Design v1.0

| 项目 | 内容 |
|------|------|
| 版本 | v1.0 |
| 日期 | 2026-07-15 |
| 状态 | 待 CTO 审批 |
| 上级批准 | Phase 3.5 Sprint 2 ✅ PASS |

---

## 一、核心定位

**Sprint 2 成果**：让AI员工安全代表企业工作

**Phase 4 目标**：让老板看到 **AI部门不仅在工作，而且正在创造收入**

> 不是做 CRM。
> 是做 **AI增长部门的收入智能系统**。

```
AI增长部门
    ↓
发现客户 (Leads)
    ↓
判断价值 (Lead Intelligence)
    ↓
辅助成交 (Sales Assistant)
    ↓
收入预测 (ROI Dashboard)
```

---

## 二、三个核心模块

| 模块 | 路由 | 说明 |
|------|------|------|
| 🎯 线索智能 | `/enterprise/leads` | 客户是谁、为什么感兴趣、购买概率、下一步动作 |
| 💼 销售参谋 | `/enterprise/sales` | CEO的销售参谋（不是销售机器人），每日重点客户建议 |
| 💰 ROI驾驶舱 | `/enterprise/roi` | AI投入 vs AI创造收入，预计成交金额 |

---

## 三、架构全景

```
企业老板
    │
    ├── 📋 任务中心 (Sprint 1 ✅)
    │
    ├── 👥 AI员工 (Sprint 1 ✅)
    │   └── AI销售助理 → 发现线索 → 评分 → 跟进建议
    │
    ├── 🧠 企业知识 (Sprint 2 ✅)
    │
    ├── ✅ 审批中心 (Sprint 2 ✅)
    │
    ├── 📈 增长运营 (Phase 3 ✅)
    │   └── 渠道账号 + 内容发布
    │
    ├── 🎯 线索智能 (Phase 4 NEW)
    │   └── Lead Intelligence 升级：意图+温度+购买概率+下一步
    │
    ├── 💼 销售参谋 (Phase 4 NEW)
    │   └── 每日重点客户 + 成交概率 + 跟进建议
    │
    └── 💰 ROI驾驶舱 (Phase 4 NEW)
        └── 投入成本 vs 产生线索 vs 预计收入
```

---

## 四、数据库设计

### 原则
- 不新建已有功能（复用 `enterprise_interaction` 的线索数据）
- 只新增**2张表**

### 新增1张表：`enterprise_lead_intelligence`

```sql
CREATE TABLE enterprise_lead_intelligence (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  interaction_id    TEXT,                      -- 关联enterprise_interaction
  platform          VARCHAR(30),
  platform_user_id  TEXT,
  -- 客户画像
  customer_name     VARCHAR(100),              -- 推断名称/昵称
  customer_type     VARCHAR(30),               -- enterprise|individual|partner
  industry          VARCHAR(50),               -- 推断行业
  company_size      VARCHAR(20),               -- 推断规模 (1-50/50-200/200+)
  -- 意向分析
  intent_score      INT DEFAULT 0,             -- 购买意向0-100
  intent_signals    TEXT DEFAULT '[]',         -- JSON: 意向信号列表
  temperature       VARCHAR(10) DEFAULT 'cold', -- cold|warm|hot|customer
  purchase_prob     INT DEFAULT 0,             -- 成交概率0-100
  estimated_value   INT DEFAULT 0,             -- 预估成交金额(元)
  -- 跟进管理
  next_action       TEXT,                      -- 建议下一步
  next_action_date  DATE,                      -- 建议跟进日期
  assigned_agent    TEXT,                      -- 分配AI销售助理
  status            VARCHAR(20) DEFAULT 'new', -- new|contacting|qualified|opportunity|won|lost
  note              TEXT,                      -- 销售备忘
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eli_tenant ON enterprise_lead_intelligence(tenant_id);
CREATE INDEX idx_eli_temp ON enterprise_lead_intelligence(tenant_id, temperature);
CREATE INDEX idx_eli_prob ON enterprise_lead_intelligence(tenant_id, purchase_prob);
CREATE INDEX idx_eli_status ON enterprise_lead_intelligence(tenant_id, status);
```

### 新增1张表：`enterprise_roi_snapshot`

```sql
CREATE TABLE enterprise_roi_snapshot (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  snapshot_date     DATE NOT NULL,
  -- 投入
  plan_cost         INT DEFAULT 0,             -- 套餐费用(分)
  token_cost        INT DEFAULT 0,             -- token消耗(分)
  total_cost        INT DEFAULT 0,             -- 总投入(分)
  -- 产出
  leads_generated   INT DEFAULT 0,             -- 产生线索数
  hot_leads         INT DEFAULT 0,             -- 热线索数
  opportunities     INT DEFAULT 0,             -- 商机数
  estimated_revenue INT DEFAULT 0,             -- 预计收入(分)
  -- 效率
  cost_per_lead     INT DEFAULT 0,             -- 单线索成本(分)
  roi_ratio         NUMERIC(5,2) DEFAULT 0,    -- ROI倍数
  -- 元数据
  detail            TEXT DEFAULT '{}',         -- JSON breakdown
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ers_tenant_date ON enterprise_roi_snapshot(tenant_id, snapshot_date);
```

---

## 五、后端设计

### 5.1 文件结构

```
backend/src/
├── services/enterprise/
│   ├── lead-intelligence.service.ts    (线索智能: 画像+评分+温度+概率)
│   ├── sales-advisor.service.ts         (销售参谋: 每日重点+建议)
│   └── roi-dashboard.service.ts         (ROI驾驶舱: 投入产出+预测)
├── routes/
│   ├── enterprise-leads.ts              (7个API)
│   ├── enterprise-sales.ts              (5个API)
│   └── enterprise-roi.ts                (4个API)
└── enterprise/revenue/
    ├── lead-scoring.ts                  (线索评分算法)
    └── roi-calculator.ts                (ROI计算公式)
```

### 5.2 Lead Intelligence API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/enterprise/leads` | 线索列表(分页+温度筛选+排序) |
| GET | `/api/enterprise/leads/:id` | 线索详情(画像+意向+跟进记录) |
| PATCH | `/api/enterprise/leads/:id` | 更新线索状态/分配/备注 |
| GET | `/api/enterprise/leads/funnel` | 线索漏斗(new→contacting→qualified→won) |
| GET | `/api/enterprise/leads/top` | Top N 重点线索(按purchase_prob) |
| POST | `/api/enterprise/leads/:id/action` | 记录跟进动作 |
| GET | `/api/enterprise/leads/stats` | 线索统计面板 |

### 5.3 Sales Advisor API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/enterprise/sales/daily` | 今日重点客户列表(含AI建议) |
| GET | `/api/enterprise/sales/customers/:id` | 客户360视图(互动+意向+跟进) |
| GET | `/api/enterprise/sales/recommendations` | AI跟进建议(下一步动作) |
| POST | `/api/enterprise/sales/note` | 添加销售备忘 |
| GET | `/api/enterprise/sales/history` | 跟进历史 |

### 5.4 ROI Dashboard API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/enterprise/roi` | ROI总览(投入/产出/ROI/预测) |
| GET | `/api/enterprise/roi/trend` | ROI趋势(日/周/月) |
| GET | `/api/enterprise/roi/breakdown` | 按渠道/Agent分解 |
| POST | `/api/enterprise/roi/record` | 记录成交(win) |

### 5.5 Lead Scoring 算法

```typescript
// 购买意向评分 (0-100)
function calcIntentScore(interactions, contentViews, messages): number {
  let score = 0;
  
  // 互动频率: 每次互动+5分, 最高25分
  score += Math.min(interactions * 5, 25);
  
  // 内容深度: 下载/查看产品页每次+10分, 最高30分
  score += Math.min(contentViews * 10, 30);
  
  // 主动消息: 每次+15分, 最高30分
  score += Math.min(messages * 15, 30);
  
  // 关键词命中: "采购""询价""合作" 每个+5分, 最高15分
  score += Math.min(keywordHits * 5, 15);
  
  return Math.min(score, 100);
}

// 温度分级
function getTemperature(score): 'cold'|'warm'|'hot'|'customer' {
  if (score >= 80) return 'customer';
  if (score >= 60) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// 预估成交金额
function estimateValue(industry, companySize): number {
  const baseValues = {
    '物流': 50000, '新能源': 80000, '制造': 60000,
    '科技': 40000, '教育': 30000, '其他': 35000
  };
  return baseValues[industry] || 35000;
}
```

---

## 六、前端设计

### 6.1 文件结构

```
frontend/pages/enterprise/
├── leads.vue              (线索智能中心)
├── leads/[id].vue         (线索详情+跟进)
├── sales.vue              (销售参谋)
└── roi.vue                (ROI驾驶舱)
```

### 6.2 线索智能页面 `/enterprise/leads`

```
┌─────────────────────────────────────────────────────┐
│ 🎯 线索智能                   待处理:12 热线索:5   │
├─────────────────────────────────────────────────────┤
│ 📊 新线索:8 联系中:4 已认证:3 商机:2 成交:1        │
├─────────────────────────────────────────────────────┤
│ [全部] [🔥热线索5] [🟡温线索8] [❄️冷线索12]        │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐    │
│ │ 🔥 王总 · Tesla供应链 · 新能源物流           │    │
│ │ 意向分: 85/100 | 成交概率: 78% | 预估: ¥8万  │    │
│ │ 信号: 下载案例2次 + 询价1次 + 点赞5次        │    │
│ │ 建议: 发送新能源物流成功案例                  │    │
│ │                       [查看详情] [记录跟进]  │    │
│ └──────────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────────┐    │
│ │ 🔥 李经理 · 某物流公司 · 采购咨询             │    │
│ │ 意向分: 72/100 | 成交概率: 65% | 预估: ¥5万   │    │
│ │ 信号: 留言"感兴趣" + 访问产品页3次           │    │
│ │ 建议: 安排演示会议                            │    │
│ │                       [查看详情] [记录跟进]  │    │
│ └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 6.3 销售参谋页面 `/enterprise/sales`

```
┌─────────────────────────────────────────────────────┐
│ 💼 销售参谋                                         │
├─────────────────────────────────────────────────────┤
│ 📋 今日重点 (AI建议)                               │
│ ┌──────────────────────────────────────────────┐    │
│ │ 1. 王总 · Tesla供应链                        │    │
│ │    成交概率: 78% | 预估: ¥8万                 │    │
│ │    📌 建议: 发送新能源物流案例               │    │
│ │    ⏰ 最佳联系: 明天10:00                    │    │
│ │    [立即执行] [延后]                          │    │
│ ├──────────────────────────────────────────────┤    │
│ │ 2. 李经理 · 某物流公司                       │    │
│ │    成交概率: 65% | 预估: ¥5万                 │    │
│ │    📌 建议: 安排15分钟演示                   │    │
│ │    ⏰ 最佳联系: 今天14:00                    │    │
│ │    [立即执行] [延后]                          │    │
│ └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 6.4 ROI驾驶舱 `/enterprise/roi`

```
┌─────────────────────────────────────────────────────┐
│ 💰 ROI 驾驶舱                                       │
├─────────────────────────────────────────────────────┤
│ 投入 ¥999                    预计收入 ¥200,000      │
│ ─────────────              ─────────────           │
│ 产生线索 38个                成交概率 >60%: 8个     │
│ 热线索  25个                 平均客单价: ¥25,000   │
│                                                              │
│  ROI: 200x                                         │
│  ▕████████████████████████████████████▏           │
│                                                              │
│  📈 趋势                                               │
│  7月: ¥999 → 38线索 → 8商机 → ¥200k预测         │
│                                                              │
│  📊 分解                                               │
│  公众号: 15线索 | 抖音: 12线索 | 小红书: 11线索    │
│  AI内容经理: 18线索 | AI销售助理: 10线索           │
└─────────────────────────────────────────────────────┘
```

---

## 七、前端导航更新

CTO修正7: 按老板使用路径排序

```
🏢 企业数字部门 首页
↓
🎯 任务     → /enterprise/tasks
👥 员工     → /enterprise/agents
🧠 知识     → /enterprise/knowledge
✅ 审批     → /enterprise/approval
📈 增长     → /enterprise/channels
🎯 线索     → /enterprise/leads (NEW)
💼 销售     → /enterprise/sales (NEW)
💰 ROI     → /enterprise/roi (NEW)
📊 数据     → /enterprise/analytics (P1)
⚙️ 设置    → /enterprise/settings (P1)
```

---

## 八、文件清单

### 后端 (8文件)

| 文件 | 类型 | 行数估计 |
|------|------|----------|
| `lead-intelligence.service.ts` | 新建 | ~250行 |
| `sales-advisor.service.ts` | 新建 | ~200行 |
| `roi-dashboard.service.ts` | 新建 | ~180行 |
| `enterprise-leads.ts` (route) | 新建 | ~180行 |
| `enterprise-sales.ts` (route) | 新建 | ~150行 |
| `enterprise-roi.ts` (route) | 新建 | ~120行 |
| `lead-scoring.ts` | 新建 | ~80行 |
| `roi-calculator.ts` | 新建 | ~60行 |

### 前端 (4文件)

| 文件 | 类型 | 行数估计 |
|------|------|----------|
| `pages/enterprise/leads.vue` | 新建 | ~300行 |
| `pages/enterprise/leads/[id].vue` | 新建 | ~250行 |
| `pages/enterprise/sales.vue` | 新建 | ~250行 |
| `pages/enterprise/roi.vue` | 新建 | ~300行 |

### 数据库 (1文件)

| 文件 | 类型 |
|------|------|
| `2026071501_enterprise_revenue_intelligence.sql` | 新增2张表 |

### 修改 (2文件)

| 文件 | 修改内容 |
|------|----------|
| `src/index.ts` | 注册3个新route |
| `KunlunNav.vue` | 菜单新增3项 |

---

## 九、验收场景

### 线索智能
1. Agent发现线索 → 自动生成Lead Intelligence记录
2. 按温度/概率排序 → TOP N 重点线索
3. 线索漏斗: new→contacting→qualified→won 可视化
4. CEO手动分配Agent + 记录跟进动作

### 销售参谋
1. 每日自动生成重点客户列表(按成交概率排序)
2. AI建议下一步动作（基于客户互动历史）
3. CEO添加销售备忘
4. 跟进历史时间线

### ROI驾驶舱
1. 实时ROI = 预计收入 / AI投入
2. 趋势图: 日/周/月
3. 按渠道分解: 哪个渠道产出最好
4. 按Agent分解: 哪个AI员工产出最高

### 数据真实性（修正6）
1. 线索来自真实 `enterprise_interaction` 分析
2. ROI成本来自真实 `dashboard.tokenCost`
3. 预计收入来自线索 `estimated_value × purchase_prob`
4. 禁止 Math.random 生成指标

---

## 十、开发隔离协议

```
Enterprise Revenue Intelligence Phase 4 最高约束
================================================

禁止修改:
  ❌ 短剧/小说/法律/PPT/GEO/商城
  ❌ enterprise_command (Sprint 1)
  ❌ enterprise_knowledge (Sprint 2)
  ❌ enterprise_agent_profile (Sprint 1)
  ❌ 已有审批状态机 (Sprint 2)

允许新增:
  ✅ enterprise_lead_intelligence
  ✅ enterprise_roi_snapshot

命名空间:
  ✅ src/services/enterprise/**
  ✅ src/routes/enterprise/**
  ✅ pages/enterprise/**

最高原则:
  线索来自真实互动，ROI来自真实成本
  禁止Mock数据进入Phase 4
```

---

## 十一、工期估计

| 阶段 | 工时 |
|------|------|
| 数据库 Migration | 0.5h |
| Lead Intelligence (后端+前端) | 5h |
| Sales Advisor (后端+前端) | 4h |
| ROI Dashboard (后端+前端) | 4h |
| 联调 | 2h |
| 验收 | 1.5h |
| **合计** | **17h** |

---

*文档版本: v1.0 | 待 CTO 审批*
