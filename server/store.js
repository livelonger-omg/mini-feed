/**
 * 内存存储：进程内保存全部内容，重启即清空。
 * 内部数组始终按「新 → 旧」排列，索引 0 为最新一条。
 */
import { MAX_LENGTH, MAX_POSTS } from '../shared/limits.js'

export { MAX_LENGTH, MAX_POSTS }

function defaultCreateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 倒序比较器：只比较 createdAt。
 * 插入时总是放在数组头部，配合 Array.prototype.sort 的稳定性，
 * 同一毫秒创建的多条内容会按「后插入的在前」排列，顺序可预测。
 */
function compareDesc(a, b) {
  return b.createdAt - a.createdAt
}

export function createPostStore({
  limit = MAX_POSTS,
  now = Date.now,
  createId = defaultCreateId
} = {}) {
  let posts = []

  function list() {
    return posts.map((post) => ({ ...post }))
  }

  function get(id) {
    const found = posts.find((post) => post.id === id)

    return found ? { ...found } : undefined
  }

  function create(text) {
    const post = {
      id: createId(),
      text,
      createdAt: now(),
      likes: 0,
      liked: false,
      favorited: false
    }

    posts = [post, ...posts].sort(compareDesc).slice(0, limit)

    return { ...post }
  }

  /**
   * 切换单个布尔标记，返回更新后的副本；id 不存在时返回 undefined。
   * 已是目标状态时直接返回副本（幂等），likes 不会重复累加。
   * 只有 liked 会驱动 likes 计数，且结果永不为负。
   * 原位替换，不打乱既有的「新 → 旧」顺序。
   */
  function setFlag(id, key, value) {
    const index = posts.findIndex((post) => post.id === id)

    if (index === -1) return undefined

    const current = posts[index]

    if (current[key] === value) return { ...current }

    const next = { ...current, [key]: value }

    if (key === 'liked') {
      next.likes = Math.max(0, current.likes + (value ? 1 : -1))
    }

    posts = posts.map((post, i) => (i === index ? next : post))

    return { ...next }
  }

  function setLiked(id, liked) {
    return setFlag(id, 'liked', Boolean(liked))
  }

  function setFavorited(id, favorited) {
    return setFlag(id, 'favorited', Boolean(favorited))
  }

  function remove(id) {
    const next = posts.filter((post) => post.id !== id)

    if (next.length === posts.length) return false

    posts = next
    return true
  }

  function clear() {
    posts = []
  }

  return {
    list,
    get,
    create,
    setLiked,
    setFavorited,
    remove,
    clear,
    get size() {
      return posts.length
    }
  }
}
