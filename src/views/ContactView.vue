<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import * as contactApi from '../api/contact'
import MediaPicker from '../components/MediaPicker.vue'
import { useIsMobile } from '../composables/useIsMobile'
import type {
  ContactApiResult,
  CustomerServiceRequest,
  CustomerServiceVO,
  GlobalContactVO,
} from '../types/contact'
import type { ConfirmedMediaVO } from '../types/media'

const services = ref<CustomerServiceVO[]>([])
const isMobile = useIsMobile()
const globalContact = ref<GlobalContactVO | null>(null)
const loading = ref(false)
const globalSaving = ref(false)
const globalServiceIds = ref<number[]>([])
const loadError = ref('')
const operationError = ref('')
const successMessage = ref('')
const globalError = ref('')

const dialogVisible = ref(false)
const editingService = ref<CustomerServiceVO | null>(null)
const dialogSaving = ref(false)
const dialogError = ref('')
const form = reactive({ displayName: '', wechatId: '', phone: '' })
const qrImages = ref<ConfirmedMediaVO[]>([])

const dialogTitle = computed(() =>
  editingService.value ? '编辑客服联系人' : '新建客服联系人',
)
const dialogSubtitle = computed(() =>
  editingService.value
    ? '维护客服联系方式与二维码，保存后立即生效'
    : '配置产品可挂载的客服联系方式与二维码',
)

const requirementItems = computed(() => [
  {
    key: 'name',
    label: '客服名称（必填）',
    done: form.displayName.trim().length > 0,
  },
  {
    key: 'wechat',
    label: '微信号（联系方式）',
    done: form.wechatId.trim().length > 0,
  },
  {
    key: 'phone',
    label: '手机号（联系方式）',
    done: form.phone.trim().length > 0,
  },
  {
    key: 'qr',
    label: '客服二维码（联系方式）',
    done: qrImages.value.length > 0,
  },
])

const activeServices = computed(() => services.value.filter((service) => service.active))

const globalOptions = computed(() => {
  const selected = new Set(globalServiceIds.value)
  return services.value.filter((service) => service.active || selected.has(service.id))
})

function serviceLabel(service: CustomerServiceVO): string {
  const contact = service.phone || service.wechatId || '未填写联系方式'
  return `${service.displayName}（${service.active ? '已启用' : '已停用'}，${contact}）`
}

function mediaReference(mediaId: number, imageUrl: string | null): ConfirmedMediaVO {
  return {
    id: mediaId,
    originalFilename: `客服二维码 #${mediaId}`,
    mediaType: 'image/*',
    byteSize: 0,
    status: 'CONFIRMED',
    publicUrl: imageUrl || `/api/v1/media/${mediaId}`,
  }
}

function qrUrl(service: CustomerServiceVO): string {
  if (service.qrMediaId === null || service.qrMediaId === undefined) return ''
  return service.qrImageUrl || `/api/v1/media/${service.qrMediaId}`
}

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ContactApiResult<unknown>>(error)) {
    if (error.response?.status === 403) {
      return '当前账号无权管理客服配置（403），请使用管理员账号登录'
    }
    if (error.response?.status === 409) {
      const conflict = error.response.data?.message
      return typeof conflict === 'string' && conflict.length > 0
        ? conflict
        : '客服仍被引用或状态冲突（409），请检查挂载后重试'
    }
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function applyGlobal(value: GlobalContactVO | null) {
  globalContact.value = value
  globalServiceIds.value = value?.services.map((service) => service.id) ?? []
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
  try {
    const [list, global] = await Promise.all([
      contactApi.listCustomerServices(),
      contactApi.getGlobalContact(),
    ])
    services.value = list
    applyGlobal(global)
  } catch (error) {
    loadError.value = errorMessage(error, '客服配置加载失败，请检查网络后重试')
  } finally {
    loading.value = false
  }
}

async function requestConfirmation(message: string, title: string): Promise<boolean> {
  try {
    await ElMessageBox.confirm(message, title, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning',
    })
    return true
  } catch {
    return false
  }
}

function validateServiceForm(): string | null {
  if (!form.displayName.trim()) return '客服名称不能为空'
  const wechatId = form.wechatId.trim()
  const phone = form.phone.trim()
  if (!wechatId && !phone && qrImages.value.length === 0) {
    return '微信号、手机号和二维码至少填写一项'
  }
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    return '手机号须为有效的中国大陆手机号'
  }
  return null
}

function openCreateDialog() {
  editingService.value = null
  form.displayName = ''
  form.wechatId = ''
  form.phone = ''
  qrImages.value = []
  dialogError.value = ''
  operationError.value = ''
  successMessage.value = ''
  dialogVisible.value = true
}

function openEditDialog(service: CustomerServiceVO) {
  editingService.value = service
  form.displayName = service.displayName
  form.wechatId = service.wechatId ?? ''
  form.phone = service.phone ?? ''
  qrImages.value =
    service.qrMediaId === null || service.qrMediaId === undefined
      ? []
      : [mediaReference(service.qrMediaId, service.qrImageUrl)]
  dialogError.value = ''
  operationError.value = ''
  successMessage.value = ''
  dialogVisible.value = true
}

async function submitService() {
  if (dialogSaving.value) return
  dialogError.value = ''
  const validationError = validateServiceForm()
  if (validationError) {
    dialogError.value = validationError
    return
  }

  const payload: CustomerServiceRequest = {
    displayName: form.displayName.trim(),
    wechatId: form.wechatId.trim() || null,
    phone: form.phone.trim() || null,
    qrMediaId: qrImages.value[0]?.id ?? null,
  }
  dialogSaving.value = true
  try {
    if (editingService.value === null) {
      await contactApi.createCustomerService(payload)
      successMessage.value = `客服联系人“${payload.displayName}”已创建`
    } else {
      await contactApi.updateCustomerService(editingService.value.id, payload)
      successMessage.value = `客服联系人“${payload.displayName}”已保存`
    }
    dialogVisible.value = false
    await loadAll()
  } catch (error) {
    dialogError.value = errorMessage(error, '保存客服联系人失败，请检查输入后重试')
  } finally {
    dialogSaving.value = false
  }
}

async function toggleActive(service: CustomerServiceVO) {
  const next = !service.active
  operationError.value = ''
  successMessage.value = ''
  const message = next
    ? `启用“${service.displayName}”后，可新挂载到产品或全局客服。是否继续？`
    : `停用“${service.displayName}”后将不可新挂载，既有挂载仍保留。是否继续？`
  if (!(await requestConfirmation(message, next ? '启用客服联系人' : '停用客服联系人'))) return

  try {
    await contactApi.setCustomerServiceActive(service.id, { active: next })
    successMessage.value = `客服联系人“${service.displayName}”已${next ? '启用' : '停用'}`
    await loadAll()
  } catch (error) {
    operationError.value = errorMessage(error, '更新客服联系人状态失败，请稍后重试')
  }
}

async function deleteService(service: CustomerServiceVO) {
  operationError.value = ''
  successMessage.value = ''
  if (
    !(await requestConfirmation(
      `硬删除客服联系人“${service.displayName}”后不可恢复，其挂载与全局客服引用会同步移除。是否继续？`,
      '确认硬删除客服联系人',
    ))
  ) {
    return
  }

  try {
    await contactApi.deleteCustomerService(service.id)
    successMessage.value = `客服联系人“${service.displayName}”已硬删除`
    await loadAll()
  } catch (error) {
    operationError.value = errorMessage(error, '硬删除客服联系人失败，请稍后重试')
  }
}

async function saveGlobal() {
  globalError.value = ''
  operationError.value = ''
  successMessage.value = ''
  if (globalSaving.value) return
  if (globalServiceIds.value.length === 0) {
    globalError.value = '请至少选择一个已启用客服联系人'
    return
  }
  const enabledIds = new Set(activeServices.value.map((service) => service.id))
  if (globalServiceIds.value.some((id) => !enabledIds.has(id))) {
    globalError.value = '已停用客服不可新挂载到全局客服，请重新选择'
    return
  }

  globalSaving.value = true
  try {
    const saved = await contactApi.saveGlobalContact({ serviceIds: [...globalServiceIds.value] })
    if (saved) {
      applyGlobal(saved)
    } else {
      await loadAll()
    }
    successMessage.value = '全局客服保存成功，继承全局客服的产品将立即生效'
  } catch (error) {
    globalError.value = errorMessage(error, '保存全局客服失败，请检查选择后重试')
  } finally {
    globalSaving.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div v-loading="loading">
    <el-card class="contact-card">
      <template #header>
        <div class="contact-header">
          <span>客服联系人（管理员维护）</span>
          <div class="contact-header-actions">
            <el-button :loading="loading" @click="loadAll">刷新</el-button>
            <el-button type="primary" @click="openCreateDialog">新建客服联系人</el-button>
          </div>
        </div>
      </template>

      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        show-icon
        :closable="false"
        class="contact-alert"
      >
        <el-button link type="primary" @click="loadAll">重试</el-button>
      </el-alert>
      <el-alert
        v-if="operationError"
        :title="operationError"
        type="error"
        show-icon
        :closable="false"
        class="contact-alert"
      />
      <el-alert
        v-if="successMessage"
        :title="successMessage"
        type="success"
        show-icon
        :closable="false"
        class="contact-alert"
      />

      <div v-if="isMobile" v-loading="loading" class="contact-cards">
        <el-empty v-if="services.length === 0" description="暂无客服联系人" />
        <article v-for="row in services" :key="row.id" class="contact-mobile-card">
          <div class="card-head">
            <el-image
              v-if="qrUrl(row)"
              :src="qrUrl(row)"
              fit="cover"
              class="card-qr"
              :preview-src-list="[qrUrl(row)]"
              preview-teleported
            />
            <span v-else class="card-qr is-empty">未上传</span>
            <div class="card-title">
              <strong>{{ row.displayName }}</strong>
              <span class="card-sub">#{{ row.id }}</span>
            </div>
            <el-tag :type="row.active ? 'success' : 'info'">
              {{ row.active ? '已启用' : '已停用' }}
            </el-tag>
          </div>
          <dl class="card-fields">
            <div>
              <dt>微信号</dt>
              <dd>{{ row.wechatId || '未填写' }}</dd>
            </div>
            <div>
              <dt>手机号</dt>
              <dd>{{ row.phone || '未填写' }}</dd>
            </div>
          </dl>
          <div class="card-actions">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="primary" @click="toggleActive(row)">
              {{ row.active ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="deleteService(row)">硬删除</el-button>
          </div>
        </article>
      </div>

      <el-table v-if="!isMobile" :data="services" row-key="id">
        <template #empty>
          <el-empty description="暂无客服联系人" />
        </template>
        <el-table-column prop="id" label="编号" width="90" />
        <el-table-column prop="displayName" label="客服名称" min-width="140" />
        <el-table-column label="微信号" min-width="140">
          <template #default="{ row }">{{ row.wechatId || '未填写' }}</template>
        </el-table-column>
        <el-table-column label="手机号" min-width="140">
          <template #default="{ row }">{{ row.phone || '未填写' }}</template>
        </el-table-column>
        <el-table-column label="二维码" width="110">
          <template #default="{ row }">
            <el-image
              v-if="qrUrl(row)"
              :src="qrUrl(row)"
              fit="cover"
              class="contact-qr-preview"
              :preview-src-list="[qrUrl(row)]"
            />
            <span v-else>未上传</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'">
              {{ row.active ? '已启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button link type="primary" @click="toggleActive(row)">
              {{ row.active ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="deleteService(row)">硬删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="contact-card">
      <template #header>
        <span>全局客服配置</span>
      </template>

      <el-alert
        title="保存后立即影响所有继承全局客服的上架产品；产品自身的覆盖或关闭策略不受影响。"
        type="info"
        show-icon
        :closable="false"
        class="contact-alert"
      />

      <el-descriptions v-if="globalContact" :column="1" border class="contact-summary">
        <el-descriptions-item
          v-for="service in globalContact.services"
          :key="service.id"
          :label="`客服 ${service.id}`"
        >
          {{ serviceLabel(service) }}
        </el-descriptions-item>
      </el-descriptions>
      <el-empty v-else :description="loading ? '加载中' : '尚未配置全局客服'" />

      <el-form
        label-width="120px"
        :label-position="isMobile ? 'top' : 'right'"
        class="contact-form"
        @submit.prevent="saveGlobal"
      >
        <el-form-item label="全局客服联系人">
          <el-select
            v-model="globalServiceIds"
            multiple
            filterable
            collapse-tags
            placeholder="请选择已启用客服联系人"
            class="contact-service-select"
          >
            <el-option
              v-for="service in globalOptions"
              :key="service.id"
              :label="serviceLabel(service)"
              :value="service.id"
              :disabled="!service.active"
            />
          </el-select>
        </el-form-item>
        <el-alert
          v-if="globalError"
          :title="globalError"
          type="error"
          show-icon
          :closable="false"
          class="contact-alert"
        />
        <el-form-item>
          <el-button type="primary" :loading="globalSaving" :disabled="loading" @click="saveGlobal">
            保存全局客服
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      width="min(940px, calc(100vw - 32px))"
      destroy-on-close
      align-center
      class="contact-dialog"
    >
      <template #header>
        <div class="contact-dialog-header">
          <span class="contact-dialog-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 13a8 8 0 0 1 16 0" />
              <rect x="3" y="13" width="4" height="6" rx="1.5" />
              <rect x="17" y="13" width="4" height="6" rx="1.5" />
              <path d="M19 19a3 3 0 0 1-3 2h-2" />
            </svg>
          </span>
          <span class="contact-dialog-title">
            <strong>{{ dialogTitle }}</strong>
            <small>{{ dialogSubtitle }}</small>
          </span>
          <button type="button" class="dialog-close" aria-label="关闭" @click="dialogVisible = false">
            ×
          </button>
        </div>
      </template>

      <svg class="icon-sprite" aria-hidden="true">
        <symbol id="contact-icon-user" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </symbol>
        <symbol id="contact-icon-qr" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
        </symbol>
        <symbol id="contact-icon-shield" viewBox="0 0 24 24">
          <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </symbol>
        <symbol id="contact-icon-eye" viewBox="0 0 24 24">
          <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </symbol>
      </svg>

      <el-alert
        title="微信号、手机号、二维码至少填写一项；二维码须为已确认媒体。"
        type="info"
        show-icon
        :closable="false"
        class="contact-alert"
      />

      <el-form class="contact-form" label-position="top" @submit.prevent="submitService">
        <div class="contact-grid">
          <div class="contact-main">
            <section class="contact-card">
              <header class="card-header">
                <svg class="card-icon"><use href="#contact-icon-user" /></svg>
                <strong>基本信息</strong>
                <span class="manager-tag">管理员维护</span>
              </header>
              <div class="field-label">客服名称 <em>*</em></div>
              <el-input
                v-model="form.displayName"
                placeholder="请输入客服名称"
                maxlength="120"
              />
              <div class="field-row">
                <div>
                  <div class="field-label">微信号</div>
                  <el-input v-model="form.wechatId" placeholder="请输入客服微信号" />
                </div>
                <div>
                  <div class="field-label">手机号</div>
                  <el-input
                    v-model="form.phone"
                    placeholder="请输入中国大陆手机号"
                    maxlength="11"
                  />
                </div>
              </div>
            </section>

            <section class="contact-card">
              <header class="card-header">
                <svg class="card-icon"><use href="#contact-icon-qr" /></svg>
                <strong>客服二维码</strong>
                <span class="optional-tag">选填 {{ qrImages.length }} / 1</span>
              </header>
              <MediaPicker v-model="qrImages" label="客服二维码" />
              <p class="card-note">点击或拖拽图片到此处，图片须为已确认媒体。</p>
            </section>
          </div>

          <aside class="contact-side">
            <section class="contact-card requirement-card">
              <header class="card-header">
                <svg class="card-icon"><use href="#contact-icon-shield" /></svg>
                <strong>填写要求</strong>
                <span class="optional-tag">至少一项</span>
              </header>
              <ul class="requirement-list">
                <li
                  v-for="item in requirementItems"
                  :key="item.key"
                  :class="{ 'is-done': item.done }"
                >
                  <span class="requirement-mark">{{ item.done ? '✓' : '' }}</span>
                  {{ item.label }}
                </li>
              </ul>
              <p class="card-note">微信号、手机号、二维码三项至少填写一项，顾客才能联系到客服。</p>
            </section>

            <section class="contact-card">
              <header class="card-header">
                <svg class="card-icon"><use href="#contact-icon-eye" /></svg>
                <strong>生效说明</strong>
              </header>
              <p class="card-note">
                保存后立即影响所有挂载该客服的产品；已停用客服仅保留既有挂载。
              </p>
            </section>
          </aside>
        </div>

        <el-alert
          v-if="dialogError"
          :title="dialogError"
          type="error"
          show-icon
          :closable="false"
          class="contact-alert"
        />

        <footer class="contact-footer">
          <span class="footer-note">带 * 为必填项，保存后可在产品中继续挂载该客服</span>
          <div class="form-actions">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="dialogSaving" @click="submitService">
              保存客服联系人
            </el-button>
          </div>
        </footer>
      </el-form>
    </el-dialog>
  </div>
</template>

<style scoped>
.contact-card {
  margin-bottom: 20px;
}

.contact-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.contact-header-actions {
  display: flex;
  gap: 8px;
}

.contact-alert {
  margin-bottom: 16px;
}

.contact-summary {
  margin-bottom: 20px;
}

.contact-qr-preview {
  width: 56px;
  height: 56px;
  border-radius: 4px;
}

.contact-form {
  max-width: 720px;
}

.contact-service-select {
  width: 100%;
}

.icon-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.contact-dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.contact-dialog-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--el-color-primary);
  color: #ffffff;
}

.contact-dialog-icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.contact-dialog-title {
  display: grid;
  gap: 3px;
}

.contact-dialog-title strong {
  color: var(--app-text);
  font-size: 17px;
}

.contact-dialog-title small {
  color: var(--app-text-muted);
  font-size: 12px;
}

.dialog-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.dialog-close:hover {
  color: var(--app-text);
}

.contact-form {
  display: grid;
  gap: 16px;
}

.contact-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
  gap: 16px;
  align-items: start;
}

.contact-main,
.contact-side {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.contact-card {
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--app-text);
}

.card-icon {
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: var(--el-color-primary);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.manager-tag,
.optional-tag {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--app-brand-soft);
  color: var(--el-color-primary);
  font-size: 11px;
}

.optional-tag {
  margin-left: auto;
}

.field-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--app-text);
}

.field-label em {
  color: var(--el-color-danger);
  font-style: normal;
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.card-note {
  margin: 12px 0 0;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.requirement-card {
  background: linear-gradient(180deg, var(--app-brand-soft), var(--app-surface));
}

.requirement-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--app-text-muted);
}

.requirement-list li {
  display: flex;
  align-items: center;
  gap: 10px;
}

.requirement-list li.is-done {
  color: var(--app-text);
}

.requirement-mark {
  width: 18px;
  height: 18px;
  flex: none;
  display: grid;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 50%;
  background: var(--app-surface);
  color: #ffffff;
  font-size: 11px;
}

.requirement-list li.is-done .requirement-mark {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
}

.contact-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ---------- 手机端卡片列表 ---------- */
.contact-cards {
  display: grid;
  gap: 10px;
}

.contact-mobile-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-qr {
  width: 52px;
  height: 52px;
  flex: none;
  border-radius: 8px;
}

.card-qr.is-empty {
  display: grid;
  place-items: center;
  background: var(--app-surface-soft);
  color: var(--app-text-muted);
  font-size: 11px;
}

.card-title {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.card-title strong {
  overflow: hidden;
  color: var(--app-text);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-sub {
  color: var(--app-text-muted);
  font-size: 12px;
}

.card-fields {
  display: grid;
  gap: 6px;
  margin: 0;
  font-size: 13px;
}

.card-fields div {
  display: flex;
  gap: 8px;
}

.card-fields dt {
  flex: none;
  width: 52px;
  color: var(--app-text-muted);
}

.card-fields dd {
  margin: 0;
  overflow: hidden;
  color: var(--app-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px dashed var(--app-border);
}

@media (max-width: 760px) {
  .contact-grid {
    grid-template-columns: 1fr;
  }

  .field-row,
  .contact-footer {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  /* 标题 + 两个按钮挤一行会把标题折成三行，手机上让操作按钮独占一行 */
  .contact-header {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  .contact-header > span {
    flex: 1 1 100%;
  }

  .contact-header-actions {
    width: 100%;
  }

  .contact-header-actions .el-button {
    flex: 1;
    margin-left: 0;
  }
}
</style>

<style>
/*
 * el-dialog 与 MediaPicker 内部节点都不带本组件的 data-v 标记，
 * scoped :deep 选择器匹配不到，这里统一用全局规则。
 */
.contact-dialog .el-dialog__body {
  max-height: calc(100vh - 180px);
  overflow: auto;
  padding-top: 8px;
}

/* 客服弹窗里已经有「客服二维码」标签，图片选择器自带的标题重复 */
.contact-dialog .media-picker-heading {
  display: none;
}

@media (max-width: 760px) {
  .contact-dialog .el-dialog__body {
    max-height: calc(100svh - 150px);
  }
}
</style>
