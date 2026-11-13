import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { postsApi } from '@/services/api.js'
import { MAX_LENGTH, MAX_POSTS } from '../../shared/limits.js'

export { MAX_LENGTH, MAX_POSTS }

function sortDesc(posts) {
  return posts.slice().sort((a, b) => b.createdAt - a.createdAt)
}

/** 点赞数兜底：缺失或非法值一律按 0，且不出现负数。 */
function likeCountOf(post) {
  const num = Number(post?.likes)

  if (!Number.isFinite(num) || num < 0) return 0

  return Math.floor(num)
}

/**
 * 归一化：保证点赞 / 收藏三个字段始终存在且类型正确。
 * 除了渲染安全，也让失败回滚时的快照覆盖是完整的。
 */
function withCounters(post) {
  return {
    ...post,
    likes: likeCountOf(post),
    liked: post?.liked === true,
    favorited: post?.favorited === true
  }
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([])
  const loading = ref(false)
  const submitting = ref(false)
  const deletingIds = ref([])
  const likingIds = ref([])
  const favoritingIds = ref([])
  const error = ref('')
  // 记录错误来源：只有加载失败才值得整体重试
  const errorSource = ref('')

  // 请求代次：发布 / 删除会推进代次，迟到的列表响应据此丢弃
  let generation = 0

  const count = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)
  const favoritePosts = computed(() => posts.value.filter((post) => post.favorited))
  const favoriteCount = computed(() => favoritePosts.value.length)

  function clearError() {
    error.value = ''
    errorSource.value = ''
  }

  function fail(source, message) {
    error.value = message
    errorSource.value = source
  }

  function isDeleting(id) {
    return deletingIds.value.includes(id)
  }

  function isLiking(id) {
    return likingIds.value.includes(id)
  }

  function isFavoriting(id) {
    return favoritingIds.value.includes(id)
  }

  /** 局部更新一条内容，保持它在列表中的位置（不重排）。 */
  function patchPost(id, patch) {
    posts.value = posts.value.map((post) =>
      post.id === id ? { ...post, ...patch } : post
    )
  }

  /**
   * 点赞 / 收藏的通用流程：
   * 1. 先乐观更新本地状态，让点击立刻有反馈
   * 2. 用服务端返回值覆盖，保证本地与服务端一致
   * 3. 失败则回滚到操作前的值，并把错误交给统一错误横幅
   */
  async function toggleFlag({ id, pendingIds, api, patch, source }) {
    const target = posts.value.find((post) => post.id === id)

    if (!target || pendingIds.value.includes(id)) return false

    const before = withCounters(target)
    const next = { ...before, ...patch(target) }

    pendingIds.value = [...pendingIds.value, id]
    patchPost(id, next)

    try {
      const post = await api(id)

      patchPost(id, withCounters(post))
      clearError()

      return true
    } catch (failure) {
      patchPost(id, before)
      fail(source, failure.message)

      return false
    } finally {
      pendingIds.value = pendingIds.value.filter((pendingId) => pendingId !== id)
    }
  }

  function toggleLike(id) {
    if (!posts.value.some((post) => post.id === id)) return false

    const liked = Boolean(posts.value.find((post) => post.id === id).liked)

    return toggleFlag({
      id,
      pendingIds: likingIds,
      api: liked ? postsApi.unlike : postsApi.like,
      patch: (post) => ({
        liked: !liked,
        likes: Math.max(0, likeCountOf(post) + (liked ? -1 : 1))
      }),
      source: 'like'
    })
  }

  function toggleFavorite(id) {
    if (!posts.value.some((post) => post.id === id)) return false

    const favorited = Boolean(posts.value.find((post) => post.id === id).favorited)

    return toggleFlag({
      id,
      pendingIds: favoritingIds,
      api: favorited ? postsApi.unfavorite : postsApi.favorite,
      patch: () => ({ favorited: !favorited }),
      source: 'favorite'
    })
  }

  async function load() {
    if (loading.value) return posts.value

    const current = ++generation
    loading.value = true

    try {
      const remote = sortDesc(await postsApi.list()).slice(0, MAX_POSTS)

      if (current === generation) {
        posts.value = remote.map(withCounters)
        clearError()
      }
    } catch (failure) {
      if (current === generation) fail('load', failure.message)
    } finally {
      loading.value = false
    }

    return posts.value
  }

  async function add(rawText) {
    const text = typeof rawText === 'string' ? rawText.trim() : ''

    if (!text || text.length > MAX_LENGTH) return null
    if (submitting.value) return null

    submitting.value = true

    try {
      const post = await postsApi.create(text)

      generation += 1
      posts.value = [
        withCounters(post),
        ...posts.value.filter((item) => item.id !== post.id)
      ].slice(0, MAX_POSTS)
      clearError()

      return post
    } catch (failure) {
      fail('add', failure.message)
      return null
    } finally {
      submitting.value = false
    }
  }

  async function remove(id) {
    if (!id || isDeleting(id)) return false

    deletingIds.value = [...deletingIds.value, id]

    try {
      await postsApi.remove(id)
      generation += 1
      posts.value = posts.value.filter((post) => post.id !== id)
      clearError()

      return true
    } catch (failure) {
      // 服务端已经没有这条内容时，按删除成功处理，保证本地与服务端一致
      if (failure.status === 404) {
        generation += 1
        posts.value = posts.value.filter((post) => post.id !== id)
        clearError()

        return true
      }

      fail('remove', failure.message)
      return false
    } finally {
      deletingIds.value = deletingIds.value.filter((pendingId) => pendingId !== id)
    }
  }

  return {
    posts,
    loading,
    submitting,
    deletingIds,
    likingIds,
    favoritingIds,
    error,
    errorSource,
    count,
    isEmpty,
    favoritePosts,
    favoriteCount,
    isDeleting,
    isLiking,
    isFavoriting,
    load,
    add,
    remove,
    toggleLike,
    toggleFavorite,
    clearError
  }
})
