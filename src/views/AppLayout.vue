<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menuItems = computed(() => [
  { index: '/products', label: '产品管理' },
  { index: '/categories', label: '分类管理' },
  { index: '/contact', label: '客服配置' },
  ...(auth.role === 'ADMIN' ? [{ index: '/accounts', label: '账号管理' }] : []),
])

async function logout() {
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
  <el-container class="app-shell">
    <el-aside width="220px" class="app-aside">
      <div class="brand">供应链运营管理</div>
      <el-menu :default-active="route.path" router>
        <el-menu-item v-for="item in menuItems" :key="item.index" :index="item.index">
          {{ item.label }}
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <el-breadcrumb>
          <el-breadcrumb-item :to="{ name: 'home' }">首页</el-breadcrumb-item>
          <el-breadcrumb-item v-if="route.meta.title">{{ route.meta.title }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="user-actions">
          <span>{{ auth.username }}（{{ auth.role }}）</span>
          <el-button link type="primary" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
