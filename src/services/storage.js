/**
 * 本地存储服务：把内容读写封装成可注入后端的小对象，
 * 存储不可用（隐私模式 / 配额溢出）时自动降级为内存存储。
 */
export const STORAGE_KEY = 'chatter.posts.v1'

const PROBE_KEY = '__chatter_probe__'

export function isValidPost(value) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.createdAt === 'number'
  )
}

function defaultBackend() {
  try {
    return globalThis.localStorage ?? null
  } catch (error) {
    return null
  }
}

export function createPostStorage(backend = defaultBackend()) {
  let available = false
  let memory = []

  if (backend) {
    try {
      backend.setItem(PROBE_KEY, '1')
      backend.removeItem(PROBE_KEY)
      available = true
    } catch (error) {
      available = false
    }
  }

  function read() {
    if (!available) return memory.slice()

    try {
      const raw = backend.getItem(STORAGE_KEY)
      if (!raw) return []

      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []

      return parsed.filter(isValidPost)
    } catch (error) {
      try {
        backend.removeItem(STORAGE_KEY)
      } catch (removeError) {
        /* 存储不可用，忽略 */
      }
      return []
    }
  }

  function write(posts) {
    const snapshot = Array.isArray(posts) ? posts.filter(isValidPost) : []
    memory = snapshot.slice()

    if (!available) return

    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch (error) {
      available = false
    }
  }

  function clear() {
    memory = []
    if (!available) return

    try {
      backend.removeItem(STORAGE_KEY)
    } catch (error) {
      /* 存储不可用，忽略 */
    }
  }

  return {
    read,
    write,
    clear,
    get available() {
      return available
    }
  }
}

export const postStorage = createPostStorage()
