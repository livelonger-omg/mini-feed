/**
 * REST API 客户端：统一负责请求拼装、错误映射与响应解析。
 * 前端不再持有持久化数据，全部读写都走后端 /api。
 */
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api'

// 避免后端无响应时 loading 永远为真
const REQUEST_TIMEOUT = 10_000

const FALLBACK_ERROR_MESSAGE = '服务暂时不可用，请稍后重试'

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.cause = cause
  }
}

async function readPayload(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function isValidPost(post) {
  return Boolean(post) && typeof post.id === 'string' && post.id.length > 0
}

export function createPostsApi({ baseUrl = API_BASE_URL, fetchImpl } = {}) {
  const request = async (path, { method = 'GET', body } = {}) => {
    const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis)
    const init = { method, headers: { Accept: 'application/json' } }

    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      init.signal = AbortSignal.timeout(REQUEST_TIMEOUT)
    }

    let response

    try {
      response = await doFetch(`${baseUrl}${path}`, init)
    } catch (cause) {
      throw new ApiError('无法连接服务，请确认后端已启动', {
        code: 'NETWORK_ERROR',
        cause
      })
    }

    if (response.status === 204) return null

    const payload = await readPayload(response)

    if (!response.ok) {
      // 502/503/504 一般是反向代理连不上后端，对用户而言就是「服务没起来」
      if (response.status >= 502 && response.status <= 504) {
        throw new ApiError('无法连接服务，请确认后端已启动', {
          status: response.status,
          code: 'NETWORK_ERROR'
        })
      }

      throw new ApiError(
        payload?.error?.message ?? `请求失败（HTTP ${response.status}）`,
        {
          status: response.status,
          code: payload?.error?.code ?? 'HTTP_ERROR'
        }
      )
    }

    if (!payload) {
      throw new ApiError(FALLBACK_ERROR_MESSAGE, {
        status: response.status,
        code: 'INVALID_RESPONSE'
      })
    }

    return payload
  }

  return {
    async list() {
      const payload = await request('/posts')

      return Array.isArray(payload.posts) ? payload.posts.filter(isValidPost) : []
    },

    async create(text) {
      const payload = await request('/posts', { method: 'POST', body: { text } })

      if (!isValidPost(payload.post)) {
        throw new ApiError('服务返回的数据不完整，请稍后重试', {
          status: 201,
          code: 'INVALID_RESPONSE'
        })
      }

      return payload.post
    },

    async remove(id) {
      await request(`/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }
  }
}

export const postsApi = createPostsApi()
