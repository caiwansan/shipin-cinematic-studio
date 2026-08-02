/**
 * SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 Task 02 — 创建新媒体部门 AI 员工
 * 职责：补齐 media 域真实 AI 员工（Alice 内容运营主管），替代 Task08.1 误绑的 Career Agent
 * 幂等：profile 按 (tenantId, name) 查重；instance 按 employeeId 查重；binding 按 (agentInstanceId, channelAccountId) 查重
 */
import { prisma } from '../src/utils/index.js'

async function main() {
  const tenantId = '9af5f6bd-8bcc-4187-aaf7-8909e2122d7e' // 昆仑镜验收测试企业 tenant
  const organizationId = '11111111-2222-4333-8444-555555555555' // 昆仑镜验收测试企业（gov org）

  // 1. media 域 profile：Alice 内容运营主管
  let alice = await prisma.enterpriseAgentProfile.findFirst({
    where: { tenantId, name: 'Alice' },
  })
  if (!alice) {
    alice = await prisma.enterpriseAgentProfile.create({
      data: {
        tenantId,
        organizationId,
        name: 'Alice',
        role: '新媒体运营主管',
        agentType: 'media_operator',
        businessType: 'media',
        description: '新媒体运营部门主管：统筹内容计划、账号运营与数据复盘',
        goal: '让品牌在抖音/小红书/公众号持续被看到、被喜欢、被信任',
        knowledgeScope: JSON.stringify(['新媒体运营', '内容策略', '账号运营', '数据分析']),
        tools: JSON.stringify(['browser_workspace', 'content_planning', 'data_analysis']),
        permissions: JSON.stringify(['read', 'publish', 'reply', 'analyze']),
        capabilities: JSON.stringify(['内容规划', '账号运营', '数据复盘', '团队协调']),
        status: 'active',
        runtimeStatus: 'active',
        isDefault: false,
        metadata: '{"domain":"media","department":"新媒体运营部门"}',
      },
    })
    console.log('[Alice] profile created:', alice.id)
  } else {
    console.log('[Alice] profile exists:', alice.id, 'businessType=', alice.businessType)
    if (alice.businessType !== 'media') {
      await prisma.enterpriseAgentProfile.update({
        where: { id: alice.id },
        data: { businessType: 'media' },
      })
      console.log('[Alice] businessType 已修正为 media')
    }
  }

  // 2. instance（幂等）
  let aliceInstance = await prisma.enterpriseAgentInstance.findUnique({
    where: { employeeId: alice.id },
  })
  if (!aliceInstance) {
    const shortId = alice.id.replace(/-/g, '').slice(0, 8)
    aliceInstance = await prisma.enterpriseAgentInstance.create({
      data: {
        tenantId,
        organizationId,
        employeeId: alice.id,
        agentId: `agent_${tenantId.slice(0, 8)}_${shortId}`,
        namespace: `tenant_${tenantId.slice(0, 8)}_media_operator`,
        runtime: 'enterprise',
        runtimeStatus: 'active',
        lifecycleState: 'ACTIVE',
        totalTasks: 0,
        totalErrors: 0,
        metadata: '{"domain":"media","department":"新媒体运营部门"}',
      },
    })
    console.log('[Alice] instance created:', aliceInstance.id)
  } else {
    console.log('[Alice] instance exists:', aliceInstance.id)
  }

  // 3. 绑定 Alice → 抖音 workspace（当前 RUNNING 的 b27a2e1e）
  const ws = await prisma.browserWorkspace.findUnique({
    where: { channelAccountId: '08a0f643-fb0d-48d5-af18-ad87bd9a34fb' },
  })
  if (!ws) {
    console.log('[Alice] 抖音 workspace 不存在（08a0f643），跳过绑定')
    return
  }
  const existingBinding = await prisma.agentChannelBinding.findFirst({
    where: { agentInstanceId: aliceInstance.id, channelAccountId: ws.channelAccountId },
  })
  if (!existingBinding) {
    await prisma.agentChannelBinding.create({
      data: {
        tenantId,
        agentInstanceId: aliceInstance.id,
        channelAccountId: ws.channelAccountId,
        browserWorkspaceId: ws.id,
        permissions: { read: true, reply: true, publish: true, analyze: true },
        status: 'active',
      },
    })
    console.log('[Alice] binding created → workspace', ws.id)
  } else {
    console.log('[Alice] binding exists:', existingBinding.id)
  }

  // 4. 处理跨域污染绑定：Career Agent（f41b42ad 用户的AI职业助理）→ 抖音 workspace 的绑定置为 paused
  //    （保留审计痕迹，不删除；Owner View 域过滤后不再显示）
  const careerBindings = await prisma.agentChannelBinding.findMany({
    where: { status: 'active', browserWorkspaceId: ws.id },
  })
  for (const b of careerBindings) {
    const inst = await prisma.enterpriseAgentInstance.findUnique({ where: { id: b.agentInstanceId } })
    if (!inst) continue
    const prof = await prisma.enterpriseAgentProfile.findUnique({ where: { id: inst.employeeId } })
    const bt = prof?.businessType
    if (bt && bt !== 'media') {
      await prisma.agentChannelBinding.update({ where: { id: b.id }, data: { status: 'paused' } })
      console.log(`[DomainFix] career binding ${b.id} → paused（domain=${bt} ≠ media，防跨域污染）`)
    }
  }

  console.log('\n✅ 完成。Alice 媒体员工已就位：')
  console.log('  profile:', alice.id)
  console.log('  instance:', aliceInstance.id)
  console.log('  workspace:', ws.id, ws.status)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => process.exit(0))
