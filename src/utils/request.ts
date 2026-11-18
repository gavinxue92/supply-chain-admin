import axios from 'axios'
import { ElMessage } from 'element-plus'

let csrfToken: string | null = null

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

export const request = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

request.interceptors.request.use((config) => {
  if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase()) && csrfToken) {
    config.headers['X-XSRF-TOKEN'] = csrfToken
  }
  return config
})

request.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    if (status === 403) {
      ElMessage.error('没有权限执行此操作，或需要先完成密码修改')
    }
    return Promise.reject(error)
  },
)
