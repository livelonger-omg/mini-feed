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

  it('头像取 id 生成的渐变背景', () => {
    const wrapper = mountItem()
    const avatar = wrapper.get('[data-testid="post-avatar"]').element

    expect(avatar.style.background).toContain('gradient')
  })
})
