// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../server/app.js'
import { MAX_LENGTH, createPostStore } from '../../server/store.js'

let app

function send(path, { method = 'GET', body } = {}) {
  const initWithBody = body !== undefined

  return app.request(path, {
    method,
    headers: initWithBody ? { 'Content-Type': 'application/json' } : undefined,
    body: initWithBody
      ? typeof body === 'string'
        ? body
        : JSON.stringify(body)
      : undefined
  })
}

async function publish(text) {
  const response = await send('/api/posts', { method: 'POST', body: { text } })
  return { response, payload: await response.json() }
}

async function listTexts() {
  const response = await send('/api/posts')
  const payload = await response.json()
  return payload.posts.map((post) => post.text)
}

beforeEach(() => {
  app = createApp()
})

describe('GET /api/health', () => {
  it('返回服务健康状态', async () => {
    const response = await send('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/posts', () => {
  it('没有内容时返回空数组', async () => {
    const response = await send('/api/posts')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ posts: [] })
  })

  it('按创建时间倒序返回全部内容', async () => {
    const ordered = createApp({
      store: createPostStore({
        now: (() => {
          let tick = 0
          return () => {
            tick += 1
            return tick
          }
        })()
      })
    })

    app = ordered
    await publish('较早')
    await publish('较新')

    const response = await send('/api/posts')
    const { posts } = await response.json()

    expect(posts.map((post) => post.text)).toEqual(['较新', '较早'])
    expect(posts.every((post) => typeof post.id === 'string')).toBe(true)
    expect(posts.every((post) => typeof post.createdAt === 'number')).toBe(true)
  })
})

describe('时间戳相同的排序', () => {
  it('同一毫秒内创建的多条内容按后写入在前返回', async () => {
    app = createApp({ store: createPostStore({ now: () => 2000 }) })

    await publish('先写的')
    await publish('后写的')

    expect(await listTexts()).toEqual(['后写的', '先写的'])
  })
})

describe('POST /api/posts', () => {
  it('创建成功后返回 201、Location 头与完整内容', async () => {
    const { response, payload } = await publish('  第一 条  ')

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toBe(`/api/posts/${payload.post.id}`)
    expect(payload.post.text).toBe('第一 条')
    expect(typeof payload.post.createdAt).toBe('number')
    expect(await listTexts()).toEqual(['第一 条'])
  })

  it('创建后可以通过单条接口读回', async () => {
    const { payload } = await publish('可读回的内容')

    const response = await send(`/api/posts/${payload.post.id}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ post: payload.post })
  })

  it('空白内容返回 422 且不写入', async () => {
    const { response, payload } = await publish('   ')

    expect(response.status).toBe(422)
    expect(payload.error.code).toBe('TEXT_REQUIRED')
    expect(await listTexts()).toEqual([])
  })

  it('超过字数上限返回 422', async () => {
    const { response, payload } = await publish('字'.repeat(MAX_LENGTH + 1))

    expect(response.status).toBe(422)
    expect(payload.error.code).toBe('TEXT_TOO_LONG')
    expect(await listTexts()).toEqual([])
  })

  it('恰好等于字数上限可以发布', async () => {
    const { response, payload } = await publish('字'.repeat(MAX_LENGTH))

    expect(response.status).toBe(201)
    expect(payload.post.text).toHaveLength(MAX_LENGTH)
  })

  it('text 非字符串时返回 400', async () => {
    const numeric = await send('/api/posts', { method: 'POST', body: { text: 123 } })
    const missing = await send('/api/posts', { method: 'POST', body: {} })

    expect(numeric.status).toBe(400)
    expect((await numeric.json()).error.code).toBe('INVALID_BODY')
    expect(missing.status).toBe(400)
    expect((await missing.json()).error.code).toBe('INVALID_BODY')
    expect(await listTexts()).toEqual([])
  })

  it('非法 JSON 请求体返回 400', async () => {
    const response = await send('/api/posts', { method: 'POST', body: '{not-json' })

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_BODY')
  })

  it('请求体是数组时返回 400', async () => {
    const response = await send('/api/posts', { method: 'POST', body: ['hello'] })

    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe('INVALID_BODY')
  })

  it('请求体是 null / 字符串 / 数字时返回 400', async () => {
    for (const body of ['null', '"纯字符串"', '42']) {
      const response = await send('/api/posts', { method: 'POST', body })

      expect(response.status).toBe(400)
      expect((await response.json()).error.code).toBe('INVALID_BODY')
    }
  })

  it('请求体超出体积上限时返回 413 而不是先读入内存', async () => {
    const response = await send('/api/posts', {
      method: 'POST',
      body: { text: '字'.repeat(20000) }
    })

    expect(response.status).toBe(413)
    expect((await response.json()).error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('未显式声明 Content-Type 时仍能解析 JSON 请求体', async () => {
    const response = await app.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ text: '没有声明类型' })
    })

    expect(response.status).toBe(201)
    expect((await response.json()).post.text).toBe('没有声明类型')
  })

  it('超过条数上限时丢弃最旧的内容', async () => {
    app = createApp({ store: createPostStore({ limit: 2 }) })

    await publish('第一条')
    await publish('第二条')
    await publish('第三条')

    expect(await listTexts()).toEqual(['第三条', '第二条'])
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除成功后返回 204 且无响应体', async () => {
    const { payload } = await publish('待删除')

    const response = await send(`/api/posts/${payload.post.id}`, { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(await listTexts()).toEqual([])
  })

  it('删除不存在的内容返回 404', async () => {
    const response = await send('/api/posts/missing-id', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('POST_NOT_FOUND')
  })

  it('重复删除同一条内容，第二次返回 404', async () => {
    const { payload } = await publish('只能删一次')
    const path = `/api/posts/${payload.post.id}`

    expect((await send(path, { method: 'DELETE' })).status).toBe(204)
    expect((await send(path, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('GET /api/posts/:id', () => {
  it('内容不存在时返回 404', async () => {
    const response = await send('/api/posts/missing-id')

    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('POST_NOT_FOUND')
  })
})

describe('通用行为', () => {
  it('未知的 API 路径返回 404 NOT_FOUND', async () => {
    const response = await send('/api/unknown')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) }
    })
  })

  it('允许跨域访问并响应预检请求', async () => {
    const response = await send('/api/posts', {
      method: 'OPTIONS'
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-methods')).toContain('DELETE')
  })

  it('未预期的异常返回 500 JSON 错误体且不泄露内部细节', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    app = createApp({
      store: {
        list() {
          throw new Error('boom: 内部细节')
        },
        get: () => undefined,
        create: () => null,
        remove: () => false
      }
    })

    const response = await send('/api/posts')
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error.code).toBe('INTERNAL_ERROR')
    expect(payload.error.message).not.toContain('boom')
  })

  it('错误响应统一使用 error.code + error.message 结构', async () => {
    const tokens = await listTexts()
    expect(tokens).toEqual([])

    const response = await send('/api/posts', { method: 'POST', body: { text: '' } })
    const payload = await response.json()

    expect(payload.error).toEqual({
      code: 'TEXT_REQUIRED',
      message: expect.any(String)
    })
  })
})
