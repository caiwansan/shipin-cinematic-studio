import re
p = 'pages/admin/tea/agent-applies.vue'
s = open(p).read()
if 'definePageMeta' in s:
    print('ALREADY')
else:
    old = '<script setup lang="ts">'
    new = '<script setup lang="ts">\ndefinePageMeta({ layout: \'admin-aigc\' })'
    assert old in s, 'ANCHOR MISS'
    s = s.replace(old, new, 1)
    open(p, 'w').write(s)
    print('LAYOUT_ADDED')
