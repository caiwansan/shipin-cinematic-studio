/**
 * Sprint-14 Task 04L: Enterprise Employee Provisioning Service
 *
 * 定位：套餐购买 → AI 员工自动到岗
 * 规则：AI 员工是套餐权益自动提供的数字员工岗位，不是用户手动创建的资源
 *
 * 幂等：organizationId + template.role 唯一，重复激活不创建重复员工
 */
import { prisma } from '../../utils/index.js'
import { employeeMarketplaceService } from './employee-marketplace.service.js'
import { enterpriseAgentRuntime } from './enterprise-agent-runtime.service.js'

// ─── Types ───────────────────────────────────────────────

export interface EmployeeProvisionConfig {
  role: string
  displayName: string
}

export interface ProvisionResult {
  provisioned: number
  skipped: number
  employees: Array<{
    id: string
    name: string
    role: string
    status: 'provisioned' | 'skipped'
  }>
}

export interface ProvisionedEmployeeDTO {
  id: string
  name: string
  role: string
  department: string
  icon: string
  profileRuntimeStatus: string
  hasModelBinding: boolean
  instanceId: string | null
  instanceRuntimeStatus: string | null
  instanceLifecycleState: string | null
}

// ─── 兼容解析 capabilityCodes（与 entitlement 共享逻辑，避免循环依赖） ───

function parseEmployeeConfigs(raw: unknown): EmployeeProvisionConfig[] {
  if (!raw) return []

  // 新格式: { employees: [{ role, displayName }], capabilities: [...] }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    const employees = obj.employees
    if (Array.isArray(employees)) return employees as EmployeeProvisionConfig[]
    return []
  }

  // 旧格式: ["cap1", "cap2"] — 没有员工配置，跳过 provisioning
  return []
}

// ─── Service ─────────────────────────────────────────────

class EnterpriseEmployeeProvisionService {

  /**
   * 套餐购买后自动 provision AI 员工
   *
   * 流程:
   *   1. 读取 plan.capabilityCodes（兼容新旧格式）
   *   2. 解析 employees 配置
   *   3. 遍历，按 organizationId + role 幂等检查
   *   4. 不存在的 → createEmployeeFromTemplate(initialRuntimeStatus='draft')
   *   5. 已存在的 → 跳过
   *
   * 注意：EnterpriseAgentProfile.tenantId 与 organizationId 在同一系统中等价使用
   */
  async provisionEmployeesForPlan(
    organizationId: string,
    planId: string
  ): Promise<ProvisionResult> {
    const plan = await prisma.enterprisePlan.findUnique({ where: { id: planId } })
    if (!plan) throw new Error(`Plan not found: ${planId}`)

    const employeeConfigs = parseEmployeeConfigs(plan.capabilityCodes)
    if (employeeConfigs.length === 0) {
      console.log(`[Provision] Plan ${planId} has no employee configs, skipping provisioning`)
      return { provisioned: 0, skipped: 0, employees: [] }
    }

    // tenantId = organizationId（在 EnterpriseAgentProfile 中两者等价）
    const tenantId = organizationId

    // 查出企业 Owner，用于判断是否已配置模型
    const ownerUserId = await this.findOrgOwnerUserId(organizationId)

    const result: ProvisionResult = { provisioned: 0, skipped: 0, employees: [] }

    for (const config of employeeConfigs) {
      const employee = await this.ensureEmployee({
        organizationId,
        tenantId,
        role: config.role,
        displayName: config.displayName,
        ownerUserId,
      })
      result.employees.push(employee)
      if (employee.status === 'provisioned') result.provisioned++
      else result.skipped++
    }

    console.log(
      `[Provision] Plan ${plan.name} provisioned: ${result.provisioned} created, ${result.skipped} skipped`
    )
    return result
  }

  /**
   * 获取企业已 provision 的所有 AI 员工（含状态），用于工作台展示
   */
  async getProvisionedEmployees(organizationId: string): Promise<ProvisionedEmployeeDTO[]> {
    const profiles = await prisma.enterpriseAgentProfile.findMany({
      where: { organizationId },
      include: {
        modelBindings: { select: { id: true } },
        // EnterpriseAgentInstance 是关联表但模型名不同，走独立查询
      },
      orderBy: { createdAt: 'asc' },
    })

    // 批量查询 Instance
    const profileIds = profiles.map(p => p.id)
    const instances = await prisma.enterpriseAgentInstance.findMany({
      where: { employeeId: { in: profileIds } },
      select: { id: true, employeeId: true, runtimeStatus: true, lifecycleState: true },
    })
    const instanceMap = new Map(instances.map(i => [i.employeeId, i]))

    return profiles.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      department: JSON.parse(p.metadata || '{}').department || '',
      icon: '🤖',
      profileRuntimeStatus: p.runtimeStatus,
      hasModelBinding: p.modelBindings.length > 0,
      instanceId: instanceMap.get(p.id)?.id || null,
      instanceRuntimeStatus: instanceMap.get(p.id)?.runtimeStatus || null,
      instanceLifecycleState: instanceMap.get(p.id)?.lifecycleState || null,
    }))
  }

  /**
   * 检查并创建单个 AI 员工（幂等）
   */
  private async ensureEmployee(input: {
    organizationId: string
    tenantId: string
    role: string
    displayName: string
    ownerUserId?: string | null
  }): Promise<{ id: string; name: string; role: string; status: 'provisioned' | 'skipped' }> {
    // 幂等检查：按 organizationId + role 是否已有 profile
    const existing = await prisma.enterpriseAgentProfile.findFirst({
      where: { organizationId: input.organizationId, role: input.role },
    })
    if (existing) {
      // 已存在的员工如果还是 draft，尝试升级为 active（车主有模型配置时）
      if (existing.runtimeStatus === 'draft' && input.ownerUserId) {
        try {
          const activationResult = await enterpriseAgentRuntime.createAndActivateAgent({
            profileId: existing.id,
            tenantId: input.tenantId,
            organizationId: input.organizationId,
            name: existing.name,
            role: existing.role,
            agentType: existing.role,
            userId: input.ownerUserId,
          });
          if (activationResult.success) {
            console.log(`[Provision] Auto-activated existing employee: ${existing.name} (${existing.id})`)
          } else {
            console.log(`[Provision] Auto-activation failed for existing ${existing.name}: ${activationResult.error} ${JSON.stringify(activationResult.details || {})}`)
          }
        } catch (activateErr: any) {
          console.warn(`[Provision] Auto-activation skipped for existing ${existing.name}: ${activateErr.message}`)
        }
      }
      return { id: existing.id, name: existing.name, role: existing.role, status: 'skipped' }
    }

    // 查找模板：优先新模板体系 agent_template（code=role），回退旧体系 employee_template（role=role）
    // SPRINT-IDENTITY-REALITY-01: 05-C 已建 agent_template 10 岗位模板为权威，employee_template 为兼容旧数据
    let template: any = null
    try {
      template = await prisma.agentTemplate.findFirst({
        where: { code: input.role, status: 'active' },
        orderBy: { sortOrder: 'asc' },
      })
    } catch { /* agent_template 表不可用时忽略 */ }
    if (!template) {
      template = await prisma.employeeTemplate.findFirst({
        where: { role: input.role, isSystem: true },
        orderBy: { sortOrder: 'asc' },
      })
    }
    if (!template) {
      console.warn(`[Provision] Template not found for role: ${input.role}, skipping`)
      return { id: '', name: input.displayName, role: input.role, status: 'skipped' }
    }

    // 先创建员工为 draft（有模型配置再升级）
    const result = await employeeMarketplaceService.createEmployeeFromTemplate({
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      templateId: template.id,
      employeeName: input.displayName,
      initialRuntimeStatus: 'draft',
    })

    if (!result) {
      console.warn(`[Provision] Failed to create employee from template: role=${input.role}`)
      return { id: '', name: input.displayName, role: input.role, status: 'skipped' }
    }

    // Sprint-14 Step 4C: 如果 Owner 已配置模型，自动激活
    if (input.ownerUserId) {
      try {
        const activationResult = await enterpriseAgentRuntime.createAndActivateAgent({
          profileId: result.employeeId,
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          name: result.name,
          role: result.role,
          agentType: result.role,
          userId: input.ownerUserId,
        });
        if (activationResult.success) {
          console.log(`[Provision] Auto-activated employee: ${result.name} (${result.employeeId})`)
        } else {
          console.log(`[Provision] Auto-activation check for new ${result.name}: ${activationResult.error || 'unknown'}`)
        }
      } catch (activateErr: any) {
        console.warn(`[Provision] Auto-activation skipped for ${result.name}: ${activateErr.message}`)
        // 静默失败，员工保持 draft 等待用户手动激活
      }
    }

    return { id: result.employeeId, name: result.name, role: result.role, status: 'provisioned' }
  }

  // ─── Private: 查找企业 Owner 的 userId ───────────────────────

  private async findOrgOwnerUserId(organizationId: string): Promise<string | null> {
    try {
      const owner = await prisma.orgMember.findFirst({
        where: { organizationId, role: 'OWNER' },
        select: { userId: true },
      })
      return owner?.userId || null
    } catch {
      return null
    }
  }
}

export const enterpriseEmployeeProvisionService = new EnterpriseEmployeeProvisionService()
