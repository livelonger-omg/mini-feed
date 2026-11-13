import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import { ApiError, postsApi } from '@/services/api.js'

function mountApp() {
  return mount(App, {
    global: { plugins: [createPinia()] }
  })
}

async function publish(wrapper, text) {
  await wrapper.get('[data-testid="post-input"]').setValue(text)
  await wrapper.get('[data-testid="publish-btn"]').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  vi.spyOn(postsApi, 'list').mockResolvedValue([])
  vi.spyOn(postsApi, 'create').mockResolvedValue({
    id: 'created',
    text: '默认内容',
    createdAt: 1
  })
  vi.spyOn(postsApi, 'remove').mockResolvedValue(undefined)
})

describe('App 初次加载', () => {
  it('挂载时展示加载提示，加载完成后展示空状态', async () => {
    let release
    postsApi.list.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      })
    )

    const wrapper = mountApp()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="loading-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)

    release([])
    await flushPromises()

    expect(wrapper.find('[data-testid="loading-state"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('展示服务端返回的内容并按倒序排列', async () => {
    postsApi.list.mockResolvedValue([
      { id: 'a', text: '较早的内容', createdAt: 1 },
      { id: 'b', text: '较新的内容', createdAt: 2 }
    ])

    const wrapper = mountApp()
    await flushPromises()

    const texts = wrapper
      .findAll('[data-testid="post-text"]')
      .map((node) => node.text())

    expect(texts).toEqual(['较新的内容', '较早的内容'])
    expect(wrapper.get('[data-testid="stream-count"]').text()).toBe('2 条')
    expect(wrapper.get('[data-testid="connection-badge"]').text()).toContain('服务端')
  })

  it('加载失败时展示错误提示，点击重试后恢复', async () => {
    postsApi.list.mockRejectedValueOnce(
      new ApiError('无法连接服务，请确认后端已启动')
    )

    const wrapper = mountApp()
    await flushPromises()

    const banner = wrapper.get('[data-testid="error-banner"]')
    expect(banner.text()).toContain('无法连接服务')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)

    postsApi.list.mockResolvedValue([{ id: 'a', text: '重试成功', createdAt: 1 }])
    await wrapper.get('[data-testid="retry-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="post-text"]').text()).toBe('重试成功')
  })
})

describe('App 发布', () => {
  it('发布成功后内容出现在列表首位且空状态隐藏', async () => {
    postsApi.create.mockResolvedValue({ id: 'new', text: '第一条', createdAt: 3 })

    const wrapper = mountApp()
    await flushPromises()
    await publish(wrapper, '第一条')

    const items = wrapper.findAll('[data-testid="post-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].get('[data-testid="post-text"]').text()).toBe('第一条')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="stream-count"]').text()).toBe('1 条')
    expect(postsApi.create).toHaveBeenCalledWith('第一条')
  })

  it('发布后清空输入框', async () => {
    postsApi.create.mockResolvedValue({ id: 'new', text: '发布成功', createdAt: 3 })

    const wrapper = mountApp()
    await flushPromises()
    await publish(wrapper, '发布成功')

    expect(wrapper.get('[data-testid="post-input"]').element.value).toBe('')
  })

  it('发布失败时展示错误并恢复草稿', async () => {
    postsApi.create.mockRejectedValue(new ApiError('内容不能超过 280 个字符'))

    const wrapper = mountApp()
    await flushPromises()
    await publish(wrapper, '会失败的草稿')

    expect(wrapper.get('[data-testid="error-banner"]').text()).toContain(
      '内容不能超过 280 个字符'
    )
    expect(wrapper.get('[data-testid="post-input"]').element.value).toBe('会失败的草稿')
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('多条内容按服务端返回顺序展示，新内容置顶', async () => {
    postsApi.list.mockResolvedValue([{ id: 'a', text: '较早的', createdAt: 1 }])
    postsApi.create.mockResolvedValue({ id: 'b', text: '更新的', createdAt: 2 })

    const wrapper = mountApp()
    await flushPromises()
    await publish(wrapper, '更新的')

    const texts = wrapper
      .findAll('[data-testid="post-text"]')
      .map((node) => node.text())

    expect(texts).toEqual(['更新的', '较早的'])
  })
})

describe('App 删除', () => {
  it('确认后调用接口并移除内容', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    postsApi.list.mockResolvedValue([{ id: 'a', text: '要删除的', createdAt: 1 }])
    postsApi.remove.mockResolvedValue(undefined)

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('[data-testid="delete-btn"]').trigger('click')
    await flushPromises()

    expect(postsApi.remove).toHaveBeenCalledWith('a')
    expect(wrapper.find('[data-testid="post-item"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('取消删除时保留内容且不发起请求', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    postsApi.list.mockResolvedValue([{ id: 'a', text: '保留的', createdAt: 1 }])

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('[data-testid="delete-btn"]').trigger('click')
    await flushPromises()

    expect(postsApi.remove).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
  })

  it('删除失败时保留内容并提示错误', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    postsApi.list.mockResolvedValue([{ id: 'a', text: '删不掉的', createdAt: 1 }])
    postsApi.remove.mockRejectedValue(new ApiError('服务暂时不可用'))

    const wrapper = mountApp()
    await flushPromises()
    await wrapper.get('[data-testid="delete-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="error-banner"]').text()).toContain('服务暂时不可用')
    expect(wrapper.find('[data-testid="retry-btn"]').exists()).toBe(false)
  })
})

describe('App 错误处理', () => {
  it('错误横幅可以手动关闭', async () => {
    postsApi.list.mockRejectedValueOnce(new ApiError('无法连接服务'))

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('[data-testid="dismiss-error-btn"]').trigger('click')

    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(false)
  })

  it('重试仍然失败时保留错误提示', async () => {
    postsApi.list
      .mockRejectedValueOnce(new ApiError('第一次连接失败'))
      .mockRejectedValueOnce(new ApiError('第二次连接失败'))

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('[data-testid="retry-btn"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="error-banner"]').text()).toContain('第二次连接失败')
  })

})
