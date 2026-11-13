import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_LENGTH, MAX_POSTS, usePostsStore } from '@/stores/posts.js'
import { STORAGE_KEY } from '@/services/storage.js'

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始化时从 Local Storage 读取历史内容', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'a', text: '较早', createdAt: 1 },
        { id: 'b', text: '较新', createdAt: 2 }
      ])
    )

    const store = usePostsStore()

    expect(store.count).toBe(2)
    expect(store.posts.map((post) => post.text)).toEqual(['较新', '较早'])
  })

  it('发布内容后置顶并写入本地存储', () => {
    const store = usePostsStore()

    const created = store.add('  第一条碎语  ')

    expect(created.text).toBe('第一条碎语')
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].id).toBe(created.id)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))[0].text).toBe(
      '第一条碎语'
    )
  })

  it('空白内容不会被发布', () => {
    const store = usePostsStore()

    expect(store.add('   ')).toBeNull()
    expect(store.add('')).toBeNull()
    expect(store.count).toBe(0)
  })

  it('超过字数上限的内容不会被发布', () => {
    const store = usePostsStore()

    expect(store.add('字'.repeat(MAX_LENGTH + 1))).toBeNull()
    expect(store.count).toBe(0)
  })

  it('恰好等于字数上限的内容可以发布', () => {
    const store = usePostsStore()

    expect(store.add('字'.repeat(MAX_LENGTH))).not.toBeNull()
    expect(store.count).toBe(1)
  })

  it('删除指定内容并同步本地存储', () => {
    const store = usePostsStore()
    const first = store.add('要被删除的')
    store.add('保留的')

    expect(store.remove(first.id)).toBe(true)
    expect(store.posts).toHaveLength(1)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toHaveLength(1)
  })

  it('删除不存在的 id 不会改变数据', () => {
    const store = usePostsStore()
    store.add('一条内容')

    expect(store.remove('missing-id')).toBe(false)
    expect(store.count).toBe(1)
  })

  it('条数超过上限时丢弃最旧的内容', () => {
    const store = usePostsStore()
    for (let i = 0; i < MAX_POSTS + 5; i += 1) {
      store.add(`第 ${i} 条`)
    }

    expect(store.count).toBe(MAX_POSTS)
    expect(store.posts[0].text).toBe(`第 ${MAX_POSTS + 4} 条`)
  })

  it('新实例可以读回上一次会话的内容', () => {
    const store = usePostsStore()
    store.add('持久化的内容')

    setActivePinia(createPinia())
    const reopened = usePostsStore()

    expect(reopened.posts[0].text).toBe('持久化的内容')
  })
})
