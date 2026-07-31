/**
 * Recruitment Tool Mapper — Sprint-12 Task 03
 *
 * Bridges the gap between:
 *   EmployeeCapability.requiredTools (DB, naming convention A)
 *   ToolRegistry.tools              (Workflow engine, naming convention B)
 *
 * Architecture:
 *   Runtime resolveTools()
 *     ↓
 *   RecruitmentToolMapper.resolve()
 *     ↓
 *   ToolRegistry.getTool()
 *     ↓
 *   ToolDefinition[] → LLM context + audit
 */

// ⚠️ DEPRECATED — Sprint-RECRUITMENT-REALITY-04 T04 审计确认：全仓 0 外部引用（死代码）
// 保留原因：Phase5 治理原则（不删除文件，只标记），清理前需掌柜批准

export interface ToolMappingEntry {
  /** requiredTool name from EmployeeCapability */
  requiredTool: string
  /** Corresponding ToolRegistry tool name */
  registryTool: string
  /** Transformation hint for how to map params */
  description: string
}

/**
 * Complete mapping table: requiredTools → ToolRegistry tools
 *
 * Mapping rationale:
 *   - One capability may need multiple tools
 *   - One ToolRegistry tool may serve multiple required tools
 *   - E.g., analyze_candidate handles resume.parse, resume.read, candidate.score
 */
export const TOOL_MAPPING: ToolMappingEntry[] = [
  // ─── resume_analysis ──────────────────────────────
  { requiredTool: 'resume.parse',          registryTool: 'analyze_candidate', description: 'Parse/resume analysis' },
  { requiredTool: 'resume.read',           registryTool: 'read_recruitment_data', description: 'Read resume data via candidates' },

  // ─── candidate_search ─────────────────────────────
  { requiredTool: 'candidate.search',      registryTool: 'search_candidates', description: 'Search candidates by keyword/score' },
  { requiredTool: 'talent.search',         registryTool: 'search_candidates', description: 'Extended talent search' },

  // ─── interview_management ─────────────────────────
  { requiredTool: 'interview.create',      registryTool: 'create_hr_task', description: 'Create interview scheduling task' },
  { requiredTool: 'interview.read',        registryTool: 'read_recruitment_data', description: 'Read interview records' },

  // ─── job_publishing ───────────────────────────────
  { requiredTool: 'job.read',              registryTool: 'read_recruitment_data', description: 'Read job postings' },
  { requiredTool: 'job.publish',           registryTool: 'create_hr_task', description: 'Create job publishing task' },

  // ─── candidate_scoring ────────────────────────────
  { requiredTool: 'candidate.read',        registryTool: 'read_recruitment_data', description: 'Read candidate data' },
  { requiredTool: 'candidate.score',       registryTool: 'analyze_candidate', description: 'Score/evaluate candidate' },
  { requiredTool: 'recruitment.read.match',registryTool: 'read_recruitment_data', description: 'Read match records' },

  // ─── interview_evaluation ─────────────────────────
  { requiredTool: 'interview.evaluate',    registryTool: 'analyze_candidate', description: 'Evaluate interview result' },

  // ─── recruitment_report ───────────────────────────
  { requiredTool: 'recruitment.read.analytics', registryTool: 'read_recruitment_data', description: 'Read recruitment analytics' },
  { requiredTool: 'recruitment.generate.report', registryTool: 'generate_report', description: 'Generate recruitment report' },

  // ─── common / fallback ────────────────────────────
  { requiredTool: 'candidate.message',     registryTool: 'send_notification', description: 'Send message to candidate' },
  { requiredTool: 'social.read',           registryTool: 'read_recruitment_data', description: 'Read social/engagement data' },
  { requiredTool: 'social.reply',          registryTool: 'create_hr_task', description: 'Create social reply task' },
]

/**
 * Tool Mapper Service
 */
export class RecruitmentToolMapper {
  private mappingByName: Map<string, ToolMappingEntry> = new Map()
  private registryToolToRequired: Map<string, string[]> = new Map()

  constructor() {
    for (const entry of TOOL_MAPPING) {
      this.mappingByName.set(entry.requiredTool, entry)
      if (!this.registryToolToRequired.has(entry.registryTool)) {
        this.registryToolToRequired.set(entry.registryTool, [])
      }
      this.registryToolToRequired.get(entry.registryTool)!.push(entry.requiredTool)
    }
  }

  /**
   * Resolve a requiredTool name to its ToolRegistry counterpart.
   * Returns undefined if no mapping exists.
   */
  resolve(requiredTool: string): string | undefined {
    return this.mappingByName.get(requiredTool)?.registryTool
  }

  /**
   * Resolve a list of required tool names → unique ToolRegistry tool names.
   * Unmapped tools are preserved as-is for backward compatibility.
   */
  resolveAll(requiredTools: string[]): string[] {
    const resolved = new Set<string>()
    for (const tool of requiredTools) {
      const mapped = this.resolve(tool)
      resolved.add(mapped ?? tool)
    }
    return Array.from(resolved)
  }

  /**
   * Get all required tool names that map to a specific registry tool.
   */
  getRequiredToolsFor(registryTool: string): string[] {
    return this.registryToolToRequired.get(registryTool) ?? []
  }

  /**
   * Check if a requiredTool is mapped
   */
  hasMapping(requiredTool: string): boolean {
    return this.mappingByName.has(requiredTool)
  }
}

/** Singleton */
export const recruitmentToolMapper = new RecruitmentToolMapper()
