# Sprint-RECRUITMENT-REALITY-06 — Enterprise Pilot（T01-T03 开发完成，Pilot 等企业）

**日期:** 2026-08-01 02:00 CST
**Gate:** 掌柜 Sprint-05 验收 98/100 后指令启动
**方向:** 从「开发模式」切换到「客户验证模式」——不扩招聘功能，围绕真实企业 30 天验证构建运营工具

---

# Sprint-05 验收反馈落地

## ROI 口径透明化 ✅（掌柜 ⚠️ 建议）

roi-report.vue 口径区升级：
- 完整基准表展示（JD 60min / 岗位分析 45min / 面试评估 30min / 筛选 15min / 解析 8min / 回复 5min 等 11 项 + HR 时薪 ¥50/h）
- 免责声明：「节省价值为**人力工作价值的估算**（替代了多少人工工时），非实际现金节省；实际收益取决于团队如何重新分配这些工时」
- 避免客户误解为「AI 真的替代了 ¥242 现金」

## P3 澄清 ✅（掌柜 Quota Policy Engine 建议）

现有 quotaConfig 本来就是**按能力配额**（AI_JD_GENERATE 50/月、AI_INTERVIEW 20/月、AI_CANDIDATE_RECOMMEND 100/月），已对齐掌柜建议；P3 只需加硬拦截开关，无需重构。

---

# T01 企业试运营面板（老板视角）⭐⭐⭐⭐⭐ ✅

`/admin/enterprise/pilot-dashboard.vue`（菜单「企业试运营 📊」）

组合已有 5 个数据源，纯前端聚合（无新后端依赖）：

```
企业选择器（全部/单企业） + 时间窗（7/30/90 天）
  ├─ 💰 价值大卡：节省工时 / 节省人力价值 / AI 成本 / ROI
  ├─ 🩺 模型健康：正常/失败/密钥异常/未检测/停用 + 异常自动阻断提示
  ├─ 📈 每日任务趋势（bar chart）
  ├─ 📋 任务类型分布（占比条 + 节省工时）
  ├─ 🤖 AI 员工活跃榜（次数 + 成功率）
  └─ ⏳ 配额总览（能力/已用/限额/预警色，观察模式标注）
```

---

# T02 AI 员工工作日报 ⭐⭐⭐⭐ ✅

- 后端 `getDailyReport({ organizationId?, date? })`：按日聚合员工活跃（agentInstanceId→Profile.name 映射）、任务类型产出、节省工时/价值、AI 成本/tokens、健康异常数
- API `GET /api/admin/enterprise/daily-report?date=YYYY-MM-DD&organizationId=`
- 前端 `/admin/enterprise/daily-report`（菜单「员工工作日报 📰」）：日期导航（前一天/后一天/日历）+ 企业筛选，日报卡片排版可截图分享（销售场景）
- 默认「本地昨日」口径（+08:00）

## 实测（7/31 昨日真实数据）

```
📋 2026-07-31 工作日报
🤖 AI 员工今日产出：
   用户的AI职业助理 15 次 60%
   admin的AI职业助理 7 次 100%
   人才分析师 Carol 4 次 100%
   ...
📦 产出明细：职业规划激活 / 简历解析 / 岗位分析 ...
📊 28 任务 | 75% 成功率 | 节省 4.85h ¥242.5 | AI 成本 ¥0.0261 | 健康异常 8
```

---

# T03 Key 恢复通知 ⭐⭐⭐ ✅

- 后端 `listHealthIssues()`：只列异常配置（failed/decrypt_error/disabled）+ 企业名（tenantId→Organization 双匹配）+ **建议操作文案**（如「密钥解密失败：请在企业工作台重新配置模型密钥」）
- API `GET /api/admin/llm/health/issues`
- 前端 llm-health.vue 升级：
  - **异常待办横幅**：⚠️ N 个异常待处理 + 受影响企业 + 自动阻断说明 + **一键重试全部异常**（只测 failed/decrypt_error）
  - 异常行红色高亮 + 每行内联建议操作
- 实测：12 个异常（2 解密失败 / 2 key 失效 / disabled 等），每条带企业 + 建议

## 通知渠道状态

当前通知 = 健康中心横幅 + 日报 healthIssues + 审计日志（execution.blocked_model_health）。
**邮件/站内信/微信推送渠道平台尚无**，待掌柜定渠道（Pilot 期间人工盯健康中心即可）。

---

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 老板视角可读 | 面板 = 健康+价值+使用+成本+配额 一页 | ✅ PASS |
| G2 日报可生成 | 7/31 真实数据聚合输出 | ✅ PASS |
| G3 一键修复 | issues API + 一键重试异常 | ✅ PASS |
| G4 无功能扩张 | 零新 AI 能力，纯运营工具 | ✅ PASS |
| G5 回归 | 7 个 Admin 端点全 200 + 前端构建 PASS | ✅ PASS |

# 遗留 / 待掌柜

1. **Pilot 企业**：真实企业 or 演示企业模拟真实流程（30 天：每周记录活跃/成本/价值/稳定性）
2. **通知渠道**：日报推送（邮件/站内信/微信）待定
3. **P3 硬拦截开关**：等消费数据沉淀后开启 429
4. hdz 存量类型错误未扩大（usage-quota.service 缺失）
