/**
 * VerificationWidgetRegistry — 验证 Widget 动态路由注册表
 */
export interface WidgetConfig {
  component: () => Promise<{ default: any }>
  label: string
}

const _store: Record<string, WidgetConfig> = {
  'summary':      { component: () => import('../VerificationSummary.vue'),      label: '分数对比' },
  'dimensions':   { component: () => import('../DimensionChanges.vue'),         label: '子维度' },
  'actions':      { component: () => import('../ActionCompletion.vue'),         label: '行动完成' },
  'items':        { component: () => import('../VerifiedItemsTable.vue'),       label: '已验证条目' },
  'issues':       { component: () => import('../RemainingIssuesList.vue'),      label: '剩余问题' },
  'confidence':   { component: () => import('../ConfidenceIndicator.vue'),      label: '置信度' },
  'timeline':     { component: () => import('../VerificationTimeline.vue'),     label: '时间线' },
  'evidence':     { component: () => import('../EvidenceList.vue'),             label: '证据' },
  'breakdown':    { component: () => import('../BreakdownBlock.vue'),           label: '改进' },
  'next-actions': { component: () => import('../NextActionsBlock.vue'),         label: '下一步' },
}

export function registerWidget(key: string, config: WidgetConfig): void {
  _store[key] = config
}

export function resolveWidget(key: string): WidgetConfig | undefined {
  return _store[key]
}

export function listWidgets(): string[] {
  return Object.keys(_store)
}
