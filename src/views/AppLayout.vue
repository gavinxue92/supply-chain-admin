<script setup lang="ts">
import axios from 'axios'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import type { AccountApiResult } from '../types/account'

type MenuIcon = 'product' | 'category' | 'contact' | 'account'
interface MenuItem {
  index: string
  label: string
  icon: MenuIcon
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const themeStorageKey = 'supply-chain-admin-theme'
function readDarkPreference(): boolean {
  try {
    return localStorage.getItem(themeStorageKey) === 'dark'
  } catch {
    return false
  }
}

const darkMode = ref(readDarkPreference())
const collapsed = ref(false)

watch(
  darkMode,
  (value) => {
    document.documentElement.classList.toggle('dark', value)
    try {
      localStorage.setItem(themeStorageKey, value ? 'dark' : 'light')
    } catch {
      // 隐私模式下忽略主题持久化失败。
    }
  },
  { immediate: true },
)

const menuItems = computed<MenuItem[]>(() => [
  { index: '/products', label: '产品管理', icon: 'product' },
  { index: '/categories', label: '分类管理', icon: 'category' },
  ...(auth.role === 'ADMIN'
    ? ([
        { index: '/contact', label: '客服配置', icon: 'contact' },
        { index: '/hot-keywords', label: '搜索热词', icon: 'contact' },
        { index: '/shop', label: '店铺信息', icon: 'contact' },
        { index: '/accounts', label: '账号管理', icon: 'account' },
      ] as MenuItem[])
    : []),
])

const roleLabel = computed(() => (auth.role === 'ADMIN' ? '管理员' : '运营编辑'))
const currentTitle = computed(() => String(route.meta.title ?? ''))

const avatarInitials = computed(() => {
  const name = auth.displayName.trim()
  if (!name) return '?'
  if (/[^\x00-\x7F]/.test(name)) return name.slice(0, 2)
  const parts = name.split(/[\s_.@-]+/).filter(Boolean)
  return parts.length > 1
    ? parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : name.slice(0, 2).toUpperCase()
})

const userMenuOpen = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

function onDocumentClick(event: MouseEvent) {
  if (
    userMenuOpen.value &&
    userMenuRef.value &&
    !userMenuRef.value.contains(event.target as Node)
  ) {
    userMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

const nicknameDialogVisible = ref(false)
const nicknameSaving = ref(false)
const nicknameError = ref('')
const nicknameForm = reactive({ nickname: '' })

function navigate(index: string) {
  if (route.path !== index) void router.push(index)
}

function toggleDarkMode() {
  darkMode.value = !darkMode.value
}

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

function openNicknameDialog() {
  userMenuOpen.value = false
  nicknameForm.nickname = auth.nickname ?? ''
  nicknameError.value = ''
  nicknameDialogVisible.value = true
}

function nicknameErrorMessage(error: unknown): string {
  if (axios.isAxiosError<AccountApiResult<unknown>>(error)) {
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (!error.response) return '无法连接服务器，请检查网络后重试'
  }
  if (error instanceof Error && error.message) return error.message
  return '更新昵称失败，请稍后重试'
}

async function submitNickname() {
  if (nicknameSaving.value) return
  const value = nicknameForm.nickname.trim()
  if (value.length > 50) {
    nicknameError.value = '昵称不能超过 50 个字符'
    return
  }
  nicknameSaving.value = true
  try {
    await auth.updateNickname(value || null)
    nicknameDialogVisible.value = false
    ElMessage.success('昵称已更新')
  } catch (error) {
    nicknameError.value = nicknameErrorMessage(error)
  } finally {
    nicknameSaving.value = false
  }
}

async function logout() {
  userMenuOpen.value = false
  await ElMessageBox.confirm('确认退出当前账号？', '退出登录', {
    confirmButtonText: '退出',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    await auth.logout()
    await router.replace({ name: 'login' })
  }).catch(() => undefined)
}
</script>

<template>
  <div class="app-shell">
    <svg class="icon-sprite" aria-hidden="true">
      <symbol id="icon-product" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </symbol>
      <symbol id="icon-category" viewBox="0 0 24 24">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" />
        <path d="m3 13 9 5 9-5" />
      </symbol>
      <symbol id="icon-contact" viewBox="0 0 24 24">
        <path d="M4 13a8 8 0 0 1 16 0" />
        <rect x="3" y="13" width="4" height="6" rx="1.5" />
        <rect x="17" y="13" width="4" height="6" rx="1.5" />
        <path d="M19 19a3 3 0 0 1-3 2h-2" />
      </symbol>
      <symbol id="icon-account" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 5.5a3 3 0 0 1 0 5" />
        <path d="M18 14a6 6 0 0 1 3 5" />
      </symbol>
      <symbol id="icon-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </symbol>
      <symbol id="icon-moon" viewBox="0 0 24 24">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
      </symbol>
      <symbol id="icon-sun" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </symbol>
      <symbol id="icon-fold" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="m16 9-3 3 3 3" />
      </symbol>
      <symbol id="icon-expand" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="m13 9 3 3-3 3" />
      </symbol>
      <symbol id="icon-chevron-down" viewBox="0 0 24 24">
        <path d="m6 9 6 6 6-6" />
      </symbol>
      <symbol id="icon-edit-user" viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20a6 6 0 0 1 11-3.3" />
        <path d="m15.5 18.5 4-4 2 2-4 4h-2v-2Z" />
      </symbol>
      <symbol id="icon-logout" viewBox="0 0 24 24">
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="m14 8 4 4-4 4" />
        <path d="M18 12H9" />
      </symbol>
    </svg>

    <header class="app-header">
      <div class="header-brand" :class="{ 'is-collapsed': collapsed }">
        <span class="brand-mark"><svg class="app-icon"><use href="#icon-product" /></svg></span>
        <span v-if="!collapsed" class="brand-text">供应链管理</span>
      </div>
      <el-breadcrumb separator="/" class="header-breadcrumb">
        <el-breadcrumb-item :to="{ name: 'home' }">首页</el-breadcrumb-item>
        <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-right">
        <div ref="userMenuRef" class="user-menu">
          <button
            type="button"
            class="user-trigger"
            :class="{ 'is-open': userMenuOpen }"
            aria-haspopup="menu"
            :aria-expanded="userMenuOpen"
            @click="toggleUserMenu"
          >
            <span class="user-avatar">{{ avatarInitials }}</span>
            <span class="user-meta">
              <span class="user-name">{{ auth.displayName }}</span>
              <span class="user-role">{{ roleLabel }}</span>
            </span>
            <svg class="app-icon user-chevron" :class="{ 'is-open': userMenuOpen }">
              <use href="#icon-chevron-down" />
            </svg>
          </button>

          <div v-if="userMenuOpen" class="user-dropdown" role="menu">
            <div class="dropdown-profile">
              <span class="dropdown-name">{{ auth.displayName }}</span>
              <span class="dropdown-subtitle">{{ auth.username }}</span>
            </div>
            <div class="dropdown-divider"></div>
            <button type="button" class="dropdown-item" role="menuitem" @click="openNicknameDialog">
              <svg class="app-icon"><use href="#icon-edit-user" /></svg>
              <span>修改昵称</span>
            </button>
            <div class="dropdown-divider"></div>
            <button type="button" class="dropdown-item is-danger" role="menuitem" @click="logout">
              <svg class="app-icon"><use href="#icon-logout" /></svg>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="app-body">
      <aside class="app-aside" :class="{ 'is-collapsed': collapsed }">
        <nav class="app-nav" aria-label="主导航">
          <button
            v-for="item in menuItems"
            :key="item.index"
            type="button"
            class="nav-item"
            :class="{ 'is-active': route.path === item.index }"
            :title="collapsed ? item.label : undefined"
            @click="navigate(item.index)"
          >
            <svg class="app-icon"><use :href="`#icon-${item.icon}`" /></svg>
            <span v-if="!collapsed" class="nav-label">{{ item.label }}</span>
          </button>
        </nav>

        <div class="aside-footer">
          <button
            type="button"
            class="nav-item"
            :title="darkMode ? '切换浅色模式' : '切换深色模式'"
            @click="toggleDarkMode"
          >
            <svg class="app-icon">
              <use :href="darkMode ? '#icon-sun' : '#icon-moon'" />
            </svg>
            <span v-if="!collapsed" class="nav-label">{{ darkMode ? '浅色模式' : '深色模式' }}</span>
          </button>
          <button
            type="button"
            class="nav-item"
            :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="toggleCollapsed"
          >
            <svg class="app-icon">
              <use :href="collapsed ? '#icon-expand' : '#icon-fold'" />
            </svg>
            <span v-if="!collapsed" class="nav-label">收起</span>
          </button>
        </div>
      </aside>

      <main class="app-main">
        <router-view />
      </main>
    </div>

    <el-dialog v-model="nicknameDialogVisible" title="修改昵称" width="440px" destroy-on-close>
      <el-form label-width="80px" @submit.prevent="submitNickname">
        <el-form-item label="昵称">
          <el-input
            v-model="nicknameForm.nickname"
            placeholder="请输入昵称，最多 50 个字符；留空可清除昵称"
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
        />
      </el-form>
      <template #footer>
        <el-button @click="nicknameDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="nicknameSaving" @click="submitNickname">
          保存昵称
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.icon-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.app-icon {
  width: 18px;
  height: 18px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--app-text);
}

.app-header {
  height: 60px;
  flex: none;
  display: flex;
  align-items: center;
  background: var(--app-header-bg);
  border-bottom: 1px solid var(--app-border);
  padding-right: 24px;
}

.header-brand {
  width: 208px;
  flex: none;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-right: 1px solid var(--app-border);
  transition: width 0.2s ease;
}

.header-brand.is-collapsed {
  width: 64px;
  justify-content: center;
  padding: 0;
}

.brand-mark {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--app-brand);
  color: #ffffff;
}

.brand-mark .app-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2;
}

.brand-text {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
}

.header-breadcrumb {
  margin-left: 20px;
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
}

.user-menu {
  position: relative;
}

.user-trigger {
  min-width: 184px;
  height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 4px 6px;
  border: 0;
  border-radius: 24px;
  background: var(--app-user-bg);
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.user-trigger:hover,
.user-trigger.is-open {
  background: var(--app-user-bg-hover);
}

.user-avatar {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--app-brand);
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.user-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role {
  font-size: 12px;
  color: var(--app-text-muted);
}

.user-chevron {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--app-text-muted);
  transition: transform 0.15s ease;
}

.user-chevron.is-open {
  transform: rotate(180deg);
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 30;
  width: 280px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: var(--app-surface);
  box-shadow: 0 18px 44px rgba(16, 45, 60, 0.16);
}

.dropdown-profile {
  display: grid;
  gap: 4px;
  padding: 12px 12px 14px;
}

.dropdown-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.dropdown-subtitle {
  font-size: 13px;
  color: var(--app-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-divider {
  height: 1px;
  margin: 0 4px;
  background: var(--app-border);
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--app-surface-soft);
}

.dropdown-item.is-danger {
  color: #e34b4b;
}

.dropdown-item.is-danger:hover {
  background: rgba(227, 75, 75, 0.1);
}

.app-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.app-aside {
  width: 208px;
  flex: none;
  display: flex;
  flex-direction: column;
  background: var(--app-surface);
  border-right: 1px solid var(--app-border);
  transition: width 0.2s ease;
}

.app-aside.is-collapsed {
  width: 64px;
}

.app-nav {
  display: grid;
  gap: 6px;
  padding: 16px 10px;
}

.nav-item {
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-item:hover {
  background: var(--app-surface-soft);
  color: var(--app-text);
}

.nav-item.is-active {
  background: var(--app-brand-soft);
  color: var(--app-brand);
  font-weight: 600;
}

.app-aside.is-collapsed .nav-item {
  justify-content: center;
  padding: 0;
}

.app-aside.is-collapsed .nav-label {
  display: none;
}

.aside-footer {
  margin-top: auto;
  display: grid;
  gap: 4px;
  padding: 10px;
  border-top: 1px solid var(--app-border);
}

.app-main {
  flex: 1;
  min-width: 0;
  padding: 24px;
  overflow: auto;
}

@media (max-width: 720px) {
  .user-trigger {
    min-width: 0;
  }

  .user-meta {
    display: none;
  }

  .app-main {
    padding: 16px;
  }
}
</style>
