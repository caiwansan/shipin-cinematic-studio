// ============================================================
// Capability Catalog DTO & Mapper — Sprint-11D.4 Task 08
//
// 商品目录层 DTO：只暴露对产品层有意义的字段。
// 禁止泄漏 EmployeeCapability 内部实现细节。
// ============================================================

/**
 * 对外商品目录 DTO
 *
 * code        — 能力标识（唯一、稳定、可读）
 * name        — 显示名称
 * description — 能力描述
 * category    — 分类（recruitment / business / crm / content）
 *
 * 不包含：
 *   id            — DB 内部 ID，对商品域无意义
 *   requiredTools — 运行时工具绑定，非商品属性
 *   status        — 内部状态管理
 *   createdAt     — 审计时间戳
 *   metadata      — 保留域，未定义格式
 *   schemaVersion — 数据版本，非商品信息
 */
export interface CapabilityCatalogItemDTO {
  code: string
  name: string
  description: string | null
  category: string
}

/**
 * 将 EmployeeCapability ORM 记录映射为商品目录 DTO
 *
 * 这是单一事实源映射点：
 * 所有对外能力目录查询必须经过此函数。
 */
export function toCatalogItemDTO(cap: {
  code: string
  name: string
  description: string | null
  category: string
}): CapabilityCatalogItemDTO {
  return {
    code: cap.code,
    name: cap.name,
    description: cap.description,
    category: cap.category,
  }
}
