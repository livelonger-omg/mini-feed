<script setup>
import { computed } from 'vue'
import { usePostsStore } from '@/stores/posts.js'
import PostComposer from '@/components/PostComposer.vue'
import PostItem from '@/components/PostItem.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = usePostsStore()

const countLabel = computed(() => `${store.count} 条`)
const storageLabel = computed(() => (store.storageAvailable ? '仅存本地' : '内存模式'))
const storageHint = computed(() =>
  store.storageAvailable
    ? '内容只保存在当前浏览器中，不会上传'
    : '浏览器本地存储不可用，本次内容仅在当前页面有效'
)

function handleSubmit(text) {
  store.add(text)
}

function handleDelete(id) {
  if (!window.confirm('确定删除这条内容吗？删除后无法恢复。')) return
  store.remove(id)
}
</script>

<template>
  <a class="skip-link" href="#feed">跳到信息流</a>

  <header class="topbar">
    <div class="topbar__inner">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✳</span>
        <span class="brand__text">
          <span class="brand__name">碎语</span>
          <span class="brand__sub">Chatter</span>
        </span>
      </div>
      <span class="badge" :title="storageHint">🔒 {{ storageLabel }}</span>
    </div>
  </header>

  <main class="layout">
    <PostComposer @submit="handleSubmit" />

    <section class="stream" aria-labelledby="stream-title">
      <div class="stream__head">
        <h2 id="stream-title" class="stream__title">信息流</h2>
        <span class="stream__meta" data-testid="stream-count">{{ countLabel }}</span>
      </div>

      <TransitionGroup v-if="!store.isEmpty" tag="ul" name="feed" class="feed">
        <PostItem
          v-for="post in store.posts"
          :key="post.id"
          :post="post"
          @delete="handleDelete"
        />
      </TransitionGroup>

      <EmptyState v-else />
    </section>
  </main>

  <footer class="footer">
    <p>数据保存在浏览器 Local Storage，清除浏览器数据即会丢失。</p>
  </footer>
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -60px;
  left: 50%;
  z-index: 20;
  padding: 10px 18px;
  font-size: 14px;
  color: #0b0f14;
  text-decoration: none;
  background: var(--accent-3);
  border-radius: var(--radius-pill);
  transform: translateX(-50%);
  transition: top 0.2s var(--ease);
}

.skip-link:focus-visible {
  top: 12px;
  outline-color: #fff;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(11, 15, 20, 0.66);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border-bottom: 1px solid var(--line);
}

.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-2);
  width: min(100% - 40px, var(--content-w));
  margin: 0 auto;
  padding: 14px 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand__mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  font-size: 16px;
  color: #0b0f14;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2) 62%, var(--accent-3));
  border-radius: 11px;
  box-shadow: 0 6px 18px rgba(91, 140, 255, 0.32);
}

.brand__text {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.brand__name {
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.2;
  background: linear-gradient(120deg, #ffffff, #c8d6ff 58%, #c9b6ff);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand__sub {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  white-space: nowrap;
}

.stream {
  margin-top: var(--gap-4);
}

.stream__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-2);
  padding: 0 4px var(--gap-2);
}

.stream__title {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.12em;
  color: var(--text-2);
}

.stream__meta {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-3);
}

.feed {
  display: flex;
  flex-direction: column;
  gap: var(--gap-2);
}

.feed-enter-active,
.feed-leave-active {
  transition: opacity 0.3s var(--ease), transform 0.3s var(--ease);
}

.feed-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.99);
}

.feed-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.feed-move {
  transition: transform 0.3s var(--ease);
}

.footer {
  width: min(100% - 40px, var(--content-w));
  margin: 0 auto;
  padding: var(--gap-4) 0 var(--gap-5);
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}

@media (max-width: 768px) {
  .topbar__inner,
  .footer {
    width: min(100% - 28px, var(--content-w));
  }

  .brand__name {
    font-size: 23px;
  }

  .brand__sub {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .topbar__inner {
    padding: 11px 0;
  }

  .badge {
    padding: 5px 10px;
    font-size: 11px;
  }
}
</style>
