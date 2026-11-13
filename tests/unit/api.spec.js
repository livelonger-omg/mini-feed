import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError, createPostsApi } from '@/services/api.js'

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
    expect(posts).toEqual([{ id: 'a', text: '你好', createdAt: 1 }])
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
    expect(post).toEqual({ id: 'new', text: '新内容', createdAt: 2 })
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
      { id: 'a', text: '合法', createdAt: 1 }
    ])
  })
})
