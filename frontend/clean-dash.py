import re
p = 'pages/admin/dashboard.vue'
s = open(p).read()
# 删除残留的 flex-1 闭合（</template> 后多余的 </div>）
old = '      </template>\n      </div>\n    </div>\n\n    <!-- ═══ 详情抽屉'
new = '      </template>\n    </div>\n\n    <!-- ═══ 详情抽屉'
assert old in s, 'RESIDUE ANCHOR MISS'
s = s.replace(old, new, 1)
open(p, 'w').write(s)
# 验证
check = open(p).read()
ok = 'AgentApplyPanel' not in check and 'flex gap-3' not in check and 'flex-1 space-y' not in check and 'space-y-3"' in check
print('CLEANED' if ok else '!! STILL DIRTY')
