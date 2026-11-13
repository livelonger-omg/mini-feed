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
      createdAt: 1731000000000
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
