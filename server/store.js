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
    const post = { id: createId(), text, createdAt: now() }

    posts = [post, ...posts].sort(compareDesc).slice(0, limit)

    return { ...post }
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
    remove,
    clear,
    get size() {
      return posts.length
    }
  }
}
