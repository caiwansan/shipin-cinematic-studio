// Auto-generated stub for legacy import
// Keep empty exports to satisfy existing imports
export type VisualPromptIR = any
export const validateIR = (ir: any) => ir
export type VPIRNode = any
export type VPIRGraph = any
export const createIR = (prompt: string): VisualPromptIR => ({ prompt })
export const serializeIR = (ir: VisualPromptIR): string => JSON.stringify(ir)
export const deserializeIR = (json: string): VisualPromptIR => JSON.parse(json)
