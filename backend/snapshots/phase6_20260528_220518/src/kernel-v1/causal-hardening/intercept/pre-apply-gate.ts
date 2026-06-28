// causal-hardening/intercept/pre-apply-gate.ts — 阻断所有非法 mutation

export class KernelViolation extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? `[KERNEL_VIOLATION] ${code}`)
    this.name = 'KernelViolation'
    this.code = code
  }
}

export function preApplyGate(command: {
  source: string
  target: string
  type: string
  payload: { projectId?: string }
}) {
  // 1. 缺少 project scope
  if (!command.payload.projectId) {
    throw new KernelViolation('PROJECT_SCOPE_REQUIRED')
  }

  // 2. UI 不能直接 UPDATE 实体（只能创建/删除）
  if (command.source === 'UI' && command.type === 'ENTITY_UPDATE') {
    throw new KernelViolation('UI_MUTATION_FORBIDDEN')
  }

  // 3. UI 不能直接 DELETE 实体（必须通过 Agent）
  if (command.source === 'UI' && command.type === 'ENTITY_DELETE') {
    throw new KernelViolation('UI_DELETE_FORBIDDEN')
  }

  // 4. EventLog 是 kernel 内部只写目标，外部不可写入
  if (command.target === 'EventLog') {
    throw new KernelViolation('EVENTLOG_IS_WRITE_ONLY_KERNEL')
  }
}
