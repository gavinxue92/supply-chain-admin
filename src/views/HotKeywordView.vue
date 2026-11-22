<script setup lang="ts">
import axios from 'axios'
import { onMounted, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import * as hotKeywordApi from '../api/hot-keyword'
import type { HotKeywordApiResult, HotKeywordVO } from '../types/hot-keyword'

const MAX_KEYWORDS = 12
const MAX_KEYWORD_LENGTH = 120

const keywords = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const successMessage = ref('')

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<HotKeywordApiResult<unknown>>(error)) {
    if (error.response?.status === 403) {
      return '当前账号无权维护搜索热词（403），请使用管理员账号登录'
    }
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function apply(rows: HotKeywordVO[]): void {
  keywords.value = rows.map((row) => row.keyword)
}

async function loadAll(): Promise<void> {
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  successMessage.value = ''
  try {
    apply(await hotKeywordApi.listHotKeywords())
  } catch (error) {
    loadError.value = errorMessage(error, '搜索热词加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

function addKeyword(): void {
  keywords.value.push('')
  saveError.value = ''
  successMessage.value = ''
}

function removeKeyword(index: number): void {
  keywords.value.splice(index, 1)
  saveError.value = ''
  successMessage.value = ''
}

function validate(): string | null {
  const values = keywords.value.map((word) => word.trim())
  if (values.length === 0) return '请至少填写一个热词'
  if (values.length > MAX_KEYWORDS) return `热词最多 ${MAX_KEYWORDS} 个`
  if (values.some((word) => word.length === 0)) return '热词不能为空'
  if (values.some((word) => word.length > MAX_KEYWORD_LENGTH)) {
    return `单个热词不能超过 ${MAX_KEYWORD_LENGTH} 个字符`
  }
  if (new Set(values).size !== values.length) return '热词不能重复'
  return null
}

async function submit(): Promise<void> {
  if (saving.value) return
  saveError.value = ''
  successMessage.value = ''
  const validationError = validate()
  if (validationError) {
    saveError.value = validationError
    return
  }
  const accepted = await ElMessageBox.confirm(
    '保存后将立即替换小程序搜索页的「常搜」标签，是否继续？',
    '确认保存搜索热词',
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
  ).catch(() => false)
  if (!accepted) return

  saving.value = true
  try {
    apply(await hotKeywordApi.saveHotKeywords({
      keywords: keywords.value.map((word) => word.trim()),
    }))
    successMessage.value = '搜索热词已保存，小程序端即时生效'
  } catch (error) {
    saveError.value = errorMessage(error, '保存搜索热词失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div v-loading="loading">
    <el-card>
      <template #header>
        <div class="hot-keyword-header">
          <span>搜索热词（管理员维护）</span>
          <el-button :loading="loading" @click="loadAll">刷新</el-button>
        </div>
      </template>

      <el-alert
        title="热词按列表顺序展示在小程序搜索页「常搜」区；保存后即时生效，最多 12 个，每个不超过 120 字符。"
        type="info"
        show-icon
        :closable="false"
        class="hot-keyword-alert"
      />
      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        show-icon
        :closable="false"
        class="hot-keyword-alert"
      >
        <el-button link type="primary" @click="loadAll">重试</el-button>
      </el-alert>
      <el-alert
        v-if="saveError"
        :title="saveError"
        type="error"
        show-icon
        :closable="false"
        class="hot-keyword-alert"
      />
      <el-alert
        v-if="successMessage"
        :title="successMessage"
        type="success"
        show-icon
        :closable="false"
        class="hot-keyword-alert"
      />

      <div class="hot-keyword-list">
        <div v-for="(word, index) in keywords" :key="index" class="hot-keyword-row">
          <span class="hot-keyword-order">{{ index + 1 }}</span>
          <el-input
            v-model="keywords[index]"
            :maxlength="MAX_KEYWORD_LENGTH"
            placeholder="请输入热词"
            @input="saveError = ''; successMessage = ''"
          />
          <el-button type="danger" link @click="removeKeyword(index)">删除</el-button>
        </div>
        <el-empty v-if="keywords.length === 0" description="尚未配置搜索热词" />
      </div>

      <div class="hot-keyword-actions">
        <el-button :disabled="keywords.length >= MAX_KEYWORDS" @click="addKeyword">
          新增热词
        </el-button>
        <el-button type="primary" :loading="saving" :disabled="loading" @click="submit">
          保存搜索热词
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.hot-keyword-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hot-keyword-alert {
  margin-bottom: 16px;
}

.hot-keyword-list {
  display: grid;
  gap: 12px;
  max-width: 720px;
}

.hot-keyword-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hot-keyword-order {
  width: 24px;
  flex: none;
  color: var(--app-text-muted);
  text-align: center;
}

.hot-keyword-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}
</style>
