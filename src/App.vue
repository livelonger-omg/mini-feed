<script setup>
import { computed, onMounted, ref } from 'vue'
import { MAX_LENGTH, usePostsStore } from '@/stores/posts.js'
import PostComposer from '@/components/PostComposer.vue'
import PostItem from '@/components/PostItem.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = usePostsStore()
const composerRef = ref(null)
// 'all' 展示全部内容，'favorites' 只展示已收藏的内容
const filter = ref('all')

const visiblePosts = computed(() =>
  filter.value === 'favorites' ? store.favoritePosts : store.posts
)
const showFavoritesEmpty = computed(
  () => filter.value === 'favorites' && store.favoriteCount === 0
)
const countLabel = computed(() =>
  filter.value === 'favorites' ? `${store.favoriteCount} 条收藏` : `${store.count} 条`
)
const connectionLabel = computed(() => {
  if (store.errorSource === 'load') return '连接异常'
  if (store.loading) return '连接中'
  return '服务端存储'
})
const connectionHint = computed(() =>
  store.errorSource === 'load'
    ? '无法连接后端服务，请检查服务是否已启动'
    : '内容保存在后端服务的内存中，服务重启后清空'
)
// 只有加载失败才能靠「重试」恢复，发布 / 删除失败需要用户重新操作
const canRetry = computed(() => store.errorSource === 'load')

onMounted(() => {
  store.load()
})

async function handleSubmit(text) {
  const post = await store.add(text)

  if (!post && store.error) {
    composerRef.value?.restoreDraft(text)
  }
}

async function handleDelete(id) {
  if (!window.confirm('确定删除这条内容吗？删除后无法恢复。')) return
  await store.remove(id)
}

function handleLike(id) {
  store.toggleLike(id)
}

function handleFavorite(id) {
  store.toggleFavorite(id)
}

function retry() {
  store.load()
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
      <span
        class="badge"
        data-testid="connection-badge"
        :title="connectionHint"
      >
        {{ connectionLabel }}
      </span>
    </div>
  </header>

  <main class="layout">
    <PostComposer
      ref="composerRef"
      :max-length="MAX_LENGTH"
      :submitting="store.submitting"
      @submit="handleSubmit"
    />

    <div
      v-if="store.error"
      class="notice notice--error"
      role="alert"
      data-testid="error-banner"
    >
      <span class="notice__text">{{ store.error }}</span>
      <span class="notice__actions">
        <button
          v-if="canRetry"
          class="notice__action"
          type="button"
          data-testid="retry-btn"
          @click="retry"
        >
          重试
        </button>
        <button
          class="notice__action"
          type="button"
          data-testid="dismiss-error-btn"
          @click="store.clearError()"
        >
          知道了
        </button>
      </span>
    </div>

    <section class="stream" aria-labelledby="stream-title">
      <div class="stream__head">
        <h2 id="stream-title" class="stream__title">信息流</h2>
        <div class="stream__side">
          <div class="filter" role="group" aria-label="筛选内容">
            <button
              class="filter__btn"
              :class="{ 'is-active': filter === 'all' }"
              type="button"
              data-testid="filter-all"
              :aria-pressed="filter === 'all'"
              @click="filter = 'all'"
            >
              全部
            </button>
            <button
              class="filter__btn"
              :class="{ 'is-active': filter === 'favorites' }"
              type="button"
              data-testid="filter-favorites"
              :aria-pressed="filter === 'favorites'"
              @click="filter = 'favorites'"
            >
              我的收藏
            </button>
          </div>
          <span class="stream__meta" data-testid="stream-count">{{ countLabel }}</span>
        </div>
      </div>

      <p
        v-if="store.loading && store.isEmpty"
        class="notice"
        role="status"
        aria-live="polite"
        data-testid="loading-state"
      >
        正在加载信息流…
      </p>

      <TransitionGroup
        v-else-if="!store.isEmpty && !showFavoritesEmpty"
        id="feed"
        tag="ul"
        name="feed"
        class="feed"
      >
        <PostItem
          v-for="post in visiblePosts"
          :key="post.id"
          :post="post"
          :deleting="store.isDeleting(post.id)"
          :liking="store.isLiking(post.id)"
          :favoriting="store.isFavoriting(post.id)"
          @delete="handleDelete"
          @like="handleLike"
          @favorite="handleFavorite"
        />
      </TransitionGroup>

      <p
        v-else-if="showFavoritesEmpty"
        class="notice"
        data-testid="favorites-empty"
      >
        还没有收藏的内容，点卡片上的星标就能收藏。
      </p>

      <EmptyState v-else-if="!store.error" />
    </section>
  </main>

  <footer class="footer">
    <p>内容保存在服务端内存中，服务重启后会清空。</p>
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

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-2);
  margin-top: var(--gap-3);
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-2);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

.notice--error {
  color: #ffd9d9;
  background: rgba(255, 107, 107, 0.12);
  border-color: rgba(255, 107, 107, 0.4);
}

.notice__text {
  min-width: 0;
}

.notice__actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.notice__action {
  flex: none;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background 0.2s var(--ease), border-color 0.2s var(--ease);
}

.notice__action:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.28);
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

.stream__side {
  display: flex;
  align-items: center;
  gap: var(--gap-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.filter {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.filter__btn {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: color 0.2s var(--ease), background 0.2s var(--ease);
}

.filter__btn:hover {
  color: var(--text-1);
}

.filter__btn.is-active {
  color: #0b0f14;
  background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
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
