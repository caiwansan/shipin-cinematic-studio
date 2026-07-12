/**
 * SectionRendererRegistry — section type 到组件的动态映射
 *
 * 新增 section type → 只需在此注册组件路径，零改动 SectionRenderer。
 * 组件通过 dynamic import 按需加载，不增加主包体积。
 */
import type { SectionRendererConfig } from '../types'

const SectionRendererRegistry: Record<string, SectionRendererConfig> = {
  'findings': {
    component: () => import('../../../../components/kmki-ui/FindingsSection/index.vue'),
  },
  'opportunities': {
    component: () => import('../../../../components/kmki-ui/OpportunitiesSection/index.vue'),
  },
  'actions': {
    component: () => import('../../../../components/kmki-ui/ActionsSection/index.vue'),
  },
  'verification': {
    component: () => import('../../../../components/kmki-ui/VerificationSection/index.vue'),
  },
  'recommendations': {
    component: () => import('../../../../components/kmki-ui/NextRecommendations/index.vue'),
  },
  'publishing-status': {
    component: () => import('../../../../components/kmki-ui/DiffViewer/index.vue'),
  },
}

/** Register a new section renderer at runtime */
export function registerSectionRenderer(type: string, config: SectionRendererConfig): void {
  SectionRendererRegistry[type] = config
}

/** Get a section renderer config */
export function getSectionRenderer(type: string): SectionRendererConfig | undefined {
  return SectionRendererRegistry[type]
}

export default SectionRendererRegistry
