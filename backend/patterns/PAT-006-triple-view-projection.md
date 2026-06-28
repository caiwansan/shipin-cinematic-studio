# PAT-006: Triple View Projection

**适用场景：** 同一份数据需要在不同维度上展示不同的关系视图

## 问题

SceneGraph（空间关系）、EventGraph（事件关系）、Timeline（时间关系）本质上是同一组对象的三种观察维度。如果分别实现三个独立模块：
- 修改角色位置需要同时更新多个结构
- 一致性难以保证
- 新增视图需要大量重复代码

## 方案

```
Graph Kernel（Map<id, Node> + Edges — 一份统一数据）
    │
   ┌─┼─┐
   ▼ ▼ ▼
Scene  Event  Timeline
View   View   View（投影查询，不独立存储）
```

### 核心机制

1. **统一图数据**：一组 `Map<string, GraphNode>` + 一组 `GraphEdge[]`
2. **View Projectors**：每个视图是一个纯函数 `GraphRuntime → View`
   - `toSceneGraph()`：过滤 `spatialEdges` 相关的节点和边
   - `toEventGraph()`：过滤 `causalEdges` 相关的节点和边
   - `toTimeline()`：按时间顺序排列事件节点
3. **跨视图一致性检查**：`checkConsistency()` 确保各视图不冲突

### 示例

```typescript
const graph = new GraphRuntimeImpl()
graph.addNode(characterNode)
graph.addNode(locationNode)
graph.addEdge({ type: 'stands-in', source: charId, target: locId, ... })

const sceneView = graph.toSceneGraph()   // 只返回空间相关
const eventView = graph.toEventGraph()   // 只返回事件相关
const timeline = graph.toTimeline()       // 按时间排序

// 一致性检查
const issues = graph.checkConsistency()
```

## 约束

- 所有视图从同一份图数据派生，不独立维护存储
- 新增视图只需新增一个 View Projector 函数
- View 查询必须是确定性的（同一数据 → 同一视图）

## 相关模式

- PAT-001: Immutable Object（Graph 中的 Node 和 Edge 不可变）
