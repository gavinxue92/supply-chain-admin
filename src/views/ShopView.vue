<script setup lang="ts">
import axios from 'axios'
import { onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import * as shopApi from '../api/shop'
import type { ShopApiResult, ShopInfoRequest } from '../types/shop'

const form = reactive<ShopInfoRequest>({
  name: '',
  slogan: '',
  address: '',
  hours: '',
  phone: '',
  wechat: '',
})
const loading = ref(false)
const saving = ref(false)
const loadError = ref('')
const saveError = ref('')
const successMessage = ref('')

const fields: Array<{ key: keyof ShopInfoRequest; label: string; max: number; placeholder: string }> = [
  { key: 'name', label: '店铺名称', max: 120, placeholder: '请输入店铺名称' },
  { key: 'slogan', label: '店铺口号', max: 200, placeholder: '请输入店铺口号' },
  { key: 'address', label: '店铺地址', max: 300, placeholder: '请输入店铺地址' },
  { key: 'hours', label: '营业时间', max: 120, placeholder: '如：每天 06:00 – 20:00' },
  { key: 'phone', label: '联系电话', max: 20, placeholder: '中国大陆手机号' },
  { key: 'wechat', label: '联系微信', max: 128, placeholder: '请输入微信号' },
]

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ShopApiResult<unknown>>(error)) {
    if (error.response?.status === 403) {
      return '当前账号无权维护店铺信息（403），请使用管理员账号登录'
    }
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function apply(info: ShopInfoRequest | null): void {
  if (info) Object.assign(form, info)
}

async function loadAll(): Promise<void> {
  loading.value = true
  loadError.value = ''
  saveError.value = ''
  successMessage.value = ''
  try {
    apply(await shopApi.getShopInfo())
  } catch (error) {
    loadError.value = errorMessage(error, '店铺信息加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

function validate(): string | null {
  for (const field of fields) {
    const value = form[field.key].trim()
    if (!value) return `${field.label}不能为空`
    if (value.length > field.max) return `${field.label}不能超过 ${field.max} 个字符`
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) return '联系电话须为有效的中国大陆手机号'
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
    '保存后将立即更新小程序端「我的」页与首页的店铺信息，是否继续？',
    '确认保存店铺信息',
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
  ).catch(() => false)
  if (!accepted) return

  saving.value = true
  try {
    const payload: ShopInfoRequest = {
      name: form.name.trim(),
      slogan: form.slogan.trim(),
      address: form.address.trim(),
      hours: form.hours.trim(),
      phone: form.phone.trim(),
      wechat: form.wechat.trim(),
    }
    apply(await shopApi.saveShopInfo(payload))
    successMessage.value = '店铺信息已保存，小程序端即时生效'
  } catch (error) {
    saveError.value = errorMessage(error, '保存店铺信息失败，请稍后重试')
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
        <div class="shop-header">
          <span>店铺信息（管理员维护）</span>
          <el-button :loading="loading" @click="loadAll">刷新</el-button>
        </div>
      </template>

      <el-alert
        title="店名、口号、地址、营业时间、电话、微信由本页维护；CTA 文案与说明条目仍由小程序配置提供。"
        type="info"
        show-icon
        :closable="false"
        class="shop-alert"
      />
      <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" class="shop-alert">
        <el-button link type="primary" @click="loadAll">重试</el-button>
      </el-alert>
      <el-alert v-if="saveError" :title="saveError" type="error" show-icon :closable="false" class="shop-alert" />
      <el-alert v-if="successMessage" :title="successMessage" type="success" show-icon :closable="false" class="shop-alert" />

      <el-form label-width="110px" class="shop-form" @submit.prevent="submit">
        <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
          <el-input
            v-model="form[field.key]"
            :maxlength="field.max"
            :placeholder="field.placeholder"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" :disabled="loading" @click="submit">
            保存店铺信息
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.shop-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.shop-alert {
  margin-bottom: 16px;
}
.shop-form {
  max-width: 640px;
}
</style>
