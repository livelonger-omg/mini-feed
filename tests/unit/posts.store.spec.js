import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_LENGTH, MAX_POSTS, usePostsStore } from '@/stores/posts.js'
import { ApiError, postsApi } from '@/services/api.js'

function makePost(id, text, createdAt) {
  return { id, text, createdAt }
}

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态为空且未加载', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.count).toBe(0)
    expect(store.isEmpty).toBe(true)
  })

  it('load 从接口拉取内容并按时间倒序排列', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([
      makePost('a', '较早', 1),
      makePost('b', '较新', 2)
    ])

    const store = usePostsStore()
    await store.load()

    expect(store.posts.map((post) => post.text)).toEqual(['较新', '较早'])
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('load 期间 loading 为 true', async () => {
    let release
    vi.spyOn(postsApi, 'list').mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const store = usePostsStore()
    const pending = store.load()

    expect(store.loading).toBe(true)

    release([])
    await pending

    expect(store.loading).toBe(false)
  })

  it('load 失败时记录错误信息并复位 loading', async () => {
    vi.spyOn(postsApi, 'list').mockRejectedValue(
      new ApiError('无法连接服务，请确认后端已启动')
    )

    const store = usePostsStore()
    await store.load()

    expect(store.error).toBe('无法连接服务，请确认后端已启动')
    expect(store.loading).toBe(false)
    expect(store.posts).toEqual([])
  })

  it('并发调用 load 只发起一次请求', async () => {
    const listSpy = vi.spyOn(postsApi, 'list').mockResolvedValue([])

    const store = usePostsStore()
    await Promise.all([store.load(), store.load()])

    expect(listSpy).toHaveBeenCalledTimes(1)
  })

  it('重新 load 成功后清空错误状态', async () => {
    vi.spyOn(postsApi, 'list')
      .mockRejectedValueOnce(new ApiError('连接失败'))
      .mockResolvedValueOnce([])

    const store = usePostsStore()

    await store.load()
    expect(store.error).toBe('连接失败')

    await store.load()
    expect(store.error).toBe('')
  })

  it('发布内容时调用接口并把新内容置顶', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([makePost('old', '旧的', 1)])
    const createSpy = vi
      .spyOn(postsApi, 'create')
      .mockResolvedValue(makePost('new', '第一条碎语', 2))

    const store = usePostsStore()
    await store.load()

    const created = await store.add('  第一条碎语  ')

    expect(createSpy).toHaveBeenCalledWith('第一条碎语')
    expect(created).toEqual(makePost('new', '第一条碎语', 2))
    expect(store.posts.map((post) => post.text)).toEqual(['第一条碎语', '旧的'])
  })

  it('空白内容不会发起请求', async () => {
    const createSpy = vi.spyOn(postsApi, 'create')

    const store = usePostsStore()

    expect(await store.add('   ')).toBeNull()
    expect(await store.add('')).toBeNull()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('超过字数上限的内容不会发起请求', async () => {
    const createSpy = vi.spyOn(postsApi, 'create')

    const store = usePostsStore()

    expect(await store.add('字'.repeat(MAX_LENGTH + 1))).toBeNull()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('恰好等于字数上限可以发布', async () => {
    vi.spyOn(postsApi, 'create').mockResolvedValue(
      makePost('ok', '字'.repeat(MAX_LENGTH), 1)
    )

    const store = usePostsStore()

    expect(await store.add('字'.repeat(MAX_LENGTH))).not.toBeNull()
    expect(store.count).toBe(1)
  })

  it('发布失败时保留原列表并记录错误', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([makePost('old', '旧的', 1)])
    vi.spyOn(postsApi, 'create').mockRejectedValue(new ApiError('内容不能为空'))

    const store = usePostsStore()
    await store.load()

    expect(await store.add('会失败的内容')).toBeNull()
    expect(store.posts.map((post) => post.text)).toEqual(['旧的'])
    expect(store.error).toBe('内容不能为空')
    expect(store.submitting).toBe(false)
  })

  it('提交过程中重复发布只发起一次请求', async () => {
    let release
    const createSpy = vi.spyOn(postsApi, 'create').mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const store = usePostsStore()
    const first = store.add('第一次')
    const second = store.add('第二次')

    expect(store.submitting).toBe(true)
    expect(await second).toBeNull()

    release(makePost('a', '第一次', 1))
    await first

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(store.submitting).toBe(false)
  })

  it('删除内容后在列表中移除', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([
      makePost('a', '要删除的', 2),
      makePost('b', '保留的', 1)
    ])
    const removeSpy = vi.spyOn(postsApi, 'remove').mockResolvedValue(undefined)

    const store = usePostsStore()
    await store.load()

    expect(await store.remove('a')).toBe(true)
    expect(removeSpy).toHaveBeenCalledWith('a')
    expect(store.posts.map((post) => post.text)).toEqual(['保留的'])
  })

  it('删除失败时保留内容并记录错误', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([makePost('a', '保留的', 1)])
    vi.spyOn(postsApi, 'remove').mockRejectedValue(new ApiError('服务暂时不可用'))

    const store = usePostsStore()
    await store.load()

    expect(await store.remove('a')).toBe(false)
    expect(store.posts).toHaveLength(1)
    expect(store.error).toBe('服务暂时不可用')
  })

  it('删除时服务端返回 404 视为已删除', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([makePost('a', '已被别处删除', 1)])
    vi.spyOn(postsApi, 'remove').mockRejectedValue(
      new ApiError('内容不存在或已被删除', { status: 404, code: 'POST_NOT_FOUND' })
    )

    const store = usePostsStore()
    await store.load()

    expect(await store.remove('a')).toBe(true)
    expect(store.posts).toEqual([])
    expect(store.error).toBe('')
  })

  it('条数超过上限时丢弃最旧的内容', async () => {
    const serverPosts = Array.from({ length: MAX_POSTS }, (_, index) =>
      makePost(`id-${index}`, `第 ${MAX_POSTS - index} 条`, MAX_POSTS - index)
    )
    vi.spyOn(postsApi, 'list').mockResolvedValue(serverPosts)
    vi.spyOn(postsApi, 'create').mockResolvedValue(makePost('new', '最新一条', 99999))

    const store = usePostsStore()
    await store.load()

    await store.add('最新一条')

    expect(store.count).toBe(MAX_POSTS)
    expect(store.posts[0].text).toBe('最新一条')
  })

  it('加载在途时发布成功，迟到的列表响应不会覆盖新内容', async () => {
    let releaseLoad
    vi.spyOn(postsApi, 'list').mockReturnValue(
      new Promise((resolve) => {
        releaseLoad = resolve
      })
    )
    vi.spyOn(postsApi, 'create').mockResolvedValue(makePost('new', '刚发布的', 10))

    const store = usePostsStore()
    const pendingLoad = store.load()

    await store.add('刚发布的')

    releaseLoad([makePost('old', '服务端旧快照', 1)])
    await pendingLoad

    expect(store.posts.map((post) => post.text)).toEqual(['刚发布的'])
  })

  it('同一 id 重复删除只发起一次请求', async () => {
    vi.spyOn(postsApi, 'list').mockResolvedValue([makePost('a', '重复删', 1)])
    let release
    const removeSpy = vi.spyOn(postsApi, 'remove').mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const store = usePostsStore()
    await store.load()

    const first = store.remove('a')
    const second = store.remove('a')

    expect(await second).toBe(false)
    release()
    await first

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(store.posts).toEqual([])
  })

  it('用 errorSource 区分加载失败与操作失败', async () => {
    vi.spyOn(postsApi, 'list').mockRejectedValueOnce(new ApiError('加载失败'))

    const store = usePostsStore()
    await store.load()

    expect(store.errorSource).toBe('load')

    vi.spyOn(postsApi, 'create').mockRejectedValue(new ApiError('发布失败'))
    await store.add('会失败的')

    expect(store.errorSource).toBe('add')

    vi.spyOn(postsApi, 'list').mockResolvedValue([makePost('a', '待删除', 1)])
    await store.load()
    vi.spyOn(postsApi, 'remove').mockRejectedValue(new ApiError('删除失败'))
    await store.remove('a')

    expect(store.errorSource).toBe('remove')
  })

  it('load 开始时不提前清除错误，成功后才清空', async () => {
    vi.spyOn(postsApi, 'list').mockRejectedValueOnce(new ApiError('第一次失败'))

    const store = usePostsStore()
    await store.load()
    expect(store.error).toBe('第一次失败')

    let release
    postsApi.list.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const retrying = store.load()
    expect(store.error).toBe('第一次失败')

    release([])
    await retrying
    expect(store.error).toBe('')
  })

  it('clearError 可以手动清空错误提示', async () => {
    vi.spyOn(postsApi, 'list').mockRejectedValue(new ApiError('连接失败'))

    const store = usePostsStore()
    await store.load()

    store.clearError()

    expect(store.error).toBe('')
  })
})
