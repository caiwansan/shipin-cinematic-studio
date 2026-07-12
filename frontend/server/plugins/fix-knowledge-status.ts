// Nitro build-time hook: patch defineRenderHandler to return 200 for
// SPA routes that render valid HTML but get 404 status code
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:before', (ctx) => {
    const pathedPaths = ['/knowledge/', '/hdz/', '/mall/', '/workspace/legal/']
    const needsPatch = pathedPaths.some(p => ctx.event.path.startsWith(p))
    if (!ctx.response && needsPatch) {
      // Wrap render to intercept the response
      const originalRender = ctx.render
      ctx.render = async (event) => {
        const response = await originalRender(event)
        if (response && response.statusCode === 404 && response.body) {
          response.statusCode = 200
        }
        return response
      }
    }
  })
})
