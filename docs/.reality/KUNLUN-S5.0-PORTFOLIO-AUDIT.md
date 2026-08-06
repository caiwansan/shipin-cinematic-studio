# KUNLUN-S5.0-AI-EMPLOYEE-PORTFOLIO-AUDIT.md

> S5.0 AI Employee Portfolio Reality Audit
> 日期: 2026-08-06 11:10 (CST) | 状态: ✅ **审计完成, 候选评估输出**
> 依据: 掌柜 S4.4 验收裁决（先审计 Portfolio → 选第二个商品 → 不扩 Marketplace）
> 定位: **从「单一商品样板」走向「商品组合」前的资产盘点与差距分析**

---

## 1. 资产全景（实证盘点）

### Workspace 工作台（frontend/pages）
| 工作台 | 业务域 | 员工商品化相关度 |
|---|---|---|
| media-department（媒体部, 含 workspace/settings/analytics） | 新媒体运营 | ★★★ 已有企业员工档案 + 员工工作台 |
| hdz/workspace（短视频, [id].vue） | 短剧/短视频 | ★★★ 已有工作台页 |
| director-os / director / studio / studio-v2 | 创作/导演 | ★★ 创作工具域 |
| workspace/geo, workspace/music, workspace/ad-create | 地理/音乐/广告 | ★★ |
| novel（小说） | 文学创作 | ★ |
| ai-center / chat / workbench | 通用 AI | ★（平台层, 非岗位） |

### AgentDefinition（5 defs, 全招聘域）
```
def-recruiter-alice       resume.parse + profile.extract + candidate.score + interview.evaluate ✅ 已商品化
def-resume-parser         resume.parse + profile.extract（Alice 的组件 Skill）
def-candidate-scorer      candidate.score（组件）
def-interview-evaluator   interview.evaluate（组件）
def-test-harness          mock.flaky + mock.slow（测试专用, 不商品化）
```

### Skill 生态（组件级, 复用 Alice 模板）
- 招聘域 4 Skill + 2 mock Skill; **新媒体/短剧域零 Skill**（F1 能力源空白, 需新建）

### 后端业务基础
| 域 | 现有资产 | 商品化可用性 |
|---|---|---|
| 招聘 | job-posting / enterprise-job-intelligence / admin-recruitment | 与 Alice 重叠, 边际价值低 |
| 短剧 | **ai-optimize-video-prompt（真实 LLM 线上运行）** / ai-generate-ad-video | ★★★ 最成熟 |
| 新媒体 | media-platform（**浏览器自动化: browser/accounts/cookies**） | ⚠️ 触碰自动外联边界, 内容创作可用 |

### 员工基础设施（EnterpriseAgentProfile 模型已存在）
```
AgentTemplate（岗位定义）→ EnterpriseAgentProfile（企业员工）→ EnterpriseAgentInstance（运行实例）
media-department/employees CRUD 已上线
```

## 2. 商品化差距矩阵（对照 Alice 商品模板五要素）

| 要素 | Alice（样板） | 候选员工现状 | 差距 |
|---|---|---|---|
| Capability | AgentDefinition 4 能力 | 无 def | 需新建 def |
| Skill 工具 | 3 Skill 真实化（解析器+内部路由+Hermes 薄工具） | 零 Skill | **最大工作量**（每 Skill: prompt 契约+纯函数解析器+路由+工具） |
| Entitlement | capabilityCodes 授权 | 复用（加 code 即生效） | 无差距 |
| Usage | InvocationLog+KernelEvent | 复用 | 无差距 |
| Asset | 每任务 3 文件 | 复用（skill-asset.service） | 无差距 |
| Desktop 入口 | AI 员工区块自动发现 | 复用（新 def 自动出现+授权状态） | 无差距 |

## 3. 候选评估

| 候选 | 业务域 | 优势 | 风险/约束 | 评级 |
|---|---|---|---|---|
| **B 短剧制作 AI Employee** | 短剧/短视频 | 现有真实 LLM 工具先例（ai-optimize-video-prompt 线上运行）; hdz/workspace 已存在; 资产形态清晰（剧本/分镜/prompt） | narrativeGateway 为既有业务 gateway——**Skill 工具必须改走 unifiedAIGateway.invokeAI**（F4/受控智能合规） | ★★★ 推荐 |
| A 新媒体运营 AI Employee | 新媒体 | media-department 员工工作台已存在 | media-platform 浏览器自动化域触碰自动外联冻结——**Skill 仅限内容创作（选题/文案/排期）, 禁发布自动化** | ★★ |
| C 招聘域扩展员工 | 招聘 | 无 | 与 Alice 能力重叠, 边际价值低 | ★ |

## 4. 结论与建议

```
推荐 S5.1 = 短剧制作 AI Employee（def-short-drama-director 候选）
理由: ① 最短商品化路径（真实 LLM 工具先例 + 工作台已存在）
      ② 跨域验证商品模板复用（证明 Alice 模板不是招聘专用）
      ③ 与 Alice 零重叠, Portfolio 多样性强
S5.1 范围建议（待掌柜裁决）: 2-3 个新 Skill（剧本/分镜/prompt 优化）
  → 全部走 unifiedAIGateway.invokeAI + 纯函数解析器 + 内部路由 + Hermes 薄工具
  → Entitlement/Usage/Asset/Desktop 全复用
合规红线: 禁 narrativeGateway 直连（Skill 工具 LLM 唯一入口 = unifiedAIGateway）
         禁浏览器自动化发布（自动外联冻结）
         禁新 Runtime / 禁第二套身份体系
```

## 5. 暂缓冻结（保持）

❌ Marketplace（前置: 3+ 稳定员工商品 + 统一质量审核） ❌ Memory ❌ Loop Agent ❌ 自动招聘联系 ❌ 新 Runtime ❌ 第二套身份体系

## 6. 下一步

- [ ] 掌柜裁决第二个 AI Employee 商品（推荐: 短剧制作）
- [ ] 批准后进入 S5.1 新 Employee Reality（小步: 设计 Gate → 最小实现 → Reality Gate）
