<template>
  <div class="novel-coming-soon">
    <div class="novel-coming-soon-inner">
      <div class="novel-icon">📚</div>
      <h1 class="novel-title">免费小说</h1>
      <p class="novel-desc">更多精彩内容，敬请期待...</p>
      <a href="/" class="novel-back">← 返回首页</a>
    </div>
  </div>
</template>

<style scoped>
.novel-coming-soon {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f0e8;
}
.novel-coming-soon-inner {
  text-align: center;
}
.novel-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}
.novel-title {
  font-size: 1.8rem;
  color: #2a1f0e;
  margin-bottom: 12px;
}
.novel-desc {
  font-size: 1rem;
  color: #999;
  margin-bottom: 24px;
}
.novel-back {
  display: inline-block;
  padding: 10px 24px;
  background: #2a1f0e;
  color: #f5e6c8;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.15s;
}
.novel-back:hover {
  background: #3d2e1a;
}
</style>
