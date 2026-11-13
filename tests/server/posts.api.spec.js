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

/** 点赞 / 收藏：action 为 like 或 favorite，method 为 POST 或 DELETE。 */
async function toggle(id, action, method) {
  const response = await send(`/api/posts/${id}/${action}`, { method })

  return { response, payload: await response.json() }
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

describe('POST /api/posts/:id/like', () => {
  it('点赞成功返回 200 与最新的 Post', async () => {
    const { payload: created } = await publish('值得点赞')
    const { response, payload } = await toggle(created.post.id, 'like', 'POST')

    expect(response.status).toBe(200)
    expect(payload.post.liked).toBe(true)
    expect(payload.post.likes).toBe(1)
    expect(payload.post.text).toBe('值得点赞')
    expect(payload.post.favorited).toBe(false)
  })

  it('重复点赞幂等，likes 恒为 1', async () => {
    const { payload: created } = await publish('重复点赞')
    const path = created.post.id

    await toggle(path, 'like', 'POST')
    const { response, payload } = await toggle(path, 'like', 'POST')

    expect(response.status).toBe(200)
    expect(payload.post.likes).toBe(1)
  })

  it('取消点赞返回 200 且 likes 归零', async () => {
    const { payload: created } = await publish('先赞后取消')
    const path = created.post.id

    await toggle(path, 'like', 'POST')
    const { response, payload } = await toggle(path, 'like', 'DELETE')

    expect(response.status).toBe(200)
    expect(payload.post.liked).toBe(false)
    expect(payload.post.likes).toBe(0)
  })

  it('重复取消点赞幂等，likes 不会变成负数', async () => {
    const { payload: created } = await publish('没被点过赞')
    const path = created.post.id

    const first = await toggle(path, 'like', 'DELETE')
    const second = await toggle(path, 'like', 'DELETE')

    expect(first.payload.post.likes).toBe(0)
    expect(second.response.status).toBe(200)
    expect(second.payload.post.likes).toBe(0)
  })

  it('内容不存在时返回 404 POST_NOT_FOUND', async () => {
    const posted = await toggle('missing-id', 'like', 'POST')
    const deleted = await toggle('missing-id', 'like', 'DELETE')

    expect(posted.response.status).toBe(404)
    expect(posted.payload.error.code).toBe('POST_NOT_FOUND')
    expect(deleted.response.status).toBe(404)
    expect(deleted.payload.error.code).toBe('POST_NOT_FOUND')
  })

  it('点赞后单条与列表接口都反映最新状态', async () => {
    const { payload: created } = await publish('状态同步')
    const id = created.post.id

    await toggle(id, 'like', 'POST')

    const single = await send(`/api/posts/${id}`)
    const listed = await send('/api/posts')

    expect((await single.json()).post.liked).toBe(true)
    expect((await listed.json()).posts[0].likes).toBe(1)
  })

  it('点赞不改变正文、createdAt 与列表顺序', async () => {
    const { payload: first } = await publish('第一条')
    const { payload: second } = await publish('第二条')

    await toggle(first.post.id, 'like', 'POST')

    const post = (await (await send(`/api/posts/${first.post.id}`)).json()).post

    expect(post.createdAt).toBe(first.post.createdAt)
    expect(await listTexts()).toEqual(['第二条', '第一条'])
  })
})

describe('POST /api/posts/:id/favorite', () => {
  it('收藏成功返回 200 且 favorited 为 true', async () => {
    const { payload: created } = await publish('值得收藏')
    const { response, payload } = await toggle(created.post.id, 'favorite', 'POST')

    expect(response.status).toBe(200)
    expect(payload.post.favorited).toBe(true)
    expect(payload.post.liked).toBe(false)
    expect(payload.post.likes).toBe(0)
  })

  it('重复收藏幂等', async () => {
    const { payload: created } = await publish('重复收藏')
    const id = created.post.id

    await toggle(id, 'favorite', 'POST')
    const { payload } = await toggle(id, 'favorite', 'POST')

    expect(payload.post.favorited).toBe(true)
  })

  it('取消收藏返回 200 且 favorited 为 false，可重复调用', async () => {
    const { payload: created } = await publish('取消收藏')
    const id = created.post.id

    await toggle(id, 'favorite', 'POST')

    expect((await toggle(id, 'favorite', 'DELETE')).payload.post.favorited).toBe(false)
    expect((await toggle(id, 'favorite', 'DELETE')).payload.post.favorited).toBe(false)
  })

  it('内容不存在时返回 404 POST_NOT_FOUND', async () => {
    expect((await toggle('missing-id', 'favorite', 'POST')).response.status).toBe(404)
    expect((await toggle('missing-id', 'favorite', 'DELETE')).response.status).toBe(404)
  })
})

describe('Post 字段完整性', () => {
  it('新发布的内容带齐点赞与收藏字段', async () => {
    const { payload } = await publish('字段检查')

    expect(payload.post).toMatchObject({ likes: 0, liked: false, favorited: false })
  })

  it('列表与单条接口均返回完整字段', async () => {
    const { payload: created } = await publish('字段检查')
    const listed = (await (await send('/api/posts')).json()).posts[0]
    const single = (await (await send(`/api/posts/${created.post.id}`)).json()).post

    for (const post of [listed, single]) {
      expect(post.likes).toBe(0)
      expect(post.liked).toBe(false)
      expect(post.favorited).toBe(false)
    }
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
