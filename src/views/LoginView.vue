<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function submit() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入企业账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    if (auth.mustChangePassword) {
      await router.replace({ name: 'change-password' })
    } else {
      await router.replace({ name: 'home' })
    }
  } catch {
    ElMessage.error('登录失败，请检查企业账号或密码')
  } finally {
    loading.value = false
  }
}

function openHelp() {
  ElMessage.info('如需帮助，请联系平台管理员')
}
</script>

<template>
  <div class="login-page">
    <header class="login-header">
      <div class="brand-title">食材供应链管理平台</div>
      <nav class="header-actions">
        <button type="button" class="header-link" @click="openHelp">帮助中心</button>
      </nav>
    </header>

    <main class="login-main">
      <section class="login-showcase" aria-label="平台质量管理能力">
        <svg
          class="showcase-art"
          viewBox="0 0 620 560"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="质格质量管理示意图"
        >
          <defs>
            <linearGradient id="shieldOuter" x1="180" y1="120" x2="430" y2="470" gradientUnits="userSpaceOnUse">
              <stop stop-color="#2FB89C" />
              <stop offset="1" stop-color="#0B6F78" />
            </linearGradient>
            <linearGradient id="shieldInner" x1="230" y1="170" x2="380" y2="440" gradientUnits="userSpaceOnUse">
              <stop stop-color="#46CCAA" />
              <stop offset="1" stop-color="#118C7C" />
            </linearGradient>
            <filter id="artShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#052B5B" flood-opacity="0.32" />
            </filter>
          </defs>

          <path d="M0 70 L320 0 L520 130 L520 430 L320 560 L0 490 Z" fill="#FFFFFF" opacity="0.04" />
          <path d="M30 120 L300 30 L470 150 L470 410 L300 520 L30 455 Z" stroke="#FFFFFF" stroke-opacity="0.08" stroke-width="2" />
          <path d="M60 175 L300 75 L440 180 L440 380 L300 480 L60 405 Z" stroke="#FFFFFF" stroke-opacity="0.06" stroke-width="2" />

          <path d="M300 70 L470 140 V300 C470 400 390 470 300 510 C210 470 130 400 130 300 V140 Z" fill="#1B5B92" opacity="0.4" />
          <path d="M300 100 L452 165 V300 C452 385 382 450 300 485 C218 450 148 385 148 300 V165 Z" fill="#2F87AB" opacity="0.4" />

          <path
            d="M300 128 L440 188 V300 C440 380 375 445 300 480 C225 445 160 380 160 300 V188 Z"
            fill="url(#shieldOuter)"
            filter="url(#artShadow)"
          />
          <path
            d="M300 165 L408 213 V300 C408 365 355 420 300 450 C245 420 192 365 192 300 V213 Z"
            fill="url(#shieldInner)"
            stroke="#C8F7E8"
            stroke-opacity="0.55"
            stroke-width="2"
          />
          <text x="300" y="296" text-anchor="middle" dominant-baseline="middle" font-size="64" font-weight="700" fill="#F4FFFB" letter-spacing="6">质格</text>
          <path d="M256 330 H344" stroke="#D8FFF2" stroke-opacity="0.7" stroke-width="2" />

          <g filter="url(#artShadow)">
            <path d="M100 170 L132 154 L164 170 V205 C164 232 132 250 132 250 C132 250 100 232 100 205 Z" fill="#F1FFFB" />
            <text x="132" y="204" text-anchor="middle" dominant-baseline="middle" font-size="18" font-weight="600" fill="#0F7D72">质检</text>
            <path d="M104 208 C94 190 96 172 108 160" stroke="#CBF4E7" stroke-width="3" stroke-linecap="round" />
            <path d="M160 208 C170 190 168 172 156 160" stroke="#CBF4E7" stroke-width="3" stroke-linecap="round" />
          </g>

          <g filter="url(#artShadow)">
            <circle cx="478" cy="228" r="42" fill="#EEFBF8" />
            <circle cx="478" cy="228" r="33" stroke="#2FA98D" stroke-width="2" />
            <text x="478" y="218" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="600" fill="#0F7D72">质检</text>
            <text x="478" y="238" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="600" fill="#0F7D72">合格</text>
          </g>

          <g filter="url(#artShadow)">
            <rect x="62" y="292" width="152" height="150" rx="10" fill="#F7FCFC" />
            <rect x="88" y="278" width="100" height="24" rx="6" fill="#178F84" />
            <text x="138" y="290" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="600" fill="#FFFFFF">供应商档案</text>
            <rect x="84" y="326" width="108" height="7" rx="3.5" fill="#C8DDDD" />
            <rect x="84" y="348" width="86" height="7" rx="3.5" fill="#D6E6E6" />
            <rect x="84" y="370" width="100" height="7" rx="3.5" fill="#C8DDDD" />
            <rect x="84" y="392" width="68" height="7" rx="3.5" fill="#D6E6E6" />
          </g>

          <polyline points="130,476 235,476 360,438 408,392 474,346" stroke="#C9F6E8" stroke-width="2" fill="none" opacity="0.9" />
          <circle cx="130" cy="476" r="5" fill="#EFFFFA" stroke="#3CB99B" stroke-width="2" />
          <circle cx="235" cy="476" r="5" fill="#EFFFFA" stroke="#3CB99B" stroke-width="2" />
          <circle cx="360" cy="438" r="5" fill="#EFFFFA" stroke="#3CB99B" stroke-width="2" />
          <circle cx="408" cy="392" r="5" fill="#EFFFFA" stroke="#3CB99B" stroke-width="2" />
          <circle cx="474" cy="346" r="5" fill="#EFFFFA" stroke="#3CB99B" stroke-width="2" />

          <g filter="url(#artShadow)">
            <rect x="370" y="368" width="132" height="40" rx="8" fill="#2F9D9B" opacity="0.92" />
            <text x="436" y="388" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="600" fill="#F2FFFC">仓储批次</text>
          </g>
          <g filter="url(#artShadow)">
            <rect x="332" y="452" width="132" height="40" rx="8" fill="#2F9D9B" opacity="0.92" />
            <text x="398" y="472" text-anchor="middle" dominant-baseline="middle" font-size="15" font-weight="600" fill="#F2FFFC">冷链批次</text>
          </g>
        </svg>
      </section>

      <section class="login-panel">
        <div class="login-card">
          <h1 class="login-title">账号登录</h1>
          <p class="login-subtitle">供应商管理 · 采购订单 · 库存质检 · 配送追踪</p>

          <el-form class="login-form" @submit.prevent="submit">
            <el-form-item>
              <el-input
                v-model="form.username"
                placeholder="企业账号"
                aria-label="企业账号"
                autocomplete="username"
                size="large"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="form.password"
                type="password"
                placeholder="密码"
                aria-label="密码"
                autocomplete="current-password"
                show-password
                size="large"
              />
            </el-form-item>
            <el-button class="login-button" type="primary" size="large" :loading="loading" @click="submit">
              登录
            </el-button>
          </el-form>

          <p class="login-hint">首次登录请修改初始密码</p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #eef3f9;
}

.login-header {
  height: 64px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  background: #ffffff;
  border-bottom: 1px solid #e8edf3;
}

.brand-title {
  font-size: 18px;
  font-weight: 700;
  color: #173b63;
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  align-items: center;
}

.header-link {
  border: 0;
  background: transparent;
  padding: 8px 4px;
  color: #17817a;
  font-size: 14px;
  cursor: pointer;
}

.header-link:hover {
  color: #0c5f5a;
}

.login-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1.08fr 0.92fr;
  min-height: calc(100vh - 64px);
}

.login-showcase {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 28% 24%, rgba(86, 190, 214, 0.32), transparent 52%),
    linear-gradient(135deg, #0d3b74 0%, #0f5a91 55%, #0d6fa0 100%);
}

.showcase-art {
  position: relative;
  width: min(88%, 620px);
  max-height: 86%;
}

.login-panel {
  display: grid;
  place-items: center;
  padding: 48px 32px;
  background:
    radial-gradient(circle at 78% 10%, rgba(255, 255, 255, 0.9), transparent 45%),
    linear-gradient(180deg, #f7fbff 0%, #eaf1f8 100%);
}

.login-card {
  width: min(420px, 100%);
  padding: 48px 42px 36px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 24px 64px rgba(17, 62, 104, 0.12);
}

.login-title {
  margin: 0 0 10px;
  font-size: 28px;
  font-weight: 700;
  color: #1b2a3d;
}

.login-subtitle {
  margin: 0 0 36px;
  font-size: 13px;
  color: #7c8899;
  letter-spacing: 0.2px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-input__wrapper) {
  height: 48px;
  border-radius: 10px;
  box-shadow: 0 0 0 1px #dfe6ef inset;
  padding: 0 16px;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #169a86 inset;
}

.login-button {
  width: 100%;
  height: 48px;
  margin-top: 8px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(90deg, #10a181, #0b8a73);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 4px;
}

.login-button:hover,
.login-button:focus {
  background: linear-gradient(90deg, #0d937a, #087c69);
}

.login-hint {
  margin: 20px 0 0;
  text-align: center;
  font-size: 13px;
  color: #17817a;
}

@media (max-width: 900px) {
  .login-header {
    padding: 0 20px;
  }

  .login-main {
    grid-template-columns: 1fr;
  }

  .login-showcase {
    min-height: 240px;
  }

  .showcase-art {
    width: min(72%, 380px);
  }

  .login-panel {
    padding: 32px 20px 48px;
  }
}

@media (max-width: 480px) {
  .login-card {
    padding: 36px 24px 28px;
  }

  .login-title {
    font-size: 24px;
  }
}
</style>
