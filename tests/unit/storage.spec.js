import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, createPostStorage, isValidPost } from '@/services/storage.js'

function createFakeBackend(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
    removeItem: (key) => {
      delete data[key]
    }
  }
}

describe('isValidPost', () => {
  it('接受包含 id / text / createdAt 的对象', () => {
    expect(isValidPost({ id: 'a', text: '你好', createdAt: 1 })).toBe(true)
  })

  it('拒绝缺失字段或类型错误的记录', () => {
    expect(isValidPost(null)).toBe(false)
    expect(isValidPost({ id: 1, text: '你好', createdAt: 1 })).toBe(false)
    expect(isValidPost({ id: 'a', text: '你好' })).toBe(false)
    expect(isValidPost({ id: 'a', text: '你好', createdAt: '1' })).toBe(false)
  })
})

describe('postStorage', () => {
  it('没有历史数据时返回空数组', () => {
    const storage = createPostStorage(createFakeBackend())
    expect(storage.read()).toEqual([])
    expect(storage.available).toBe(true)
  })

  it('写入后可以原样读回', () => {
    const storage = createPostStorage(createFakeBackend())
    const posts = [{ id: 'a', text: '第一条', createdAt: 1731000000000 }]

    storage.write(posts)

    expect(storage.read()).toEqual(posts)
  })

  it('过滤结构不合法的脏数据', () => {
    const backend = createFakeBackend({
      [STORAGE_KEY]: JSON.stringify([
        { id: 'a', text: '合法', createdAt: 1 },
        { id: 'b', text: 123, createdAt: 2 },
        'oops'
      ])
    })

    expect(createPostStorage(backend).read()).toEqual([
      { id: 'a', text: '合法', createdAt: 1 }
    ])
  })

  it('JSON 损坏时返回空数组并清除损坏内容', () => {
    const backend = createFakeBackend({ [STORAGE_KEY]: '{not-json' })
    const storage = createPostStorage(backend)

    expect(storage.read()).toEqual([])
    expect(backend.getItem(STORAGE_KEY)).toBe(null)
  })

  it('写入失败时降级为内存存储且不抛错', () => {
    const backend = createFakeBackend()
    backend.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    const storage = createPostStorage(backend)
    const posts = [{ id: 'a', text: '内存里的内容', createdAt: 1 }]

    expect(() => storage.write(posts)).not.toThrow()
    expect(storage.available).toBe(false)
    expect(storage.read()).toEqual(posts)
  })

  it('本地存储完全不可用时仍能工作', () => {
    const backend = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      }
    }

    const storage = createPostStorage(backend)

    expect(storage.available).toBe(false)
    expect(storage.read()).toEqual([])
    expect(() => storage.write([{ id: 'a', text: '好', createdAt: 1 }])).not.toThrow()
    expect(storage.read()).toHaveLength(1)
  })

  it('默认使用浏览器 localStorage', () => {
    const storage = createPostStorage()
    storage.write([{ id: 'a', text: '默认后端', createdAt: 1 }])

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toHaveLength(1)
  })
})
