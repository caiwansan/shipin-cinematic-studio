# KUNLUN-S6.0-DESKTOP-PRODUCT-REALITY.md

> S6.0 Desktop Product Reality Audit — 商品化结构重新冻结（Phase A）
> 日期: 2026-08-06 13:20 (CST) | 状态: ✅ **审计完成 + 商品化结构冻结, 待掌柜批准 S6.1/S6.2**
> 依据: 掌柜 S6.0 执行指令（基于 S4.0 宪法 + S5 Employee Platform Reality, 重新定义 Desktop 商品化结构; 纯审计禁编码）
> 定位: **从「Desktop → Employee」升级为「Desktop → Employee Marketplace → Employee + Plugin」**

---

## 0. 产品模型变化（S5 后的核心结构更新）

```
S5 之前:  Desktop → Employee
S5 之后:  Desktop → Employee Marketplace → Employee + Enhancement Plugin

Desktop 新结构（冻结）:
  Application Center（应用层）
    ├── 应用（Workspace 入口, 已有）
    ├── AI Employee 商品（身份/能力/授权/增强/启动）
    └── Plugin Enhancement（员工增强包展示）
```

## 1. 六项审计（实证）

### 1) Application Center 产品化程度
| 现状 | 缺口 |
|---|---|
| 应用卡片列表（name/desc/category/启动）| 无应用详情页（版本/权益/说明）; 无分类/搜索; 无额度展示 |

### 2) AI Employee 商品入口
| 现状 | 缺口 |
|---|---|
| S4.3 员工区块（目录 API 驱动 + 已授权/需要购买 badge + 启动/禁用）| **无员工详情页**（能力明细/授权态/增强包/Usage 展示）; 卡片信息密度低 |

### 3) Plugin Enhancement 展示
| 现状 | 缺口 |
|---|---|
| 插件授权页 = 设备级生命周期（start/stop/uninstall, 本地运行时域）| **无员工增强展示**; 后端增强查询 API 未实现（仅内部函数 getOrgEnhancementsForSkills, 无对外只读 API） |

### 4) License/Entitlement 状态
| 现状 | 缺口 |
|---|---|
| 员工级 badge（ACTIVE/NONE, Cloud 来源 S4.3）| 无企业级 License 概览（已购员工/已购增强包/到期）; 无购买入口（P3 商业展示层） |

### 5) Usage 展示
| 现状 | 缺口 |
|---|---|
| 后端 usage API 已存在（S4.2, JWT 鉴权 S4.4）| **Desktop 未消费**——员工卡片无使用次数/成功失败/能力分布 |

### 6) Windows Release Reality
| 现状 | 缺口 |
|---|---|
| build.sh（前端 SPA 构建）; publish.sh; deep link 注册; 诊断模式 | **无 tauri build/nsis 配置**; 无 installer 实测; 无更新通道; 无签名; 无崩溃收集 |

## 2. Desktop 商品化结构（冻结, S6.1 规格）

### 导航结构（更新）
```
我的应用（应用层）          ← 已有, 补详情
AI 员工（员工商品层）       ← 已有, 升级商品卡
插件增强（增强层, 新增）    ← 新: 员工增强包展示
设备信息                    ← 已有
```

### AI Employee 商品卡（S6.1 规格）
```
招聘顾问 Alice
企业招聘助手
能力:  ✓ 简历分析  ✓ 候选评估  ✓ 面试报告      ← employees/:code/skills
授权:  已购买（企业 License）                    ← entitlement
增强:  ✓ JD 模板包（plugin-recruitment-jd-template） ← 新增强查询 API
用量:  本月执行 128 次 · 成功率 96%             ← usage API（已有未消费）
[启动]  [详情]
```

### 员工详情页（S6.1 规格）
```
身份 / 能力明细 / 授权状态 / 增强包列表（已装/可用）/ 用量趋势 / 最近资产
```

## 3. 新后端 API 需求（S6.1 前置, 最小增量）

```
GET /api/skills/employees/:code/enhancements   # 该员工 Skill Set 上企业已授权插件的增强列表
                                               # 复用 getOrgEnhancementsForSkills（S5.3, 已存在）+ JWT 鉴权（S4.4）
其余: 全部已有（skills/entitlement/usage/agent-definitions）
```

## 4. Windows Release Reality 路线（S6.2）

```
1. tauri.conf.json 补 bundle.targets=nsis + updater 配置（tauri-plugin-updater）
2. Windows 开发机实机构建（本机 Linux 只承载后端 + Reality Gate）
3. installer 实测（clean machine install + 首登 + 员工启动）
4. 代码签名证书（后续）; 崩溃收集（诊断模式已有, 补自动上报开关）
```

## 5. 边界（冻结确认）

✅ 允许: Desktop UI 产品化（S6.1）/ 增强查询 API（只读）/ 发布工程（S6.2）
❌ 禁止: Desktop 承载 Hermes / 执行 Skill / 存 Key / 判断授权 / Marketplace 交易 / 支付 / 新 Runtime / 第二身份体系

## 6. Reality Gate（S6 总验收, 待 S6.1/S6.2 后执行）

| # | 关卡 | 验证 |
|---|---|---|
| DP1' | 商品卡 | 员工卡含身份/能力/授权/增强/用量 五要素（Cloud 来源） |
| DP2' | 详情页 | 员工详情 = 增强包 + 用量 + 最近资产 |
| DP3' | 增强展示 | 已授权增强包可见; 未授权显示「可购买」 |
| DP4' | Usage 可见 | 员工用量数据来自 usage API（JWT） |
| DP5' | Runtime 边界 | 扫描保持 0 Key / 0 Skill 执行 / 0 Hermes 承载 |
| DP6' | Windows 发布 | installer 实机安装 + 首登 + 员工启动成功（Windows 开发机） |

## 7. 结论

```
S6.0 商品化结构冻结 ✅
Desktop = AI Employee Marketplace 客户端（应用 + 员工商品 + 增强包）
→ S6.1 Desktop Product UI（商品卡/详情页/增强展示/用量展示; 唯一新 API = enhancements 只读）
→ S6.2 Release Engineering（Windows 实机发布链）
→ 待掌柜批准 S6.1 实施
```
