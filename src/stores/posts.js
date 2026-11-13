import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { postsApi } from '@/services/api.js'
import { MAX_LENGTH, MAX_POSTS } from '../../shared/limits.js'

export { MAX_LENGTH, MAX_POSTS }

function sortDesc(posts) {
  return posts.slice().sort((a, b) => b.createdAt - a.createdAt)
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([])
  const loading = ref(false)
  const submitting = ref(false)
  const deletingIds = ref([])
  const error = ref('')
  // 记录错误来源：只有加载失败才值得整体重试
  const errorSource = ref('')

  // 请求代次：发布 / 删除会推进代次，迟到的列表响应据此丢弃
  let generation = 0

  const count = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

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

  async function load() {
    if (loading.value) return posts.value

    const current = ++generation
    loading.value = true

    try {
      const remote = sortDesc(await postsApi.list()).slice(0, MAX_POSTS)

      if (current === generation) {
        posts.value = remote
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
      posts.value = [post, ...posts.value.filter((item) => item.id !== post.id)]
        .slice(0, MAX_POSTS)
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
    error,
    errorSource,
    count,
    isEmpty,
    isDeleting,
    load,
    add,
    remove,
    clearError
  }
})
