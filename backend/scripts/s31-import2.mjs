const mod = await import('../src/routes/skill-catalog.routes.js').catch(e => ({ error: e.message, stack: e.stack?.split('\n').slice(0, 5).join('\n') }))
console.log('route import:', mod.error ? 'FAIL: ' + mod.error + '\n' + (mod.stack || '') : 'OK: ' + Object.keys(mod).join(','))
process.exit(0)
