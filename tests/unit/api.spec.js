import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError, createPostsApi, normalizePost } from '@/services/api.js'

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function stubFetch(implementation) {
  const fetchMock = vi.fn(implementation)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPostsApi', () => {
  it('使用默认的 /api 前缀请求列表', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ posts: [{ id: 'a', text: '你好', createdAt: 1 }] })
    )

    const posts = await createPostsApi().list()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}/posts`)
    expect(init.method).toBe('GET')
    expect(posts).toEqual([
      { id: 'a', text: '你好', createdAt: 1, likes: 0, liked: false, favorited: false }
    ])
  })

  it('允许注入自定义 baseUrl', async () => {
    const fetchMock = stubFetch(() => jsonResponse({ posts: [] }))

    await createPostsApi({ baseUrl: 'https://example.com/api' }).list()

    expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/api/posts')
  })

  it('列表响应缺少 posts 字段时返回空数组', async () => {
    stubFetch(() => jsonResponse({}))

    expect(await createPostsApi().list()).toEqual([])
  })

  it('创建内容时发送 JSON 请求体并返回新内容', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ post: { id: 'new', text: '新内容', createdAt: 2 } }, 201)
    )

    const post = await createPostsApi().create('新内容')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}/posts`)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ text: '新内容' })
    expect(post).toEqual({
      id: 'new',
      text: '新内容',
      createdAt: 2,
      likes: 0,
      liked: false,
      favorited: false
    })
  })

  it('删除内容时对 id 做 URL 编码，204 不解析响应体', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))

    await expect(createPostsApi().remove('a/b c')).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${API_BASE_URL}/posts/a%2Fb%20c`)
    expect(init.method).toBe('DELETE')
  })

  it('服务端校验失败时抛出带状态码与错误码的 ApiError', async () => {
    stubFetch(() =>
      jsonResponse(
        { error: { code: 'TEXT_TOO_LONG', message: '内容不能超过 280 个字符' } },
        422
      )
    )

    const error = await createPostsApi()
      .create('超长')
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(422)
    expect(error.code).toBe('TEXT_TOO_LONG')
    expect(error.message).toBe('内容不能超过 280 个字符')
  })

  it('网络异常时抛出 NETWORK_ERROR 并给出可读提示', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    const error = await createPostsApi()
      .list()
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toContain('无法连接服务')
  })

  it('错误响应不是 JSON 时使用兜底文案', async () => {
    stubFetch(() => new Response('Internal Server Error', { status: 500 }))

    const error = await createPostsApi()
      .list()
      .catch((caught) => caught)

    expect(error.status).toBe(500)
    expect(error.code).toBe('HTTP_ERROR')
    expect(error.message).toContain('500')
  })

  it('成功响应体不是合法 JSON 时抛出 INVALID_RESPONSE', async () => {
    stubFetch(() => new Response('not-json', { status: 200 }))

    const error = await createPostsApi()
      .list()
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_RESPONSE')
  })

  it('网关错误（502/503/504）映射为连接失败提示', async () => {
    stubFetch(() => new Response('Bad Gateway', { status: 502 }))

    const error = await createPostsApi()
      .list()
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toContain('无法连接服务')
  })

  it('创建响应缺少 post 字段时抛出 INVALID_RESPONSE', async () => {
    stubFetch(() => jsonResponse({}, 201))

    const error = await createPostsApi()
      .create('内容')
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_RESPONSE')
  })

  it('列表响应过滤掉缺少 id 的脏数据', async () => {
    stubFetch(() =>
      jsonResponse({
        posts: [{ id: 'a', text: '合法', createdAt: 1 }, { text: '没有 id' }]
      })
    )

    expect(await createPostsApi().list()).toEqual([
      { id: 'a', text: '合法', createdAt: 1, likes: 0, liked: false, favorited: false }
    ])
  })
})

describe('normalizePost', () => {
  it('补齐缺失的点赞与收藏字段', () => {
    expect(normalizePost({ id: 'a', text: '正文', createdAt: 1 })).toEqual({
      id: 'a',
      text: '正文',
      createdAt: 1,
      likes: 0,
      liked: false,
      favorited: false
    })
  })

  it('负数与非数字的计数按 0 处理，布尔字段严格转换', () => {
    const post = normalizePost({
      id: 'a',
      text: '脏数据',
      createdAt: 1,
      likes: -5,
      liked: 'yes',
      favorited: 1
    })

    expect(post.likes).toBe(0)
    expect(post.liked).toBe(false)
    expect(post.favorited).toBe(false)
  })

  it('小数计数向下取整', () => {
    expect(normalizePost({ id: 'a', likes: 2.7 }).likes).toBe(2)
  })
})

describe('createPostsApi 点赞与收藏', () => {
  it.each([
    ['like', 'POST'],
    ['unlike', 'DELETE'],
    ['favorite', 'POST'],
    ['unfavorite', 'DELETE']
  ])('%s 使用 %s 请求并按 /like 或 /favorite 拼路径', async (method, httpMethod) => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ post: { id: 'p1', text: '内容', createdAt: 1, likes: 1, liked: true } })
    )

    const post = await createPostsApi()[method]('p1')

    const [url, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe(httpMethod)
    expect(url).toMatch(/\/posts\/p1\/(like|favorite)$/)
    expect(post).toEqual({
      id: 'p1',
      text: '内容',
      createdAt: 1,
      likes: 1,
      liked: true,
      favorited: false
    })
  })

  it('点赞与收藏分别命中正确的路径', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ post: { id: 'p1', text: '内容', createdAt: 1 } })
    )
    const api = createPostsApi()

    await api.like('p1')
    await api.favorite('p1')

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/posts/p1/like`)
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE_URL}/posts/p1/favorite`)
  })

  it('对 id 做 URL 编码', async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse({ post: { id: 'a/b c', text: '内容', createdAt: 1 } })
    )

    await createPostsApi().favorite('a/b c')

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE_URL}/posts/a%2Fb%20c/favorite`
    )
  })

  it('响应缺少 post 字段时抛出 INVALID_RESPONSE', async () => {
    stubFetch(() => jsonResponse({}))

    const error = await createPostsApi()
      .like('p1')
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_RESPONSE')
  })

  it('服务端 404 时抛出携带错误码的 ApiError', async () => {
    stubFetch(() =>
      jsonResponse(
        { error: { code: 'POST_NOT_FOUND', message: '内容不存在或已被删除' } },
        404
      )
    )

    const error = await createPostsApi()
      .unlike('missing')
      .catch((caught) => caught)

    expect(error.status).toBe(404)
    expect(error.code).toBe('POST_NOT_FOUND')
  })
})
