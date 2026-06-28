// ============================================================
// Validator Routes — Validate inputs/outputs against contracts
// API: /api/capability/validator/*
// ============================================================

import { capabilityValidator } from '../../../services/platform/capability/validators/capability-validator.js'
import { capabilityService } from '../../../services/platform/capability/capability.service.js'

export default async function validatorRoutes(fastify: any) {
  // Validate input against a contract
  fastify.post('/api/capability/validator/input', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.contractName || !body.input) {
      return reply.status(400).send({ success: false, error: 'contractName and input are required' })
    }

    const contract = await capabilityService.getByName(body.contractName)
    if (!contract) {
      return reply.status(404).send({ success: false, error: `Contract '${body.contractName}' not found` })
    }

    const result = capabilityValidator.validateInput(contract, body.input)
    return { success: true, data: result }
  })

  // Validate output against a contract
  fastify.post('/api/capability/validator/output', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.contractName || !body.output) {
      return reply.status(400).send({ success: false, error: 'contractName and output are required' })
    }

    const contract = await capabilityService.getByName(body.contractName)
    if (!contract) {
      return reply.status(404).send({ success: false, error: `Contract '${body.contractName}' not found` })
    }

    const result = capabilityValidator.validateOutput(contract, body.output)
    return { success: true, data: result }
  })

  // Full validation
  fastify.post('/api/capability/validator/validate', async (request: any, reply: any) => {
    const body = request.body as any
    if (!body.contractName) {
      return reply.status(400).send({ success: false, error: 'contractName is required' })
    }

    const contract = await capabilityService.getByName(body.contractName)
    if (!contract) {
      return reply.status(404).send({ success: false, error: `Contract '${body.contractName}' not found` })
    }

    const result = capabilityValidator.validateAll(contract, {
      input: body.input,
      output: body.output,
      constraints: body.constraints,
      permissions: body.permissions,
    })
    return { success: true, data: result }
  })
}
