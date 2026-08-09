import { prisma } from '../src/utils/index.js'
const caps = await prisma.ecologyRuntimeCapability.findMany({ select: { runtimeId: true, capability: true, status: true } })
console.log('runtimeCaps:', caps.length, JSON.stringify(caps.slice(0, 3)))
const defs = await prisma.agentDefinition.findMany({ select: { code: true, name: true } })
console.log('agentDefs:', defs.length)
process.exit(0)
