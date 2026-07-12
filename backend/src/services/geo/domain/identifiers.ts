// ============================================================
// GEO Domain Identifiers
//
// 领域标识符类型别名，防止 string 混用。
// 当前为 Type alias（零成本抽象），后续可演进为 branded type 或 class。
// ============================================================

/** UUID v4 格式的 Project ID */
export type ProjectIdentifier = string & { __brand: 'ProjectIdentifier' }

/** UUID v4 格式的 Tenant ID */
export type TenantIdentifier = string & { __brand: 'TenantIdentifier' }

/** 业务标识符（slug / brand code） */
export type BrandIdentifier = string & { __brand: 'BrandIdentifier' }

/** UUID 格式的 KnowledgeObject ID */
export type KnowledgeObjectIdentifier = string & { __brand: 'KnowledgeObjectIdentifier' }

// ============================================================
// Helpers
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(v: string): v is ProjectIdentifier {
  return UUID_REGEX.test(v)
}

export function asProjectIdentifier(v: string): ProjectIdentifier {
  if (!isValidUUID(v)) {
    throw new Error(`Invalid ProjectIdentifier: "${v}" is not a valid UUID`)
  }
  return v as ProjectIdentifier
}

export function asTenantIdentifier(v: string): TenantIdentifier {
  if (!isValidUUID(v)) {
    throw new Error(`Invalid TenantIdentifier: "${v}" is not a valid UUID`)
  }
  return v as TenantIdentifier
}

export function asBrandIdentifier(v: string): BrandIdentifier {
  return v as BrandIdentifier
}
