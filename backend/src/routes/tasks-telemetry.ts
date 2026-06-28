/**
 * tasks-telemetry.ts — 静默接收前端 FRE 埋点事件
 * 前端 provider-api.ts 通过 navigator.sendBeacon 发送到 /api/tasks/telemetry
 * 本端点仅返回 200，不做持久化存储
 */
export default async function tasksTelemetryRoutes(app: any) {
  // 前端埋点：无阻塞上报，仅接收不处理
  app.post('/api/tasks/telemetry', async (_request: any, reply: any) => {
    return reply.status(200).send({ success: true })
  })

  // OPTIONS for CORS preflight
  app.options('/api/tasks/telemetry', async (_request: any, reply: any) => {
    return reply.status(204).send()
  })
}
