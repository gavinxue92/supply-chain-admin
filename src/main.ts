import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles.css'

import App from './App.vue'
import { createAppRouter } from './router'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
const router = createAppRouter()
app.use(router)
app.use(ElementPlus)

const auth = useAuthStore()
window.addEventListener('auth:unauthorized', () => {
  auth.clearSession()
  void router.replace({ name: 'login' })
})

void auth.restoreFromServer().finally(() => {
  void router.isReady().then(() => {
    app.mount('#app')
  })
})
