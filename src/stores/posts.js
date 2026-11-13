import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { postStorage } from '@/services/storage.js'

export const MAX_LENGTH = 280
export const MAX_POSTS = 300

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref(
    postStorage.read().sort((a, b) => b.createdAt - a.createdAt)
  )
  const storageAvailable = ref(postStorage.available)

  const count = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

  function persist() {
    postStorage.write(posts.value)
    storageAvailable.value = postStorage.available
  }

  function hydrate() {
    posts.value = postStorage.read().sort((a, b) => b.createdAt - a.createdAt)
    storageAvailable.value = postStorage.available
    return posts.value
  }

  function add(rawText) {
    const text = typeof rawText === 'string' ? rawText.trim() : ''

    if (!text || text.length > MAX_LENGTH) return null

    const post = {
      id: createId(),
      text,
      createdAt: Date.now()
    }

    posts.value = [post, ...posts.value].slice(0, MAX_POSTS)
    persist()
    return post
  }

  function remove(id) {
    const next = posts.value.filter((post) => post.id !== id)

    if (next.length === posts.value.length) return false

    posts.value = next
    persist()
    return true
  }

  return {
    posts,
    storageAvailable,
    count,
    isEmpty,
    add,
    remove,
    hydrate,
    persist
  }
})
