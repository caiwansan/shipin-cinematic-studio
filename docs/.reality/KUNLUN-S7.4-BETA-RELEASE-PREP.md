# KUNLUN-S7.4-BETA-RELEASE-PREP.md

> S7.4 Beta Release Preparation — Phase A 发布清单冻结
> 日期: 2026-08-06 21:00 (CST) | 状态: ✅ **发布清单冻结 + B/C/D 设计就绪, 待实施**
> 依据: 掌柜 Beta Demo 验收（技术能力证明 → 客户价值证明; RC 只剩三个现实关口: Windows RG / Marketplace 商业化包装 / 首个真实企业测试）
> 定位: **从「继续造」切换到「让第一个企业客户成功使用」**

---

## 0. 发布总览

```
昆仑镜 AI OS Beta 0.1 Release Candidate 门槛:
  Platform Core ✅ / AI Employee Factory ✅ / Desktop Beta ✅ / Enterprise Control ✅ / Commercial Story ✅
  ⏳ Windows RG（掌柜侧实机）
  ⏳ Marketplace Landing Page（S7.4-B）
  ⏳ Demo 数据隔离（S7.4-C）
  ⏳ 首次企业测试准备（S7.4-D）
```

## A. Beta 发布清单（冻结）

### A1 功能门槛（已达成, 实测）
| 项 | 状态 |
|---|---|
| Desktop 壳/登录/JWT/白名单 | ✅ |
| Marketplace（5 员工目录/分类/搜索/详情/授权态） | ✅ |
| 五部门员工全链执行（真实 LLM/BYOK） | ✅ |
| Plugin Enhancement（JD 模板注入） | ✅ |
| Enterprise Center（员工/插件/用量/套餐/成员） | ✅ |
| Billing View（derived, 非财务） | ✅ |
| Windows 打包配置（nsis/版本对齐/边界扫描） | ✅ |

### A2 发布门槛（RC 前必须）
| 项 | 归属 |
|---|---|
| RG-W1..W7 实机验证（安装/首启/登录/发现/启动/卸载） | 掌柜侧（开发机） |
| Marketplace Landing Page（B） | 本阶段 |
| Demo 数据隔离（C） | 本阶段 |
| 首次企业测试准备（D） | 本阶段 |

### A3 发布边界（冻结）
```
❌ 第六员工 / 新 Skill / 新 Runtime / 新基础设施（边际价值最低）
❌ Payment / Order（真实企业测试后）
❌ 承诺具体节省数字（Landing Page 禁 ROI 数字）
```

## B. Marketplace 商品页优化（Employee Landing Page）

```
升级点: 从「AI 招聘员工」岗位表达 →「你的 24 小时招聘经理」价值表达
Landing 结构（marketplace 详情 API 扩展, 代码级映射零新表）:
  positioning: 一句价值（你的 24 小时招聘经理）
  fitsFor: 适合对象（中小企业 HR 团队）
  responsibilities: 负责事项（分析岗位/筛选简历/生成面试方案/输出招聘报告）
  guardrail: 禁承诺具体节省数字（合规）
五员工 Landing 文案（B 实施时冻结）
```

## C. Demo 数据隔离

```
现状: 演示企业 = 验收测试企业（tenant_org_test, org A）
隔离原则（审计+文档）:
  1. 演示数据全部来自测试租户（无真实用户数据混入——审计确认）
  2. Demo 脚本（s80-demo.sh）owner 临时提升+还原（已验证）
  3. 企业测试（D）使用独立租户, 与演示环境隔离
实施: 审计租户数据归属 + 隔离确认文档化
```

## D. 首次企业测试准备

```
流程（文档化）:
  企业注册 → 选择员工 → 管理员授权 → 员工使用 → 观察 7 天 → 收集反馈
准备物:
  1. 测试企业 onboarding 清单（注册/授权/员工分配步骤）
  2. 观察指标（执行次数/成功率/增强使用/问题反馈）
  3. 反馈收集模板（价值感知/能力缺口/体验问题）
实施: 文档 + 检查清单（真实企业接入前的可执行准备）
```

## 5. 实施顺序（待掌柜批准）

```
Phase B: marketplace 详情 API + landing 映射 + Desktop 详情展示 + LB1-LB4 测试
Phase C: 租户数据归属审计 + 隔离确认（文档）
Phase D: 企业测试 onboarding 清单 + 观察指标 + 反馈模板（文档）
→ 与 Windows RG（掌柜侧）并行
```

## 6. 结论

```
S7.4 Phase A 发布清单冻结 ✅
→ 昆仑镜已从「技术能力证明」进入「客户价值证明」
→ 下一步: 实施 B/C/D（服务器侧）+ Windows RG（掌柜侧并行）
```
