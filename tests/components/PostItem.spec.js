import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostItem from '@/components/PostItem.vue'

const NOW = new Date('2026-11-13T12:00:00+08:00').getTime()

function mountItem(post = {}) {
  return mount(PostItem, {
    props: {
      post: { id: 'post-1', text: '一条内容', createdAt: NOW - 5 * 60 * 1000, ...post },
      now: NOW
    }
  })
}

describe('PostItem', () => {
  it('渲染正文与相对时间', () => {
    const wrapper = mountItem()

    expect(wrapper.get('[data-testid="post-text"]').text()).toBe('一条内容')
    expect(wrapper.get('[data-testid="post-time"]').text()).toBe('5 分钟前')
  })

  it('正文中的 HTML 片段按纯文本渲染', () => {
    const wrapper = mountItem({ text: '<b>加粗</b>' })

    expect(wrapper.get('[data-testid="post-text"]').element.querySelector('b')).toBeNull()
    expect(wrapper.get('[data-testid="post-text"]').text()).toBe('<b>加粗</b>')
  })

  it('点击删除按钮抛出 delete 事件并携带 id', async () => {
    const wrapper = mountItem()

    await wrapper.get('[data-testid="delete-btn"]').trigger('click')

    expect(wrapper.emitted('delete')[0]).toEqual(['post-1'])
  })

  it('删除进行中时禁用删除按钮，避免重复点击', async () => {
    const wrapper = mount(PostItem, {
      props: { post: { id: 'post-1', text: '删除中', createdAt: NOW }, now: NOW, deleting: true }
    })

    const button = wrapper.get('[data-testid="delete-btn"]')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('头像取 id 生成的渐变背景', () => {
    const wrapper = mountItem()
    const avatar = wrapper.get('[data-testid="post-avatar"]').element

    expect(avatar.style.background).toContain('gradient')
  })
})

describe('PostItem 点赞与收藏', () => {
  it('缺少点赞字段时计数按 0 渲染', () => {
    const wrapper = mountItem()

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="like-btn"]').attributes('aria-pressed')).toBe(
      'false'
    )
    expect(
      wrapper.get('[data-testid="favorite-btn"]').attributes('aria-pressed')
    ).toBe('false')
  })

  it('渲染点赞数与激活态', () => {
    const wrapper = mountItem({ likes: 12, liked: true, favorited: true })

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('12')
    expect(wrapper.get('[data-testid="like-btn"]').attributes('aria-pressed')).toBe(
      'true'
    )
    expect(wrapper.get('[data-testid="like-btn"]').classes()).toContain('is-active')
    expect(
      wrapper.get('[data-testid="favorite-btn"]').attributes('aria-pressed')
    ).toBe('true')
    expect(wrapper.get('[data-testid="favorite-btn"]').classes()).toContain('is-active')
  })

  it('非法计数回退为 0，不渲染 NaN 或负数', () => {
    const wrapper = mountItem({ likes: -3 })

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('0')

    const nanWrapper = mountItem({ likes: 'many' })

    expect(nanWrapper.get('[data-testid="like-count"]').text()).toBe('0')
  })

  it('点击点赞按钮抛出 like 事件并携带 id', async () => {
    const wrapper = mountItem()

    await wrapper.get('[data-testid="like-btn"]').trigger('click')

    expect(wrapper.emitted('like')[0]).toEqual(['post-1'])
  })

  it('点击收藏按钮抛出 favorite 事件并携带 id', async () => {
    const wrapper = mountItem()

    await wrapper.get('[data-testid="favorite-btn"]').trigger('click')

    expect(wrapper.emitted('favorite')[0]).toEqual(['post-1'])
  })

  it('请求进行中时禁用按钮且不重复抛事件', async () => {
    const wrapper = mount(PostItem, {
      props: {
        post: { id: 'post-1', text: '处理中', createdAt: NOW },
        now: NOW,
        liking: true,
        favoriting: true
      }
    })

    const likeBtn = wrapper.get('[data-testid="like-btn"]')
    const favoriteBtn = wrapper.get('[data-testid="favorite-btn"]')

    expect(likeBtn.attributes('disabled')).toBeDefined()
    expect(favoriteBtn.attributes('disabled')).toBeDefined()

    await likeBtn.trigger('click')
    await favoriteBtn.trigger('click')

    expect(wrapper.emitted('like')).toBeUndefined()
    expect(wrapper.emitted('favorite')).toBeUndefined()
  })

  it('点赞不会影响删除按钮行为', async () => {
    const wrapper = mountItem()

    await wrapper.get('[data-testid="like-btn"]').trigger('click')

    expect(wrapper.emitted('delete')).toBeUndefined()
  })
})
