# Enterprise Operation Workspace — Phase 3.5 Sprint 2

## Knowledge & Approval Layer — Technical Design v1.0

| 项目 | 内容 |
|------|------|
| 版本 | v1.0 |
| 日期 | 2026-07-15 |
| 状态 | 待 CTO 审批 |
| 上级批准 | Sprint 1 v1.1 ✅ PASS |

---

## 一、核心定位

Sprint 1 解决了「老板如何管理AI部门」

Sprint 2 解决企业最大顾虑：**AI会不会乱发东西？**

答案：**企业知识 + 审批流程 + 可追溯审计**

---

## 二、架构全景

```
企业老板
    │
    ├── 📚 知识中心
    │   └── 上传: 公司介绍/产品资料/客户案例/销售话术/FAQ/行业资料
    │
    ├── 📋 任务中心 (Sprint 1 ✅)
    │   └── CEO指令 → AI Planner → Agent执行
    │
    ├── 🎯 审批中心 (Sprint 2 NEW)
    │   └── Agent生成 → AI初审 → CEO审批 → 渠道发布
    │
    └── 📈 增长运营 (Phase 3 ✅)
        └── 渠道账号 + 内容发布 + 线索收集
```

---

## 三、Sprint 2 两个核心模块

### 模块A：企业知识中心 `/enterprise/knowledge`

**做什么：**
- 企业上传知识资产（6种类型）
- AI员工执行任务时，自动参考企业知识
- 支持文档/文本两种输入方式

**不做：**
- 不做向量数据库（Phase 5 再做RAG）
- 不做自动知识抽取
- 不做外部知识爬取

### 模块B：企业审批中心 `/enterprise/approval`

**做什么：**
- 内容发布前的CEO审批
- AI自动初审（关键词+规则）
- 审批通过→渠道发布 / 审批拒绝→退回修改
- 完整审计链条

**不做：**
- 不做多人审批流程
- 不做审批权限分级
- 不做自动发布定时任务（已有schedule）

---

## 四、数据库设计

### 原则
- 不创建第二套知识系统（复用knowledge_*体系语义）
- 不创建第二套审批系统（复用content publish status体系）
- 只新增**1张表**，扩展**1张表**

### 新增1张表：`enterprise_knowledge`

```sql
CREATE TABLE enterprise_knowledge (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  type        VARCHAR(30) NOT NULL,     -- intro|product|case|script|faq|industry
  title       VARCHAR(200) NOT NULL,
  content     TEXT NOT NULL,            -- 正文内容（Markdown）
  file_url    TEXT,                     -- 可选文件附件
  source      VARCHAR(50) DEFAULT 'upload',  -- upload|import|manual
  status      VARCHAR(20) DEFAULT 'active',  -- active|archived
  char_count  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enterprise_knowledge_tenant ON enterprise_knowledge(tenant_id);
CREATE INDEX idx_enterprise_knowledge_type ON enterprise_knowledge(tenant_id, type);
```

### 扩展1张表：`enterprise_content_publish`

```sql
-- 现有字段已包含: status, rejection_reason
-- 新增审批链条追踪字段
ALTER TABLE enterprise_content_publish
  ADD COLUMN approver_id TEXT,
  ADD COLUMN approval_at TIMESTAMPTZ,
  ADD COLUMN approval_note TEXT,
  ADD COLUMN ai_review_score INT,           -- AI初审评分 0-100
  ADD COLUMN ai_review_note TEXT;           -- AI初审意见

CREATE INDEX idx_enterprise_content_publish_status
  ON enterprise_content_publish(tenant_id, status);
```

---

## 五、后端设计

### 5.1 文件结构

```
backend/src/
├── services/enterprise/
│   ├── enterprise-knowledge.service.ts    (知识中心 CRUD)
│   ├── enterprise-approval.service.ts     (审批流程)
│   └── enterprise-content-review.service.ts (AI初审)
├── routes/
│   ├── enterprise-knowledge.ts            (6个API)
│   └── enterprise-approval.ts             (5个API)
└── enterprise/knowledge/
    ├── knowledge-types.ts                 (知识类型枚举)
    └── review-rules.ts                    (AI初审规则)
```

### 5.2 Knowledge Service API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/enterprise/knowledge` | 列表（分页+类型筛选+搜索） |
| POST | `/api/enterprise/knowledge` | 创建知识条目 |
| PATCH | `/api/enterprise/knowledge/:id` | 更新知识条目 |
| DELETE | `/api/enterprise/knowledge/:id` | 归档知识条目 |
| GET | `/api/enterprise/knowledge/stats` | 知识库统计 |
| GET | `/api/enterprise/knowledge/search` | 全文搜索（ILIKE） |

### 5.3 Approval Service API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/enterprise/approvals` | 待审批列表 |
| GET | `/api/enterprise/approvals/:id` | 审批详情 |
| POST | `/api/enterprise/approvals/:id/approve` | 批准发布 |
| POST | `/api/enterprise/approvals/:id/reject` | 拒绝发布 |
| GET | `/api/enterprise/approvals/history` | 审批历史 |

### 5.4 AI 初审引擎

```typescript
// 轻量规则引擎，不依赖LLM
interface ReviewRule {
  id: string;
  name: string;
  check: (content: string) => { passed: boolean; score: number; note: string };
}

// 规则1: 敏感词过滤（政治/竞品/虚假宣传）
// 规则2: 内容长度检查（100-5000字）
// 规则3: 链接安全检查（白名单域名）
// 规则4: 品牌词一致性检查
// 规则5: 重复内容检测（与已发布内容相似度）
```

### 5.5 审批流程

```
Agent生成内容 (draft)
    ↓
AI自动初审 (ai_review)
    ↓ score >= 80
CEO待审批 (wait_approval)
    ├─ 批准 → approved → 渠道发布 (published)
    └─ 拒绝 → rejected → 退回Agent修改 (draft)
```

---

## 六、前端设计

### 6.1 文件结构

```
frontend/
├── pages/enterprise/
│   ├── knowledge.vue          (知识中心)
│   └── approval.vue           (审批中心)
├── components/enterprise/
│   ├── KnowledgeUploader.vue  (知识上传器)
│   └── ApprovalCard.vue       (审批卡片)
```

### 6.2 知识中心页面 `/enterprise/knowledge`

```
┌─────────────────────────────────────────────────┐
│ 📚 企业知识中心                        [上传知识] │
├─────────────────────────────────────────────────┤
│ 📊 统计: 共42条 | 公司介绍5 | 产品12 | 案例8    │
├─────────────────────────────────────────────────┤
│ [全部] [公司介绍🔢5] [产品资料🔢12] [客户案例🔢8]│
│ [销售话术🔢0] [FAQ🔢15] [行业资料🔢2]           │
├─────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐    │
│ │ 📄 公司介绍                              │    │
│ │ 昆仑镜AI是一家专注于AI员工自动化...       │    │
│ │ 256字 | 更新于2天前 | active             │    │
│ └──────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────┐    │
│ │ 📄 产品定价手册                           │    │
│ │ Starter套餐 ¥999/月，Growth套餐...       │    │
│ │ 1024字 | 更新于5天前 | active            │    │
│ └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 6.3 审批中心页面 `/enterprise/approval`

```
┌─────────────────────────────────────────────────┐
│ 🎯 审批中心                   待审批: 3 今日: 12 │
├─────────────────────────────────────────────────┤
│ [待审批🔴3] [已批准✅8] [已拒绝↩️4] [全部📋15]   │
├─────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐    │
│ │ 📝 新能源物流行业趋势洞察                  │    │
│ │ AI初审: 92分 ✅ 品牌调性✅ 无敏感词✅     │    │
│ │ 渠道: 公众号                                │    │
│ │ 预览: 2026年华东地区新能源物流...           │    │
│ │                                [批准] [拒绝]│    │
│ └──────────────────────────────────────────┘    │
│ ┌──────────────────────────────────────────┐    │
│ │ 📝 如何挑选合适的AI员工服务商              │    │
│ │ AI初审: 68分 ⚠️ 需人工复核                 │    │
│ │ 渠道: 小红书                                │    │
│ │ 预览: 企业在选择AI员工服务商时...          │    │
│ │                                [批准] [拒绝]│    │
│ └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 七、知识类型枚举

```typescript
enum KnowledgeType {
  INTRO = 'intro',         // 公司介绍
  PRODUCT = 'product',     // 产品资料
  CASE = 'case',           // 客户案例
  SCRIPT = 'script',       // 销售话术
  FAQ = 'faq',             // 常见问题
  INDUSTRY = 'industry'    // 行业资料
}
```

---

## 八、AI 初审评分规则

| 规则 | 权重 | 判断逻辑 |
|------|------|----------|
| 敏感词过滤 | 40分 | 命中任何敏感词→0分，无命中→40分 |
| 内容长度 | 20分 | 100-5000字→20分，<100→5分，>5000→10分 |
| 品牌安全 | 20分 | 含公司全称→20分，无品牌提及→10分 |
| 广告合规 | 10分 | 无绝对化用词→10分，有→0分 |
| 格式规范 | 10分 | 含标题+正文+CTA→10分，缺任一→5分 |

**初审通过线：≥80分进入CEO审批，<80分标记"需人工复核"**

---

## 九、前端导航更新

在 `KunlunNav.vue` 企业数字部门下拉菜单中新增：

| 序号 | 模块 | 路由 | 状态 |
|------|------|------|------|
| 1 | 🚀 CEO驾驶舱 | `/enterprise` | ✅ |
| 2 | 📋 任务中心 | `/enterprise/tasks` | ✅ |
| 3 | 👥 AI员工 | `/enterprise/agents` | ✅ |
| 4 | 🧠 企业知识 | `/enterprise/knowledge` | NEW |
| 5 | 📈 增长运营 | `/enterprise/channels` | Phase 3 |
| 6 | 🎯 销售机会 | `/enterprise/leads` | Phase 4 |
| 7 | ✅ 审批中心 | `/enterprise/approval` | NEW |
| 8 | 📊 数据分析 | `/enterprise/analytics` | P1 |
| 9 | ⚙️ 设置 | `/enterprise/settings` | P1 |

---

## 十、文件清单

### 后端 (6文件)

| 文件 | 类型 | 行数估计 |
|------|------|----------|
| `enterprise-knowledge.service.ts` | 新建 | ~200行 |
| `enterprise-approval.service.ts` | 新建 | ~180行 |
| `enterprise-content-review.service.ts` | 新建 | ~120行 |
| `enterprise-knowledge.ts` (route) | 新建 | ~150行 |
| `enterprise-approval.ts` (route) | 新建 | ~130行 |
| `review-rules.ts` | 新建 | ~80行 |

### 前端 (4文件)

| 文件 | 类型 | 行数估计 |
|------|------|----------|
| `pages/enterprise/knowledge.vue` | 新建 | ~300行 |
| `pages/enterprise/approval.vue` | 新建 | ~280行 |
| `components/enterprise/KnowledgeUploader.vue` | 新建 | ~150行 |
| `components/enterprise/ApprovalCard.vue` | 新建 | ~120行 |

### 数据库 (2文件)

| 文件 | 类型 |
|------|------|
| `2026071501_enterprise_knowledge_sprint2.sql` | 新增表 |
| `2026071502_enterprise_content_publish_approval.sql` | 扩展表 |

### 修改 (2文件)

| 文件 | 修改内容 |
|------|----------|
| `src/index.ts` | 注册2个新route |
| `KunlunNav.vue` | 下拉菜单新增2项 |

---

## 十一、验收场景

### 知识中心
1. 创建知识条目 → 显示在列表
2. 按类型筛选 → 正确过滤
3. 搜索关键词 → 命中相关结果
4. 编辑/删除 → 数据更新

### 审批中心
1. Agent创建内容 → 进入`wait_approval`
2. CEO批准 → 状态变`approved` → 可发布
3. CEO拒绝 → 状态变`rejected` → 退回Agent
4. AI初审 → 评分正确显示
5. 审批历史 → 完整记录

### 集成验证
1. 审批通过的内容 → 可发布到渠道
2. 知识中心内容 → 可引用到Agent执行
3. 商城/小说/法律/PPT/GEO → 零修改

---

## 十二、工期估计

| 阶段 | 工时 |
|------|------|
| 数据库Migration | 0.5h |
| 后端 Service | 3h |
| 后端 Routes | 2h |
| 前端页面 | 4h |
| 联调 | 1.5h |
| 验收测试 | 1h |
| **合计** | **12h** |

---

## 十三、给CTO的指令

```
Enterprise Operation Workspace Phase 3.5 Sprint 2
Knowledge & Approval Layer 开发协议 v1.0

目标：把企业数字部门从"能管理AI员工"升级为"能让AI员工安全代表企业工作"
```

---

*文档版本: v1.0 | 待 CTO 审批*
