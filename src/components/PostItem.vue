<script setup>
import { computed } from 'vue'
import { formatRelativeTime } from '@/utils/format.js'
import { gradientFor } from '@/utils/avatar.js'

const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  nickname: {
    type: String,
    default: '我'
  },
  now: {
    type: Number,
    default: () => Date.now()
  },
  deleting: {
    type: Boolean,
    default: false
  },
  liking: {
    type: Boolean,
    default: false
  },
  favoriting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['delete', 'like', 'favorite'])

const avatarStyle = computed(() => ({ background: gradientFor(props.post.id) }))
const timeLabel = computed(() => formatRelativeTime(props.post.createdAt, props.now))
// 兼容缺失 / 非法计数，避免渲染出 NaN 或负数
const likeCount = computed(() => {
  const count = Number(props.post.likes)

  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
})
const liked = computed(() => props.post.liked === true)
const favorited = computed(() => props.post.favorited === true)

function remove() {
  if (props.deleting) return
  emit('delete', props.post.id)
}

function like() {
  if (props.liking) return
  emit('like', props.post.id)
}

function favorite() {
  if (props.favoriting) return
  emit('favorite', props.post.id)
}
</script>

<template>
  <li class="item" data-testid="post-item">
    <div
      class="item__avatar"
      data-testid="post-avatar"
      aria-hidden="true"
      :style="avatarStyle"
    >
      {{ nickname.slice(0, 1) }}
    </div>

    <div class="item__body">
      <div class="item__head">
        <span class="item__name">{{ nickname }}</span>
        <time
          class="item__time"
          data-testid="post-time"
          :datetime="new Date(post.createdAt).toISOString()"
        >
          {{ timeLabel }}
        </time>
      </div>
      <p class="item__text" data-testid="post-text">{{ post.text }}</p>

      <div class="item__actions">
        <button
          class="action action--like"
          :class="{ 'is-active': liked }"
          data-testid="like-btn"
          type="button"
          :aria-pressed="liked"
          :aria-label="liked ? '取消点赞' : '点赞'"
          :title="liking ? '处理中…' : liked ? '取消点赞' : '点赞'"
          :disabled="liking"
          @click="like"
        >
          <svg
            viewBox="0 0 24 24"
            :fill="liked ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20s-7-4.3-7-9.2A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7 2.6C19 15.7 12 20 12 20z" />
          </svg>
          <span class="action__count" data-testid="like-count">{{ likeCount }}</span>
        </button>

        <button
          class="action action--favorite"
          :class="{ 'is-active': favorited }"
          data-testid="favorite-btn"
          type="button"
          :aria-pressed="favorited"
          :aria-label="favorited ? '取消收藏' : '收藏'"
          :title="favoriting ? '处理中…' : favorited ? '取消收藏' : '收藏'"
          :disabled="favoriting"
          @click="favorite"
        >
          <svg
            viewBox="0 0 24 24"
            :fill="favorited ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3.6l2.6 5.3 5.9.8-4.3 4.1 1.1 5.8-5.3-2.9-5.3 2.9 1.1-5.8L3.5 9.7l5.9-.8z" />
          </svg>
          <span class="action__label">{{ favorited ? '已收藏' : '收藏' }}</span>
        </button>
      </div>
    </div>

    <button
      class="item__delete"
      data-testid="delete-btn"
      type="button"
      :title="deleting ? '删除中…' : '删除'"
      :aria-label="deleting ? '正在删除这条内容' : '删除这条内容'"
      :disabled="deleting"
      @click="remove"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
        <path d="M10 11v5M14 11v5" />
      </svg>
    </button>
  </li>
</template>

<style scoped>
.item {
  position: relative;
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: var(--gap-2);
  padding: 18px 20px;
  background: linear-gradient(180deg, rgba(26, 34, 48, 0.7), rgba(19, 26, 34, 0.62));
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: transform 0.22s var(--ease), border-color 0.22s var(--ease),
    box-shadow 0.22s var(--ease), background 0.22s var(--ease);
}

.item:hover {
  transform: translateY(-2px);
  background: linear-gradient(180deg, rgba(30, 40, 56, 0.82), rgba(20, 28, 38, 0.7));
  border-color: var(--line-strong);
  box-shadow: var(--shadow-md);
}

.item__avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  color: #0a0e13;
  border-radius: 50%;
  user-select: none;
}

.item__body {
  min-width: 0;
}

.item__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.item__name {
  font-size: 14px;
  font-weight: 600;
}

.item__time {
  font-size: 12px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.item__text {
  margin-top: 4px;
  font-size: 17px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.item__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 4px 11px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: color 0.2s var(--ease), background 0.2s var(--ease),
    border-color 0.2s var(--ease), transform 0.2s var(--ease);
}

.action svg {
  width: 15px;
  height: 15px;
  flex: none;
  transition: transform 0.2s var(--ease);
}

.action:hover:not(:disabled) {
  color: var(--text-1);
  background: rgba(255, 255, 255, 0.085);
  border-color: var(--line);
}

.action:active:not(:disabled) svg {
  transform: scale(0.86);
}

.action:disabled {
  cursor: progress;
  opacity: 0.55;
}

/* 计数宽度固定，点赞 / 取消时按钮不会横向抖动 */
.action__count {
  min-width: 10px;
  font-variant-numeric: tabular-nums;
  text-align: left;
}

.action--like.is-active {
  color: var(--danger);
  background: rgba(255, 107, 107, 0.14);
  border-color: rgba(255, 107, 107, 0.32);
}

.action--favorite.is-active {
  color: var(--warn);
  background: rgba(240, 180, 41, 0.14);
  border-color: rgba(240, 180, 41, 0.34);
}

.item__delete {
  display: grid;
  place-items: center;
  align-self: start;
  width: 32px;
  height: 32px;
  color: var(--text-3);
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 0.2s var(--ease), transform 0.2s var(--ease),
    color 0.2s var(--ease), background 0.2s var(--ease);
}

.item:hover .item__delete,
.item:focus-within .item__delete,
.item__delete:focus-visible {
  opacity: 1;
  transform: scale(1);
}

.item__delete:hover {
  color: var(--danger);
  background: rgba(255, 107, 107, 0.12);
}

.item__delete svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .item {
    grid-template-columns: 38px 1fr auto;
    padding: 16px;
  }

  .item__avatar {
    width: 38px;
    height: 38px;
    font-size: 14px;
  }

  .item__text {
    font-size: 16px;
  }

  .item__delete {
    opacity: 0.7;
    transform: none;
    width: 36px;
    height: 36px;
  }
}

@media (max-width: 480px) {
  .item {
    grid-template-columns: 34px 1fr auto;
    gap: 10px;
    padding: 14px;
  }

  .item__avatar {
    width: 34px;
    height: 34px;
    font-size: 13px;
  }
}
</style>
