import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, describe, expect, it } from 'vitest'
import ProductRichTextEditor from '../src/components/ProductRichTextEditor.vue'

describe('产品详情编辑器', () => {
  const wrappers: ReturnType<typeof mount>[] = []

  afterEach(() => {
    wrappers.forEach((wrapper) => wrapper.unmount())
    wrappers.length = 0
    document.body.innerHTML = ''
  })

  it('只保留允许的格式和已确认媒体图片', async () => {
    const wrapper = mount(ProductRichTextEditor, {
      props: {
        modelValue:
          '<p style="color:red"><b>产品介绍</b><img src="/api/v1/media/304" alt="展示图" style="width:99px"><img src="https://outside.example/image.png" alt="外部图"></p><script>window.compromised = true</script><iframe src="https://outside.example"></iframe>',
        allowedMediaIds: [304],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const content = wrapper.get('[contenteditable="true"]').element.innerHTML
    expect(content).toBe(
      '<p><strong>产品介绍</strong><img src="/api/v1/media/304" alt="展示图"></p>',
    )
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([content])
  })

  it('粘贴时移除外部图片、脚本和任意样式', async () => {
    const wrapper = mount(ProductRichTextEditor, {
      props: {
        modelValue: '',
        allowedMediaIds: [304],
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(wrapper)
    await flushPromises()

    const editor = wrapper.get<HTMLElement>('[contenteditable="true"]')
    const range = document.createRange()
    range.selectNodeContents(editor.element)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    const pasteEvent = new Event('paste', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/html'
            ? '<p style="color:red">说明<img src="https://outside.example/image.png"><img src="/api/v1/media/304"><script>bad()</script></p>'
            : '',
      },
    })
    await editor.element.dispatchEvent(pasteEvent)
    await flushPromises()

    expect(editor.element.innerHTML).toBe(
      '<p>说明<img src="/api/v1/media/304"></p>',
    )
    const updates = wrapper.emitted('update:modelValue')
    expect(updates?.[updates.length - 1]).toEqual([
      '<p>说明<img src="/api/v1/media/304"></p>',
    ])
  })
})
