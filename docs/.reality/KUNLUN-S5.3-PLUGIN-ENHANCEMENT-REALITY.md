# KUNLUN-S5.3-PLUGIN-ENHANCEMENT-REALITY.md

> S5.3 Plugin Ecosystem Reality — JD 模板增强插件（Phase B/C Reality）
> 日期: 2026-08-06 13:10 (CST) | 状态: ✅ **PE1-PE6 全 PASS**
> 依据: 掌柜 S5.3 Phase B 执行指令（场景: JD Template Plugin → Alice; 小步增量）
> 定位: **证明 Plugin 可以增强 Employee, 但不能成为独立执行主体**

---

## 0. 修改文件列表

| 文件 | 变更 |
|---|---|
| backend/src/ecosystem/plugin-enhancement.ts | 新增: 纯函数（授权查询 + prompt 注入） |
| backend/src/routes/skill-tools-internal.routes.ts | candidate-score 注入点（tenantUserId→org→授权增强→applyEnhancements） |
| backend/scripts/s53-seed.mts | 幂等: 插件（manifest.enhancements）+ EcologyLicense（org A） |
| backend/scripts/s53-test.mts | PE1-PE6 Reality Gate |
| docs/.reality/KUNLUN-S5.3-PLUGIN-ENHANCEMENT-REALITY.md | 本报告 |

**基础设施增量**: 零新表 / 零新 Skill / 零新 Agent / 零新 Runtime / Hermes 零改动 ✅

## 1. 实施（Plugin Enhancement Model v1.0 落地）

### 插件（PE1）
```
plugin-recruitment-jd-template（PUBLISHED）
manifest.enhancements = [{
  skillId: "candidate.score",       # 挂载点 = 员工 Skill Set 内既有 Skill（不扩能力）
  type: "jd-template",
  templates: [互联网研发岗 / AI 产品经理 / 运营岗位 JD]
}]
```

### 授权双层（PE2）
```
EnterpriseEntitlement（员工: Alice）  —— 已有
EcologyLicense（插件: org A ACTIVE）  —— 复用, 零新体系
无插件授权组织 → 增强查询返回空 → 基础执行（降级不拒绝）
```

### 注入链（PE3）
```
candidate.score 内部路由
  → tenantUserId → orgId（getOrganizationIdForUser）
  → getOrgEnhancementsForSkills(orgId, ['candidate.score'])（EcologyLicense ACTIVE + manifest 匹配）
  → applyEnhancements(prompt)（纯函数: user prompt 追加 JD 模板 + system 提示）
  → unifiedAIGateway.invokeAI（唯一模型入口保持）
```

## 2. Reality Gate 结果（实测 15 PASS / 0 FAIL）

| # | 关卡 | 判定 | 证据 |
|---|---|---|---|
| PE1 | Plugin Identity | ✅ | 插件唯一 PUBLISHED; enhancements 声明正确（挂载 candidate.score, 3 模板） |
| PE2 | License 双层 | ✅ | org A 有授权 → 增强可取; 未授权组织 → 空（降级） |
| PE3 | Enhancement Injection | ✅ | 注入后 prompt 含 JD 模板; 无增强 → 原样; A 企业全链 COMPLETED + source=real |
| PE4 | F1 Boundary | ✅ | Alice 3 Skills / 4 capabilities 不变; AgentDefinition 零新增（13 不变） |
| PE5 | Runtime Boundary | ✅ | Hermes 0 插件引用; 内部路由零 Key / 零 narrativeGateway / invokeAI 唯一入口 |
| PE6 | 三员工回归 | ✅ | Alice + 短剧导演 + 新媒体 全 COMPLETED |

## 3. 完成标准对照

```
Plugin = Employee Enhancement 成立（非独立执行主体）
→ 插件只提供模板/规则/词库（数据）, 不拥有 Identity/Runtime/Capability/Model Routing
→ 商业模型验证: 「招聘员工 + 行业增强包」企业 SaaS 路线成立
→ S5 全链收口: 员工可复制（S5.1）→ 三员工平台（S5.2）→ 员工可扩展（S5.3）
→ 下一步: S6 Desktop Productization（P0-P3 缺口清单已冻结）
```

## 4. 未完成项

- [ ] 更多增强类型（评分规则/词库/行业知识包）——同模板复制
- [ ] Desktop「已启用增强」badge（S6, 数据源 API 已设计: employees/:code/enhancements）
- [ ] Marketplace 前置设计（卖「员工 + 增强包」商品, 掌柜后续裁决）
- [ ] Plugin Registry/Install/Permission/Lifecycle 完整 UI（S6 P2）

## 5. 结论

```
S5.3 Phase B/C: ✅ 通过
第一个 AI Employee Enhancement Plugin 成立:
  JD 模板插件增强 Alice 的 candidate.score（真实链路, 授权双层, 零架构破坏）
→ 未来 Marketplace 走「岗位增强商品」路线, 非传统插件商店
```
