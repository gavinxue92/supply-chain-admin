import { onMounted, onUnmounted, ref } from 'vue'

/**
 * 移动端断点：<= 899px 视为手机/竖屏平板。
 *
 * 之所以不用 window.innerWidth 直接判断并监听 resize，是因为 matchMedia
 * 在旋转屏幕和浏览器地址栏收起时更准确，也不会有 resize 抖动。
 *
 * 测试环境（jsdom）没有实现 matchMedia，此时退回 innerWidth 判断；
 * jsdom 的 innerWidth 是 1024，所以单元测试默认走桌面分支，
 * 不会影响现有基于 el-table 的断言。
 */
export const MOBILE_MAX_WIDTH = 899
const MOBILE_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`

function detect(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(MOBILE_QUERY).matches
  }
  return window.innerWidth > 0 && window.innerWidth <= MOBILE_MAX_WIDTH
}

export function useIsMobile() {
  const isMobile = ref(detect())
  let query: MediaQueryList | null = null

  const onChange = (event: MediaQueryListEvent) => {
    isMobile.value = event.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    query = window.matchMedia(MOBILE_QUERY)
    isMobile.value = query.matches
    query.addEventListener('change', onChange)
  })

  onUnmounted(() => {
    query?.removeEventListener('change', onChange)
    query = null
  })

  return isMobile
}
