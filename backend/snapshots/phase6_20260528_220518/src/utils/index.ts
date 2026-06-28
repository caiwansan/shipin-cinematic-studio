import { PrismaClient } from '@prisma/client'
import { EventEmitter } from 'events'

export const prisma = new PrismaClient()
export { projectService } from '../services/project.service.js'
export const taskEventEmitter = new EventEmitter()
// 防止内存泄漏，最多 50 个 listener
taskEventEmitter.setMaxListeners(50)

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

