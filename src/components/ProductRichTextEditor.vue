<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { ConfirmedMediaVO } from '../types/media'
import { sanitizeProductHtml } from '../utils/product-html'

const props = defineProps<{
  modelValue: string
  allowedMediaIds: number[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editor = ref<HTMLElement | null>(null)

function syncFromModel() {
  if (!editor.value) return
  const safeHtml = sanitizeProductHtml(props.modelValue, props.allowedMediaIds)
  if (editor.value.innerHTML !== safeHtml) {
    editor.value.innerHTML = safeHtml
  }
  if (safeHtml !== props.modelValue) {
    emit('update:modelValue', safeHtml)
  }
}

function handleInput() {
  if (!editor.value) return
  const safeHtml = sanitizeProductHtml(editor.value.innerHTML, props.allowedMediaIds)
  if (editor.value.innerHTML !== safeHtml) {
    editor.value.innerHTML = safeHtml
  }
  emit('update:modelValue', safeHtml)
}

function insertHtmlAtSelection(html: string) {
  const target = editor.value
  if (!target) return
  target.focus()

  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  if (selection && range && target.contains(range.commonAncestorContainer)) {
    range.deleteContents()
    const fragment = range.createContextualFragment(html)
    const lastNode = fragment.lastChild
    range.insertNode(fragment)
    if (lastNode) {
      range.setStartAfter(lastNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  } else {
    target.insertAdjacentHTML('beforeend', html)
  }
  handleInput()
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const html = event.clipboardData?.getData('text/html') ?? ''
  const plainText = event.clipboardData?.getData('text/plain') ?? ''
  const safeHtml = sanitizeProductHtml(html || plainText, props.allowedMediaIds)
  if (safeHtml) insertHtmlAtSelection(safeHtml)
}

function applyCommand(command: string, value?: string) {
  editor.value?.focus()
  document.execCommand(command, false, value)
  handleInput()
}

function insertMedia(media: ConfirmedMediaVO) {
  if (!props.allowedMediaIds.includes(media.id)) return
  const image = document.createElement('img')
  image.setAttribute('src', `/api/v1/media/${media.id}`)
  image.setAttribute('alt', '')
  insertHtmlAtSelection(`<p>${image.outerHTML}</p>`)
}

watch(
  () => [props.modelValue, props.allowedMediaIds],
  syncFromModel,
  { deep: true },
)
onMounted(syncFromModel)

defineExpose({ insertMedia })
</script>

<template>
  <div class="rich-text-editor">
    <div class="editor-toolbar" aria-label="详情格式工具栏">
      <el-button size="small" aria-label="段落" @mousedown.prevent @click="applyCommand('formatBlock', 'p')">
        段落
      </el-button>
      <el-button size="small" aria-label="标题二" @mousedown.prevent @click="applyCommand('formatBlock', 'h2')">
        标题
      </el-button>
      <el-button size="small" aria-label="标题三" @mousedown.prevent @click="applyCommand('formatBlock', 'h3')">
        小标题
      </el-button>
      <el-button size="small" aria-label="粗体" @mousedown.prevent @click="applyCommand('bold')">
        粗体
      </el-button>
      <el-button size="small" aria-label="斜体" @mousedown.prevent @click="applyCommand('italic')">
        斜体
      </el-button>
      <el-button size="small" aria-label="无序列表" @mousedown.prevent @click="applyCommand('insertUnorderedList')">
        无序列表
      </el-button>
      <el-button size="small" aria-label="有序列表" @mousedown.prevent @click="applyCommand('insertOrderedList')">
        有序列表
      </el-button>
      <el-button size="small" aria-label="换行" @mousedown.prevent @click="applyCommand('insertLineBreak')">
        换行
      </el-button>
    </div>
    <div
      ref="editor"
      class="rich-text-content"
      contenteditable="true"
      role="textbox"
      aria-label="产品详情"
      aria-multiline="true"
      @input="handleInput"
      @paste="handlePaste"
    />
  </div>
</template>

<style scoped>
.rich-text-editor {
  width: 100%;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.rich-text-content {
  min-height: 180px;
  padding: 10px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  outline-color: #409eff;
  line-height: 1.6;
}

.rich-text-content:focus {
  border-color: #409eff;
}

/*
 * 手机上 9 个格式按钮换行会占掉半屏，改成单行横向滚动；
 * 按钮高度抬到 40px 才按得准。
 */
@media (max-width: 899px) {
  .editor-toolbar {
    flex-wrap: nowrap;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 6px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .editor-toolbar::-webkit-scrollbar {
    display: none;
  }

  .editor-toolbar .el-button {
    flex: none;
    min-height: 40px;
    padding: 0 10px;
    font-size: 13px;
  }

  .rich-text-content {
    min-height: 220px;
    /* 16px 以下 iOS Safari 聚焦时会自动放大整个页面 */
    font-size: 16px;
  }
}
</style>
