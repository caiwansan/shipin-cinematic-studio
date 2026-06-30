# GEO Publishing Wireframe v1.0
## Brand Knowledge OS — 分发中心（Distribution Center）

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Health / Recommendations / Verification Wireframe 组件语言 + Product Principles / Vocabulary / IA

---

# 一、产品定义（必须先冻结）

## Publishing ≠ 发布按钮

它的真实定位是：

> **Distribution Center（分发中心）**

回答的不是"我刚刚发布了吗？"，而是：

> **我的品牌现在被 AI 世界看见了吗？在哪里被看见？**

Brand Knowledge OS 的价值不是"发布一次"，而是**持续维护品牌知识在整个 AI 世界中的分发状态**。

---

## 与其他页面的关系

| 页面 | 回答 |
|------|------|
| Health | 我现在怎么样？ |
| Recommendations | 我应该做什么？ |
| Verification | 是否真的改善？ |
| **Publishing** | **我的品牌知识现在传播到哪里了？** |
| Growth | 成长趋势是什么？ |
| Knowledge | 品牌知识由什么构成？ |

---

## 后端映射（隐藏规则）

后端所有 KDP 能力全部隐藏。Workspace 可见的只有渠道名称。

| 后端 | Workspace | Studio |
|------|-----------|--------|
| GitHub / GitLab / S3 / MinIO | Official Website | ✅ 可见 |
| AI Feed / LLM Feed | Knowledge Feed | ✅ 可见 |
| Baidu / Bing / Google | Search Index | ✅ 可见 |
| Knowledge Bundle API | Content Platform | ✅ 可见 |
| Package / Pipeline / Adapter | — | ✅ 可见 |

---

# 二、页面结构（Wireframe）

```
┌──────────────────────────────────────────────────────────┐
│  Distribution                                            │
│  "Where your brand is seen by AI systems"                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─── Distribution Health ──────────────────────────┐   │
│  │                                                    │   │
│  │  Distribution Coverage: 3 of 5 channels active    │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Connected Channels ───────────────────────────┐   │
│  │                                                    │   │
│  │  Official Website      ✓ Connected    2h ago      │   │
│  │  Knowledge Feed        ✓ Connected    24h ago     │   │
│  │  AI Feed               ✓ Connected    3h ago      │   │
│  │  Search Index          ⌛ Pending     —            │   │
│  │  Content Platform      ⚠ Not Set Up   —            │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Pending Updates ─────────────────────────────┐   │
│  │                                                    │   │
│  │  3 brand changes not yet distributed               │   │
│  │                                                    │   │
│  │  ▸ Brand description updated  (Feb 14)             │   │
│  │  ▸ FAQ expanded               (Feb 13)             │   │
│  │  ▸ New product added          (Feb 12)             │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─── Latest Distribution ─────────────────────────┐   │
│  │                                                    │   │
│  │  Last distributed: Feb 14, 14:30                   │   │
│  │  Brand Health impact: +3                           │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [ Update Distribution ]  (Primary CTA)             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

# 三、组件规范

## 3.1 Distribution Health Banner

### 结构
```
Distribution Coverage: 3 of 5 channels active
```

### 规则
- 单一数字：活跃渠道数 / 总配置渠道数
- 不显示百分比（避免与 Brand Health 混淆）
- 使用进度条视觉，非数字百分比

---

## 3.2 Channel Card

### 结构
```
Official Website      ✓ Connected    2h ago
Knowledge Feed        ✓ Connected    24h ago
AI Feed               ✓ Connected    3h ago
Search Index          ⌛ Pending      —
Content Platform      ⚠ Not Set Up    —
```

### 字段规范
| 字段 | 说明 | 格式 |
|------|------|------|
| Channel Name | 用户友好的渠道名称 | Official Website, Knowledge Feed, AI Feed |
| Status | 连接状态 | ✓ Connected / ⌛ Pending / ⚠ Not Set Up |
| Last Sync | 上次同步时间 | 相对时间 + 绝对时间 tooltip |
| Action | 可执行操作 | "Re-sync" / "Set Up" (仅状态异常时出现) |

### 状态定义
| 状态 | 含义 | 用户动作 |
|------|------|---------|
| ✓ Connected | 正常运行 | 无操作 |
| ⌛ Pending | 同步中或排队中 | 查看进度 |
| ⚠ Not Set Up | 渠道尚未配置 | "Set Up" 按钮（跳转 Studio） |
| ⚠ Error | 同步失败 | "Retry" 按钮 |

---

## 3.3 Pending Updates Panel

### 结构
```
3 brand changes not yet distributed

▸ Brand description updated  (Feb 14)
▸ FAQ expanded               (Feb 13)
▸ New product added          (Feb 12)
```

### 规则
- 显示未分发变更数量
- 每一项：变更描述 + 日期
- 点击可展开查看详细 diff

---

## 3.4 Latest Distribution Summary

### 结构
```
Last distributed: Feb 14, 14:30
Brand Health impact: +3
```

### 规则
- 总是显示最近一次分发记录
- 显示分发后的 Brand Health 变化
- 点击跳转 Verification（查看该次分发的影响详情）

---

# 四、UI 设计约束

| 约束 | 说明 |
|------|------|
| No technical channel names | 禁止 GitHub / GitLab / S3 / MinIO |
| Status first, action second | 用户第一眼看到覆盖情况，不是按钮 |
| Channel list not config panel | 不展示 Adapter 设置 |
| Impact always visible | 每次分发后必须显示 Health 变化 |
| Pending items actionable | 未分发变更必须可查看详情 |

---

# 五、页面行为模型

## Entry Flow

```
Verification (确认改善)
   ↓
进入 Publishing
   ↓
看到 Distribution Health
   ↓
检查哪些渠道已覆盖
   ↓
确认待分发变更
   ↓
[Update Distribution]
```

## Periodic Flow

```
收到 Notifications / 主动检查
   ↓
看到新变更未分发
   ↓
[Update Distribution]
   ↓
分发完成后跳转 Verification
```

---

# 六、被禁止的内容（进入 Studio）

| 禁止内容 | 归属 |
|----------|------|
| GitHub / GitLab | Studio |
| S3 / MinIO / Cloudflare R2 | Studio |
| Package Build Status | Studio |
| Pipeline Progress | Studio |
| Delivery Adapter Config | Studio |
| HTTP / API Endpoint | Studio |
| Deploy Log | Studio |

---

# 七、状态系统

## 7.1 Empty State — No channels configured

```
No distribution channels set up yet

Connect your first channel to make your brand 
visible to AI systems.

[ Set Up First Channel ]
```

## 7.2 Loading State

```
Checking distribution status...

Verifying channel connections...
```

## 7.3 Error State — Distribution failed

```
Distribution to Official Website failed.
Error: Connection timeout

[ Retry ]
```

---

# 八、与其他页面的连接

```
Publishing (分发中心) 
│
├── Verification ← 最近分发影响
├── Growth       ← 分发趋势
└── Studio       ← 渠道配置
```

---

# 九、冻结声明

> Publishing Wireframe v1.0 defines the distribution layer of Brand Knowledge OS.
> It answers: "Where is my brand seen by AI systems?"
> It does NOT answer: "Did the publish succeed?"
> Channel names in Workspace must be user-friendly; technical names belong to Studio.
> All implementations must conform to the Distribution Center definition.
