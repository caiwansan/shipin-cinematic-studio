// @deprecated — GEO v3 Legacy. Use design-system product blocks instead.
export interface BrandSetting {
  projectId: string
  brandName: string
  website: string | null
  industry: string | null
  region: string | null
  language: string | null
  description: string | null
  logo: string | null
  status: string
}

export interface BrandItem {
  id: string
  userId: string
  name: string
  topic: string | null
  industry: string | null
  language: string
  status: string
  createdAt: string
  updatedAt: string
  brandSetting: BrandSetting | null
}

export interface BrandsResponse {
  success: boolean
  data: BrandItem[]
  quota: { used: number; limit: number; membership: string }
}
