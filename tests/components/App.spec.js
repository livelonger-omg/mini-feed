import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { STORAGE_KEY } from '@/services/storage.js'

function mountApp() {
  return mount(App, {
    global: { plugins: [createPinia()] }
  })
}

async function publish(wrapper, text) {
  await wrapper.get('[data-testid="post-input"]').setValue(text)
  await wrapper.get('[data-testid="publish-btn"]').trigger('click')
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('没有内容时展示空状态', () => {
    const wrapper = mountApp()

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('发布后内容出现在列表首位且空状态隐藏', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '第一条')

    const items = wrapper.findAll('[data-testid="post-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].get('[data-testid="post-text"]').text()).toBe('第一条')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="stream-count"]').text()).toBe('1 条')
  })

  it('多条内容按时间倒序排列', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '较早的')
    await publish(wrapper, '更新的')

    const texts = wrapper
      .findAll('[data-testid="post-text"]')
      .map((node) => node.text())
    expect(texts).toEqual(['更新的', '较早的'])
  })

  it('发布后写入 Local Storage，重新挂载仍可读回', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '持久化的内容')

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY))
    expect(stored[0].text).toBe('持久化的内容')
    expect(wrapper.emitted()).toBeTruthy()

    const reopened = mountApp()
    expect(reopened.get('[data-testid="post-text"]').text()).toBe('持久化的内容')
  })

  it('确认后删除内容并同步本地存储', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mountApp()

    await publish(wrapper, '要删除的')
    await wrapper.get('[data-testid="delete-btn"]').trigger('click')

    expect(wrapper.find('[data-testid="post-item"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY))).toEqual([])
  })

  it('取消删除时保留内容', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mountApp()

    await publish(wrapper, '保留的')
    await wrapper.get('[data-testid="delete-btn"]').trigger('click')

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
  })
})
