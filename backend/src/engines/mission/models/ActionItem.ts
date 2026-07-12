export type ActionItemType = 'navigate' | 'create' | 'edit' | 'review' | 'publish' | 'dismiss' | 'custom'
export interface ActionItem {
  id: string
  label: string
  type: ActionItemType
}
