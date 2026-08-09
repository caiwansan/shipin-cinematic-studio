const mod = await import('../src/ecosystem/skill-manifest-adapter.js').catch(e => ({ error: e.message }))
console.log('adapter import:', mod.error ? 'FAIL: ' + mod.error : 'OK, exports: ' + Object.keys(mod).join(','))
if (!mod.error) {
  const skills = await mod.listSkills()
  console.log('listSkills count:', skills.length)
  console.log('first 3:', JSON.stringify(skills.slice(0, 3)))
}
process.exit(0)
