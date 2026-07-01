# RC2 Product Spec Freeze — GEO 产品规范冻结声明

**冻结日期**: 2026-06-30
**冻结范围**: GEO Workspace 产品页面结构、信息架构、流程定义

## 冻结页面结构

### Dashboard（首页）
- 品牌列表 + 状态概览
- BII 总得分趋势图
- 待处理告警
- 快速操作入口（新建品牌 / 启动扫描 / 查看报告）

### Brand Detail
- 品牌基本信息
- BII 八维雷达图
- 各模型评分对比
- 历史趋势
- 扫描记录

### Health Report（品牌健康报告）
- 总评分 + 置信度
- 八维指标详情（含 Explain）
- 各模型对比（DeepSeek / 豆包 / 千问 / 文心）
- 竞品对比
- 问题列表

### Optimization Center
- 优化建议列表（优先级排序）
- 每条建议含：问题描述、根因、建议方案、预期收益、置信度
- 一键执行
- 执行历史

### Verification
- Before/After 对比
- BII 变化详情
- 各维度变化
- Verification Report

### Publishing Center
- 发布状态机
- 适配器管理
- 审核流程
- 发布历史
- 回滚

### Monitor
- 收录趋势
- 分数漂移检测
- 告警配置
- 历史事件

## 冻结工作流

```
Build → Analyze → Report → Optimize → Execute → Publish → Verify → Monitor
```

## Design System 原则（冻结）
- 商业语言优先，不暴露内部架构（Prisma / Repository / State Machine 等）
- Explain Everywhere — 每个数字都有 Why/Evidence/Confidence
- 多模型对比始终可见
- 时间轴 / 趋势线始终可追溯

## 例外条款
- 熊大明确要求修改
- 用户体验缺陷（无法操作、数据错误、页面错乱）
