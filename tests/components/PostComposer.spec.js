import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostComposer from '@/components/PostComposer.vue'

function mountComposer() {
  return mount(PostComposer)
}

describe('PostComposer', () => {
  it('初始状态显示 0 / 280 且发布按钮禁用', () => {
    const wrapper = mountComposer()

    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('0 / 280')
    expect(wrapper.get('[data-testid="publish-btn"]').attributes('disabled')).toBeDefined()
  })

  it('输入内容后更新计数并启用发布按钮', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('你好世界')

    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('4 / 280')
    expect(wrapper.get('[data-testid="publish-btn"]').attributes('disabled')).toBeUndefined()
  })

  it('点击发布抛出 submit 事件并清空输入', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('  第一条碎语  ')
    await wrapper.get('[data-testid="publish-btn"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeTruthy()
    expect(wrapper.emitted('submit')[0]).toEqual(['第一条碎语'])
    expect(wrapper.get('[data-testid="post-input"]').element.value).toBe('')
    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('0 / 280')
  })

  it('纯空白内容不会抛出 submit 事件', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('    ')
    await wrapper.get('[data-testid="publish-btn"]').trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('Ctrl + Enter 可以快速发布', async () => {
    const wrapper = mountComposer()
    const input = wrapper.get('[data-testid="post-input"]')

    await input.setValue('快捷键发布')
    await input.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')[0]).toEqual(['快捷键发布'])
  })

  it('超出字数上限时禁止发布并标记超限', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('字'.repeat(281))

    expect(wrapper.get('[data-testid="char-count"]').classes()).toContain('is-over')
    expect(wrapper.get('[data-testid="publish-btn"]').attributes('disabled')).toBeDefined()
  })

  it('接近上限时计数变为警示色', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('字'.repeat(230))

    expect(wrapper.get('[data-testid="char-count"]').classes()).toContain('is-warning')
  })

  it('提交中禁用发布按钮并展示进行中文案', async () => {
    const wrapper = mount(PostComposer, { props: { submitting: true } })

    await wrapper.get('[data-testid="post-input"]').setValue('提交中的内容')

    const button = wrapper.get('[data-testid="publish-btn"]')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('发布中…')
  })

  it('提交中按 Ctrl + Enter 不会重复触发', async () => {
    const wrapper = mount(PostComposer, { props: { submitting: true } })
    const input = wrapper.get('[data-testid="post-input"]')

    await input.setValue('提交中的内容')
    await input.trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('restoreDraft 不会覆盖用户已经重新输入的内容', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('失败的草稿')
    await wrapper.get('[data-testid="publish-btn"]').trigger('click')
    await wrapper.get('[data-testid="post-input"]').setValue('用户重新输入的内容')

    wrapper.vm.restoreDraft('失败的草稿')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="post-input"]').element.value).toBe(
      '用户重新输入的内容'
    )
  })

  it('restoreDraft 可以把失败的草稿放回输入框', async () => {
    const wrapper = mountComposer()

    await wrapper.get('[data-testid="post-input"]').setValue('失败的草稿')
    await wrapper.get('[data-testid="publish-btn"]').trigger('click')
    wrapper.vm.restoreDraft('失败的草稿')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="post-input"]').element.value).toBe('失败的草稿')
    expect(wrapper.get('[data-testid="char-count"]').text()).toBe('5 / 280')
  })
})
