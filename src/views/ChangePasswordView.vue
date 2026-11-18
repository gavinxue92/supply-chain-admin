<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const newPassword = ref('')

async function submit() {
  if (newPassword.value.length < 12) {
    ElMessage.warning('新密码长度不能少于 12 个字符')
    return
  }
  if (newPassword.value.length > 200) {
    ElMessage.warning('新密码长度不能超过 200 个字符')
    return
  }
  loading.value = true
  try {
    await auth.changePassword(newPassword.value)
    ElMessage.success('密码修改成功，请重新登录')
    await router.replace({ name: 'login' })
  } catch {
    ElMessage.error('密码修改失败，请检查新密码规则')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" header="首次登录改密">
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="新密码">
          <el-input v-model="newPassword" type="password" autocomplete="new-password" show-password :maxlength="200" />
        </el-form-item>
        <el-button type="primary" :loading="loading" style="width: 100%" @click="submit">确认修改</el-button>
      </el-form>
    </el-card>
  </div>
</template>
