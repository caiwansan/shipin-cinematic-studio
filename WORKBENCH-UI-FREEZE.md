# WORKBENCH-UI-FREEZE
## 2026-06-24

### Frozen Scope (不再改动)
- Pipeline Definition (`shared/pipeline-definition.ts`)
- Sidebar Structure (`PipelineSidebar.vue`)
- Workspace Routing (`WorkspaceRenderer.vue`)
- Video Generation Layout (`VideoGenerationWorkspace.vue`)
- Frame Controls → 可选折叠
- Reference Images → 可选折叠
- 道具设定 → 已移除
- 剪辑视频入口 → 已移除
- 广告创作/音乐生成 → 已置底

### Unlocked Scope (待执行)
```
P0  TASK-WORKBENCH-PERSISTENCE-ROUNDTRIP-001
    before.json → close → after.json → diff.json

P1  TASK-VIDEO-GENERATION-AGENT-AUDIT-001
    分镜利用率 / 角色一致性 / 场景一致性 / 镜头语言 / Prompt损耗率

P2  TASK-VOICE-INFRA-RECOVERY-001
    voice_presets seeder → UI选择器 → TTS Key提示 → 功能恢复
```

### 工作台当前链路
```
📝 剧本分析 → 👤 角色设定 → 🏙️ 场景设定 → 🎨 分镜设计 → 🎥 视频生成 → ✨ 合成输出
                                                              ├─ 📷 参考图（可选折叠）
                                                              ├─ 🎬 帧图控制（可选折叠）
                                                              └─ 🤖 模型选择+AI优化+生成（常开）
                                        📺 广告创作（独立, 底部）
                                        🎵 音乐生成（独立, 底部）
```

### 已完成清理
| 项目 | 状态 |
|------|--------|
| shot-prompt-compiler.ts | ✅ 已删除（195行/74规则/0引用） |
| 道具设定 (props-design) | ✅ 已从 Pipeline 移除 |
| 剪辑视频入口 | ✅ 已从 Sidebar 移除 |
| 首尾帧前置链路 | ✅ 已降级为可选折叠 |
| 广告创作/音乐生成置底 | ✅ 已移至 final-render 之后 |
