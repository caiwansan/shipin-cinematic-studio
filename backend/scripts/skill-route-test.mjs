const mod = await import('../src/routes/skill-catalog.routes.js').catch(e => ({ error: e.message }))
console.log('import result:', mod.error ? 'FAIL: ' + mod.error : 'OK, exports: ' + Object.keys(mod).join(','))
process.exit(0)
