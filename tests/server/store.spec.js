// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_POSTS, createPostStore } from '../../server/store.js'

/**
 * 构造可预测的 store：时间戳与 id 都由外部控制，
 * 这样「倒序」「同时间戳排序」这类行为可以被确定性地断言。
 */
function createDeterministicStore(options = {}) {
  let tick = 0
  let seq = 0

  return createPostStore({
    now: () => {
      tick += 1
      return tick
    },
    createId: () => `id-${++seq}`,
    ...options
  })
}

describe('createPostStore', () => {
  it('初始状态没有任何内容', () => {
    const store = createPostStore()

    expect(store.list()).toEqual([])
    expect(store.size).toBe(0)
    expect(store.get('missing')).toBeUndefined()
  })

  it('创建内容时生成 id 与毫秒时间戳', () => {
    const store = createPostStore({ now: () => 1731000000000, createId: () => 'fixed-id' })

    const post = store.create('  原样保存，不做校验  ')

    expect(post).toEqual({
      id: 'fixed-id',
      text: '  原样保存，不做校验  ',
      createdAt: 1731000000000,
      likes: 0,
      liked: false,
      favorited: false
    })
    expect(store.size).toBe(1)
    expect(store.list()).toEqual([post])
  })

  it('列表按 createdAt 倒序返回', () => {
    const store = createDeterministicStore()

    store.create('第一条')
    store.create('第二条')
    store.create('第三条')

    expect(store.list().map((post) => post.text)).toEqual([
      '第三条',
      '第二条',
      '第一条'
    ])
  })

  it('createdAt 相同时后写入的排在前面，顺序稳定', () => {
    const store = createPostStore({ now: () => 1000 })

    store.create('先写入')
    store.create('后写入')

    expect(store.list().map((post) => post.text)).toEqual(['后写入', '先写入'])
  })

  it('可以按 id 取回单条内容', () => {
    const store = createDeterministicStore()
    const created = store.create('可以被查到')

    expect(store.get(created.id)).toEqual(created)
    expect(store.get('missing-id')).toBeUndefined()
  })

  it('删除已存在的内容返回 true 并减少条数', () => {
    const store = createDeterministicStore()
    const created = store.create('待删除')
    store.create('保留')

    expect(store.remove(created.id)).toBe(true)
    expect(store.size).toBe(1)
    expect(store.list().map((post) => post.text)).toEqual(['保留'])
  })

  it('删除不存在的内容返回 false 且不改变数据', () => {
    const store = createDeterministicStore()
    store.create('唯一一条')

    expect(store.remove('missing-id')).toBe(false)
    expect(store.size).toBe(1)
  })

  it('超过上限时丢弃最旧的内容', () => {
    const store = createDeterministicStore({ limit: 3 })

    for (let i = 1; i <= 5; i += 1) {
      store.create(`第 ${i} 条`)
    }

    expect(store.size).toBe(3)
    expect(store.list().map((post) => post.text)).toEqual([
      '第 5 条',
      '第 4 条',
      '第 3 条'
    ])
  })

  it('默认上限为 300 条', () => {
    expect(MAX_POSTS).toBe(300)

    const store = createDeterministicStore()

    for (let i = 0; i < MAX_POSTS + 2; i += 1) {
      store.create(`第 ${i} 条`)
    }

    expect(store.size).toBe(MAX_POSTS)
    expect(store.list()[0].text).toBe(`第 ${MAX_POSTS + 1} 条`)
  })

  it('list 返回副本，外部修改不影响内部状态', () => {
    const store = createDeterministicStore()
    store.create('原始内容')

    const snapshot = store.list()
    snapshot.push({ id: 'injected', text: '注入', createdAt: 0 })
    snapshot[0].text = '被篡改'

    expect(store.size).toBe(1)
    expect(store.list()[0].text).toBe('原始内容')
  })

  it('get 返回副本，外部修改不影响内部状态', () => {
    const store = createDeterministicStore()
    const created = store.create('原始内容')

    const fetched = store.get(created.id)
    fetched.text = '被篡改'

    expect(store.get(created.id).text).toBe('原始内容')
  })

  it('create 返回的对象与内部状态隔离', () => {
    const store = createDeterministicStore()

    const created = store.create('原始内容')
    created.text = '被篡改'

    expect(store.list()[0].text).toBe('原始内容')
  })

  it('新建内容默认未被点赞、未收藏且点赞数为 0', () => {
    const store = createDeterministicStore()
    const post = store.create('默认状态')

    expect(post.likes).toBe(0)
    expect(post.liked).toBe(false)
    expect(post.favorited).toBe(false)
    expect(store.get(post.id)).toEqual(post)
  })

  it('点赞让 likes 递增，取消点赞后归零', () => {
    const store = createDeterministicStore()
    const { id, likes } = store.create('可以被点赞')

    expect(likes).toBe(0)

    const liked = store.setLiked(id, true)

    expect(liked.liked).toBe(true)
    expect(liked.likes).toBe(1)

    const unliked = store.setLiked(id, false)

    expect(unliked.liked).toBe(false)
    expect(unliked.likes).toBe(0)
  })

  it('重复点赞幂等，likes 不会叠加', () => {
    const store = createDeterministicStore()
    const { id } = store.create('重复点赞')

    store.setLiked(id, true)
    store.setLiked(id, true)

    expect(store.setLiked(id, true).likes).toBe(1)
  })

  it('取消未点赞的内容不会让 likes 变成负数', () => {
    const store = createDeterministicStore()
    const { id } = store.create('从未被点赞')

    expect(store.setLiked(id, false).likes).toBe(0)
    expect(store.setLiked(id, false).likes).toBe(0)
  })

  it('收藏开关独立于点赞', () => {
    const store = createDeterministicStore()
    const { id } = store.create('可以被收藏')

    const favorited = store.setFavorited(id, true)

    expect(favorited.favorited).toBe(true)
    expect(favorited.liked).toBe(false)
    expect(favorited.likes).toBe(0)

    expect(store.setFavorited(id, true).favorited).toBe(true)

    const cleared = store.setFavorited(id, false)

    expect(cleared.favorited).toBe(false)
    expect(cleared.likes).toBe(0)
  })

  it('setLiked / setFavorited 对未知 id 返回 undefined 且不改变数据', () => {
    const store = createDeterministicStore()
    store.create('唯一一条')

    expect(store.setLiked('missing-id', true)).toBeUndefined()
    expect(store.setFavorited('missing-id', true)).toBeUndefined()
    expect(store.size).toBe(1)
    expect(store.list()[0].liked).toBe(false)
    expect(store.list()[0].favorited).toBe(false)
  })

  it('内容被删除后再操作返回 undefined', () => {
    const store = createDeterministicStore()
    const { id } = store.create('待删除')

    store.remove(id)

    expect(store.setLiked(id, true)).toBeUndefined()
    expect(store.setFavorited(id, true)).toBeUndefined()
  })

  it('setLiked 返回副本，外部修改不影响内部状态', () => {
    const store = createDeterministicStore()
    const { id } = store.create('副本隔离')

    const liked = store.setLiked(id, true)
    liked.likes = 999
    liked.liked = false

    const current = store.get(id)

    expect(current.likes).toBe(1)
    expect(current.liked).toBe(true)
  })

  it('切换点赞后列表顺序与正文保持不变', () => {
    const store = createDeterministicStore()
    store.create('第一条')
    const second = store.create('第二条')

    store.setLiked(second.id, true)

    expect(store.list().map((post) => post.text)).toEqual(['第二条', '第一条'])
    expect(store.list()[0].liked).toBe(true)
  })

  it('clear 清空全部内容', () => {
    const store = createDeterministicStore()
    store.create('第一条')
    store.create('第二条')

    store.clear()

    expect(store.list()).toEqual([])
    expect(store.size).toBe(0)
  })

  it('默认 id 生成器产出互不相同的字符串', () => {
    const store = createDeterministicStore({ createId: undefined })

    const ids = new Set(
      Array.from({ length: 20 }, (_, index) => store.create(`第 ${index} 条`).id)
    )

    expect(ids.size).toBe(20)
  })
})
