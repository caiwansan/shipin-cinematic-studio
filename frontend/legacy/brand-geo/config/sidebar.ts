// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
// GEO Product Navigation — Product Shell v1
// ONLY entry: /workspace/geo → GeoWorkspaceV1 (v1.5)
// Consumer: settings only (non-workspace config)
// Advanced/Developer: removed from sidebar, accessible via URL only

import type { SidebarMenuItem } from '~/studio-v2/types/geo/runtime'

// Consumer-facing: only settings remain (not a workspace panel, just config)
export const GEO_CONSUMER_MENU: SidebarMenuItem[] = [
  { id: 'settings', label: '设置', icon: '⚙️', route: '/workspace/geo?panel=settings' },
]

// Advanced navigation — removed from sidebar as part of Product Shell v1
// All advanced features accessible only through v1.5 Tab system or direct URL
export const GEO_ADVANCED_MENU: SidebarMenuItem[] = []

// Developer navigation (URL-only, not shown in sidebar)
export const GEO_DEVELOPER_MENU: SidebarMenuItem[] = []

// Legacy export — empty to prevent sidebar rendering
export const GEO_SIDEBAR_MENU = GEO_CONSUMER_MENU
