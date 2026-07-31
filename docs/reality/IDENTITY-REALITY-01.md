# SPRINT-IDENTITY-REALITY-01 — 统一企业身份与授权链 — COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜战略指令（05-C 是架构分水岭 → 不再补 Agent UI，进入身份/订阅/授权/模型四链闭环）
**验收:** 浏览器零 API 404 / 上线率 5% / 首个「运行中」AI 员工 / 套餐→模板授权判定全对

---

## 核心成果

> **「配置不完整 13」→「运行中 AI员工」的商业闭环第一次成立**

```
AI员工 21（原13 + provision 8）
运行中 1（AI 猎聘顾问：六要素全 PASS）
上线率 5%（新增指标）
```

---

## Task 完成

### T01 Organization SSOT（P0）✅
- **定案：Organization 表（73）= 唯一企业身份**（订阅/权益/实例/任务全挂它）；governance 体系降级为组织架构辅助（部门树+成员），不产生企业身份业务
- **历史决策变更记录**：identity-bootstrap「governance 为唯一 SSOT、禁止写 Organization」旧决策被掌柜新指令取代（文件头注释更新）
- **数据收敛**：13 员工 organization_id 全部对齐 Organization 表（0 孤儿）；补 Organization 记录：昆仑镜验收测试企业(11111111, owner=demo) / 清包工测试企业(05d00ac2)；演示企业(AI招聘Demo, 8aed92ac)已存在复用
- 冻结：EnterpriseMember/EnterpriseTenant/CustomerOrg 不产生新业务（全仓无此类表/逻辑）

### T02 Subscription → Entitlement（P0）✅
- **3 套餐 employees 映射**（capabilityCodes 新格式）：
  - basic 清包工 ¥299 → AI职业助理
  - professional 人事部 ¥999 → 招聘顾问 + 面试专家
  - enterprise HR猎头 ¥2999 → 招聘顾问 + 面试专家 + 人才分析师 + AI职业助理
- **Entitlement 2 条完整**（南波万 upsert 10 agents/7 caps + demo 新建）
- **template-eligibility 校验端点**：HR猎头允许招聘三件套+AI职业助理，拒绝 猎聘顾问/热点/营销/小说/短剧导演/法律顾问 ✅（掌柜规则精确落地）

### T03 Agent Provision 自动化（P0）✅
- provision 服务双模板兼容（新 agent_template 优先，旧 employee_template 回退）+ createEmployeeFromTemplate 双表支持
- **activate 端点接线**：支付→订阅激活→Entitlement→自动部署套餐员工（非阻塞）
- 实跑：南波万/demo 各部署 4 员工（招聘顾问/面试专家/人才分析师/AI职业助理），demo 4 员工自动激活（instance+namespace）

### T04 Model Policy 接通（P1）✅
- enterprise_llm_config 加 organization_id 列 + **5 条归属映射**（演示企业/昆仑镜Demo/E2E×3），9 条测试 tenant 不伪造
- **AgentModelBinding 1 条**：AI 猎聘顾问 → deepseek/deepseek-v4-flash（真实 key）
- **model-router agent_binding 优先**（原 TODO 真实现）：AgentInstance → Binding → LlmConfig 链；企业默认配置支持 organizationId 匹配
- **健康检查 14 条**：ok 2（deepseek-v4-flash 113ms / deepseek-chat 143ms）/ failed 2（401 key 失效）/ decrypt_error 9（测试/E2E key）/ 其余禁用
- 遵守冻结：平台不托管 Key，全部为企业自配（credential_owner=enterprise）

### T05 Reality Gate 自动化（P1）✅
- **G4 升级**：binding 存在 + 启用 + llm_config enabled + health ∈ {ok, untested}（key 失效 → 诚实「配置不完整」）
- **上线率指标** deploymentRate = 运行中/总数（前端 5 卡展示）
- **首个运行中员工**：AI 猎聘顾问（真实 LLM 调用成功：「你好，我是专注中高端人才猎聘的顾问…」）

---

## 数据真相（2026-08-01）

| 指标 | 值 |
|------|-----|
| AI 员工 | 21（active 15 / draft 6） |
| 运行中 | **1**（AI 猎聘顾问） |
| 上线率 | 5% |
| 套餐→员工映射 | 3 套餐完整 |
| Entitlement | 2（南波万 HR猎头 + demo） |
| 模型绑定 | 1（deepseek-v4-flash ok） |
| LLM 健康 | ok 2 / 401 2 / 解密失败 9 |
| 员工组织归属 | 21/21（0 孤儿） |

**为什么只有 1 个运行中？** 21 员工中仅演示企业（AI猎聘顾问部）配置了真实可用的企业 Key；其余企业（南波万/demo/昆仑镜科技）未配置 Key → G4 诚实不过。**修复路径 = 企业在工作台配 Key → auto-bind → Gate 自动转绿**（机制已自动化）。

## 提交
`待填`

## 冻结清单（持续）
❌ 平台托管用户 Key ❌ 绕过套餐授权手动塞员工 ❌ 旧 Agent 体系复活
⏸ governance 仅作组织架构，不再产生企业身份业务
