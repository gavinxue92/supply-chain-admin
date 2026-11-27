<script setup lang="ts">
import axios from 'axios'
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as accountApi from '../api/account'
import { useIsMobile } from '../composables/useIsMobile'
import type {
  AccountApiResult,
  AdminAccountVO,
  ResetTemporaryPasswordRequest,
} from '../types/account'
import type { UserRole } from '../types/auth'

const accounts = ref<AdminAccountVO[]>([])
const loading = ref(false)
const isMobile = useIsMobile()
const loadError = ref('')
const operationError = ref('')
const successMessage = ref('')

const createDialogVisible = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({
  username: '',
  temporaryPassword: '',
  role: 'EDITOR' as UserRole,
  nickname: '',
})

const resetDialogVisible = ref(false)
const resetTarget = ref<AdminAccountVO | null>(null)
const resetting = ref(false)
const resetError = ref('')
const resetForm = reactive<ResetTemporaryPasswordRequest>({ temporaryPassword: '' })

const nicknameDialogVisible = ref(false)
const nicknameTarget = ref<AdminAccountVO | null>(null)
const nicknameSaving = ref(false)
const nicknameError = ref('')
const nicknameForm = reactive({ nickname: '' })

const oneTimePasswordVisible = ref(false)
const oneTimePassword = ref('')
const oneTimePasswordUsername = ref('')
const oneTimePasswordTitle = ref('')
const copyError = ref('')

const roleLabels: Record<UserRole, string> = {
  ADMIN: '管理员',
  EDITOR: '运营编辑',
}

function roleLabel(role: UserRole): string {
  return roleLabels[role]
}

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<AccountApiResult<unknown>>(error)) {
    if (error.response?.status === 403) {
      return '当前账号无权执行此操作（403），请使用管理员账号登录'
    }
    if (error.response?.status === 409) {
      const conflict = error.response?.data?.message
      return typeof conflict === 'string' && conflict.length > 0
        ? conflict
        : '操作冲突（409），请检查账号状态后重试'
    }
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function formatCreatedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

async function loadAccounts() {
  loading.value = true
  loadError.value = ''
  try {
    accounts.value = await accountApi.listAccounts()
  } catch (error) {
    loadError.value = errorMessage(error, '后台账号列表加载失败，请检查网络后重试')
  } finally {
    loading.value = false
  }
}

function validateUsername(username: string): string | null {
  if (!username) return '用户名不能为空'
  if (/\s/.test(username)) return '用户名不能包含空白字符'
  if (username.length > 80) return '用户名不能超过 80 个字符'
  return null
}

function validateTemporaryPassword(password: string): string | null {
  if (password.length < 12 || password.length > 200) {
    return '临时密码长度必须为 12 至 200 个字符'
  }
  return null
}

function openCreateDialog() {
  createError.value = ''
  operationError.value = ''
  successMessage.value = ''
  createForm.username = ''
  createForm.temporaryPassword = ''
  createForm.role = 'EDITOR'
  createForm.nickname = ''
  createDialogVisible.value = true
}

function showOneTimePassword(username: string, password: string, title: string) {
  oneTimePasswordUsername.value = username
  oneTimePassword.value = password
  oneTimePasswordTitle.value = title
  copyError.value = ''
  oneTimePasswordVisible.value = true
}

function clearOneTimePassword() {
  oneTimePassword.value = ''
  oneTimePasswordUsername.value = ''
  copyError.value = ''
}

async function copyOneTimePassword() {
  if (!oneTimePassword.value) return
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('当前浏览器不支持自动复制')
    }
    await navigator.clipboard.writeText(oneTimePassword.value)
    copyError.value = ''
    ElMessage.success('临时密码已复制')
  } catch {
    copyError.value = '复制失败，请手动选择临时密码后复制'
  }
}

async function submitCreate() {
  createError.value = ''
  if (creating.value) return

  const username = createForm.username.trim()
  const usernameError = validateUsername(username)
  if (usernameError) {
    createError.value = usernameError
    return
  }
  const passwordError = validateTemporaryPassword(createForm.temporaryPassword)
  if (passwordError) {
    createError.value = passwordError
    return
  }

  const temporaryPassword = createForm.temporaryPassword
  creating.value = true
  try {
    const nickname = createForm.nickname?.trim() || null
    if (nickname && nickname.length > 50) {
      createError.value = '昵称不能超过 50 个字符'
      return
    }
    const account = await accountApi.createAccount({
      username,
      temporaryPassword,
      role: createForm.role,
      nickname,
    })
    createDialogVisible.value = false
    createForm.username = ''
    createForm.temporaryPassword = ''
    createForm.role = 'EDITOR'
    createForm.nickname = ''
    successMessage.value = `账号“${account.username}”创建成功`
    showOneTimePassword(account.username, temporaryPassword, '账号创建成功')
    await loadAccounts()
  } catch (error) {
    createError.value = errorMessage(error, '创建后台账号失败，请检查输入后重试')
  } finally {
    creating.value = false
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
  } catch (action) {
    if (action === 'cancel' || action === 'close') return false
    operationError.value = errorMessage(action, '无法确认此操作')
    return false
  }
}
function openResetDialog(account: AdminAccountVO) {
  resetTarget.value = account
  resetForm.temporaryPassword = ''
  resetError.value = ''
  operationError.value = ''
  successMessage.value = ''
  resetDialogVisible.value = true
}

async function submitReset() {
  resetError.value = ''
  if (resetting.value || !resetTarget.value) return

  const passwordError = validateTemporaryPassword(resetForm.temporaryPassword)
  if (passwordError) {
    resetError.value = passwordError
    return
  }

  const target = resetTarget.value
  const temporaryPassword = resetForm.temporaryPassword
  if (
    !(await requestConfirmation(
      `重置“${target.username}”的临时密码后，该账号当前会话将立即失效，下次登录必须修改密码。是否继续？`,
      '确认重置临时密码',
    ))
  ) {
    return
  }

  resetting.value = true
  try {
    await accountApi.resetTemporaryPassword(target.id, { temporaryPassword })
    resetDialogVisible.value = false
    resetForm.temporaryPassword = ''
    successMessage.value = `账号“${target.username}”的临时密码已重置`
    showOneTimePassword(target.username, temporaryPassword, '临时密码已重置')
    await loadAccounts()
  } catch (error) {
    resetError.value = errorMessage(error, '重置临时密码失败，请稍后重试')
  } finally {
    resetting.value = false
  }
}

async function deactivateAccount(account: AdminAccountVO) {
  operationError.value = ''
  successMessage.value = ''
  if (
    !(await requestConfirmation(
      `停用“${account.username}”后，该账号当前会话将立即失效且不能继续登录。是否继续？`,
      '确认停用账号',
    ))
  ) {
    return
  }

  try {
    await accountApi.deactivateAccount(account.id)
    successMessage.value = `账号“${account.username}”已停用`
    await loadAccounts()
  } catch (error) {
    operationError.value = errorMessage(error, '停用账号失败，请稍后重试')
  }
}

function openNicknameDialog(account: AdminAccountVO) {
  nicknameTarget.value = account
  nicknameForm.nickname = account.nickname || ''
  nicknameError.value = ''
  operationError.value = ''
  successMessage.value = ''
  nicknameDialogVisible.value = true
}

async function submitNickname() {
  if (nicknameSaving.value || !nicknameTarget.value) return
  const target = nicknameTarget.value
  const nickname = nicknameForm.nickname?.trim() || null
  if (nickname && nickname.length > 50) {
    nicknameError.value = '昵称不能超过 50 个字符'
    return
  }

  nicknameSaving.value = true
  try {
    await accountApi.updateAccountNickname(target.id, { nickname })
    nicknameDialogVisible.value = false
    successMessage.value = `账号“${target.username}”的昵称已更新`
    await loadAccounts()
  } catch (error) {
    nicknameError.value = errorMessage(error, '更新账号昵称失败，请稍后重试')
  } finally {
    nicknameSaving.value = false
  }
}

async function deleteAccount(account: AdminAccountVO) {
  operationError.value = ''
  successMessage.value = ''
  if (
    !(await requestConfirmation(
      `硬删除账号“${account.username}”后不可恢复，且无法删除自己或最后一个启用管理员。是否继续？`,
      '确认硬删除账号',
    ))
  ) {
    return
  }

  try {
    await accountApi.deleteAccount(account.id)
    successMessage.value = `账号“${account.username}”已硬删除`
    await loadAccounts()
  } catch (error) {
    operationError.value = errorMessage(error, '硬删除账号失败，请稍后重试')
  }
}

onMounted(loadAccounts)
</script>

<template>
  <el-card>
    <template #header>
      <div class="account-header">
        <span>账号管理</span>
        <el-button type="primary" @click="openCreateDialog">新建账号</el-button>
      </div>
    </template>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      class="account-alert"
    >
      <el-button link type="primary" @click="loadAccounts">重试</el-button>
    </el-alert>
    <el-alert
      v-if="operationError"
      :title="operationError"
      type="error"
      show-icon
      :closable="false"
      class="account-alert"
    />
    <el-alert
      v-if="successMessage"
      :title="successMessage"
      type="success"
      show-icon
      :closable="false"
      class="account-alert"
    />

    <div v-if="isMobile" v-loading="loading" class="account-cards">
      <el-empty v-if="accounts.length === 0" description="暂无后台账号" />
      <article v-for="row in accounts" :key="row.id" class="account-mobile-card">
        <div class="card-head">
          <div class="card-title">
            <strong>{{ row.username }}</strong>
            <span class="card-sub">#{{ row.id }} · {{ row.nickname || '未设置昵称' }}</span>
          </div>
          <el-tag :type="row.role === 'ADMIN' ? 'warning' : 'info'">
            {{ roleLabel(row.role) }}
          </el-tag>
        </div>
        <div class="card-tags">
          <el-tag :type="row.active ? 'success' : 'info'" size="small">
            {{ row.active ? '已启用' : '已停用' }}
          </el-tag>
          <el-tag :type="row.mustChangePassword ? 'warning' : 'success'" size="small">
            {{ row.mustChangePassword ? '需改密' : '密码正常' }}
          </el-tag>
        </div>
        <div class="card-meta">创建于 {{ formatCreatedAt(row.createdAt) }}</div>
        <div class="card-actions">
          <el-button link type="primary" @click="openNicknameDialog(row)">编辑昵称</el-button>
          <el-button link type="primary" @click="openResetDialog(row)">重置临时密码</el-button>
          <el-button v-if="row.active" link type="danger" @click="deactivateAccount(row)">
            停用
          </el-button>
          <el-button v-if="!row.active" link type="danger" @click="deleteAccount(row)">
            硬删除
          </el-button>
        </div>
      </article>
    </div>

    <el-table v-if="!isMobile" v-loading="loading" :data="accounts" row-key="id">
      <template #empty>
        <el-empty description="暂无后台账号" />
      </template>
      <el-table-column prop="id" label="账号编号" width="100" />
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column label="昵称" min-width="140">
        <template #default="{ row }">{{ row.nickname || '未设置' }}</template>
      </el-table-column>
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'ADMIN' ? 'warning' : 'info'">
            {{ roleLabel(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'">
            {{ row.active ? '已启用' : '已停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="改密状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.mustChangePassword ? 'warning' : 'success'">
            {{ row.mustChangePassword ? '需改密' : '正常' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="180">
        <template #default="{ row }">{{ formatCreatedAt(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openNicknameDialog(row)">编辑昵称</el-button>
          <el-button link type="primary" @click="openResetDialog(row)">重置临时密码</el-button>
          <el-button v-if="row.active" link type="danger" @click="deactivateAccount(row)">
            停用
          </el-button>
          <el-button v-if="!row.active" link type="danger" @click="deleteAccount(row)">
            硬删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog
    v-model="createDialogVisible"
    width="min(900px, calc(100vw - 32px))"
    destroy-on-close
    align-center
    class="account-create-dialog"
  >
    <template #header>
      <div class="account-create-header">
        <span class="account-create-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3 20a6 6 0 0 1 12 0" />
            <path d="M19 8v6m3-3h-6" />
          </svg>
        </span>
        <span class="account-create-title">
          <strong>新建后台账号</strong>
          <small>为团队成员创建账号并分配访问角色</small>
        </span>
        <button type="button" class="dialog-close" aria-label="关闭" @click="createDialogVisible = false">
          ×
        </button>
      </div>
    </template>

    <svg class="icon-sprite" aria-hidden="true">
      <symbol id="account-icon-shield" viewBox="0 0 24 24">
        <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </symbol>
      <symbol id="account-icon-key" viewBox="0 0 24 24">
        <circle cx="8" cy="8" r="4" />
        <path d="m11 11 8 8m-3-3 2-2m-4 0 2-2" />
      </symbol>
      <symbol id="account-icon-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </symbol>
    </svg>

    <el-alert
      title="临时密码只显示一次，请通过安全渠道交付给账号使用者。"
      type="info"
      show-icon
      :closable="false"
      class="account-alert"
    />

    <el-form class="account-create-form" label-position="top" @submit.prevent="submitCreate">
      <div class="account-create-grid">
        <div class="account-create-main">
          <section class="account-create-card">
            <header class="card-header">
              <svg class="card-icon"><use href="#account-icon-key" /></svg>
              <strong>账号凭证</strong>
            </header>
            <div class="field-label">用户名 <em>*</em></div>
            <el-input
              v-model="createForm.username"
              placeholder="请输入用户名"
              maxlength="80"
              show-word-limit
            />
            <div class="field-label password-label">临时密码 <em>*</em></div>
            <el-input
              v-model="createForm.temporaryPassword"
              type="password"
              show-password
              autocomplete="new-password"
              maxlength="200"
              placeholder="12 至 200 个字符"
            />
          </section>

          <section class="account-create-card">
            <header class="card-header">
              <svg class="card-icon"><use href="#account-icon-user" /></svg>
              <strong>个人资料</strong>
            </header>
            <div class="field-label">角色</div>
            <el-select v-model="createForm.role" class="role-select">
              <el-option label="运营编辑（EDITOR）" value="EDITOR" />
              <el-option label="管理员（ADMIN）" value="ADMIN" />
            </el-select>
            <div class="field-label nickname-label">昵称</div>
            <el-input
              v-model="createForm.nickname"
              placeholder="可选，最多 50 个字符"
              maxlength="50"
              show-word-limit
            />
          </section>
        </div>

        <aside class="account-create-side">
          <section class="account-create-card security-card">
            <header class="card-header">
              <svg class="card-icon"><use href="#account-icon-shield" /></svg>
              <strong>账号安全</strong>
              <span class="point-tag">3 条要点</span>
            </header>
            <ul class="security-list">
              <li>临时密码长度 12-200 个字符</li>
              <li>密码仅在创建时展示一次</li>
              <li>请通过安全渠道交付给使用者</li>
            </ul>
          </section>

          <section class="account-create-card">
            <header class="card-header">
              <svg class="card-icon"><use href="#account-icon-user" /></svg>
              <strong>角色权限</strong>
            </header>
            <ul class="role-list">
              <li :class="{ 'is-current': createForm.role === 'ADMIN' }">
                <strong>ADMIN</strong>
                <span>管理员 · 全部权限</span>
                <em v-if="createForm.role === 'ADMIN'">当前</em>
              </li>
              <li :class="{ 'is-current': createForm.role === 'EDITOR' }">
                <strong>EDITOR</strong>
                <span>运营编辑 · 当前选择</span>
                <em v-if="createForm.role === 'EDITOR'">当前</em>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <el-alert
        v-if="createError"
        :title="createError"
        type="error"
        show-icon
        :closable="false"
        class="account-alert"
      />

      <footer class="account-create-footer">
        <span class="footer-note">带 * 为必填项，创建后可在账号管理中调整角色</span>
        <div class="form-actions">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="creating" @click="submitCreate">
            创建账号
          </el-button>
        </div>
      </footer>
    </el-form>
  </el-dialog>

  <el-dialog v-model="resetDialogVisible" title="重置临时密码" width="520px" destroy-on-close>
    <el-alert
      :title="`重置“${resetTarget?.username ?? ''}”的临时密码后，该账号当前会话将立即失效，下次登录必须修改密码。`"
      type="warning"
      show-icon
      :closable="false"
      class="account-alert"
    />
    <el-form label-width="100px" @submit.prevent="submitReset">
      <el-form-item label="临时密码" required>
        <el-input
          v-model="resetForm.temporaryPassword"
          type="password"
          show-password
          autocomplete="new-password"
          maxlength="200"
          placeholder="请输入新的临时密码"
        />
      </el-form-item>
      <el-alert
        v-if="resetError"
        :title="resetError"
        type="error"
        show-icon
        :closable="false"
        class="account-alert"
      />
    </el-form>
    <template #footer>
      <el-button @click="resetDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="resetting" @click="submitReset">确认重置</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="nicknameDialogVisible" title="编辑账号昵称" width="440px" destroy-on-close>
    <el-alert
      :title="`正在维护“${nicknameTarget?.username ?? ''}”的昵称；昵称非唯一，最多 50 个字符。`"
      type="info"
      show-icon
      :closable="false"
      class="account-alert"
    />
    <el-form label-width="80px" @submit.prevent="submitNickname">
      <el-form-item label="昵称">
        <el-input
          v-model="nicknameForm.nickname"
          placeholder="请输入昵称，留空可清除"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>
      <el-alert
        v-if="nicknameError"
        :title="nicknameError"
        type="error"
        show-icon
        :closable="false"
        class="account-alert"
      />
    </el-form>
    <template #footer>
      <el-button @click="nicknameDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="nicknameSaving" @click="submitNickname">
        保存昵称
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="oneTimePasswordVisible"
    :title="oneTimePasswordTitle"
    width="520px"
    :close-on-click-modal="false"
    @closed="clearOneTimePassword"
  >
    <el-alert
      title="临时密码只显示一次，关闭后无法再次查看。请通过安全渠道交付给账号使用者。"
      type="warning"
      show-icon
      :closable="false"
      class="account-alert"
    />
    <el-descriptions :column="1" border>
      <el-descriptions-item label="账号">{{ oneTimePasswordUsername }}</el-descriptions-item>
      <el-descriptions-item label="临时密码">
        <el-input :model-value="oneTimePassword" readonly />
      </el-descriptions-item>
    </el-descriptions>
    <el-alert
      v-if="copyError"
      :title="copyError"
      type="error"
      show-icon
      :closable="false"
      class="account-alert"
    />
    <template #footer>
      <el-button type="primary" @click="copyOneTimePassword">复制密码</el-button>
      <el-button @click="oneTimePasswordVisible = false">我已保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.account-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.account-alert {
  margin-bottom: 16px;
}

.icon-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.account-create-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.account-create-icon {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--el-color-primary);
  color: #ffffff;
}

.account-create-icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.account-create-title {
  display: grid;
  gap: 3px;
}

.account-create-title strong {
  color: var(--app-text);
  font-size: 17px;
}

.account-create-title small {
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

.account-create-form {
  display: grid;
  gap: 16px;
}

.account-create-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
  gap: 16px;
  align-items: start;
}

.account-create-main,
.account-create-side {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.account-create-card {
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

.point-tag {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--app-brand-soft);
  color: var(--el-color-primary);
  font-size: 11px;
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

.password-label,
.nickname-label {
  margin-top: 16px;
}

.role-select {
  width: 100%;
}

.security-card {
  background: linear-gradient(180deg, var(--app-brand-soft), var(--app-surface));
}

.security-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.security-list li::marker {
  color: var(--el-color-primary);
}

.role-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.role-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface-soft);
  color: var(--app-text-muted);
  font-size: 12px;
}

.role-list li strong {
  color: var(--app-text);
  font-size: 12px;
}

.role-list li.is-current {
  border-color: var(--el-color-primary-light-5);
  background: var(--app-brand-soft);
  color: var(--app-text);
}

.role-list li em {
  margin-left: auto;
  color: var(--el-color-primary);
  font-size: 11px;
  font-style: normal;
}

.account-create-footer {
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

.account-create-dialog :deep(.el-dialog__body) {
  max-height: calc(100vh - 180px);
  overflow: auto;
  padding-top: 8px;
}

/* ---------- 手机端卡片列表 ---------- */
.account-cards {
  display: grid;
  gap: 10px;
}

.account-mobile-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: var(--app-surface);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-meta {
  color: var(--app-text-muted);
  font-size: 12px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding-top: 6px;
  border-top: 1px dashed var(--app-border);
}

@media (max-width: 760px) {
  .account-create-grid {
    grid-template-columns: 1fr;
  }

  .account-create-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .account-create-dialog :deep(.el-dialog__body) {
    max-height: calc(100svh - 150px);
  }
}
</style>


