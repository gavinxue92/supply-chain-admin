const allowedTags = new Set([
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
])
const removedTags = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
])

function mediaIdFromSource(source: string): number | null {
  const match = /^\/api\/v1\/media\/(\d+)$/.exec(source)
  if (!match) return null
  const mediaId = Number(match[1])
  return Number.isSafeInteger(mediaId) ? mediaId : null
}

function sanitizeNode(
  node: Node,
  document: Document,
  allowedMediaIds: number[],
): Node | DocumentFragment | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '')
  }
  if (!(node instanceof Element)) return null

  const tagName = node.tagName.toLowerCase()
  if (removedTags.has(tagName)) return null
  if (tagName === 'img') {
    const mediaId = mediaIdFromSource(node.getAttribute('src') ?? '')
    if (mediaId === null || !allowedMediaIds.includes(mediaId)) return null
    const image = document.createElement('img')
    image.setAttribute('src', `/api/v1/media/${mediaId}`)
    if (node.hasAttribute('alt')) image.setAttribute('alt', node.getAttribute('alt') ?? '')
    return image
  }

  const normalizedTag = tagName === 'b' ? 'strong' : tagName === 'i' ? 'em' : tagName
  if (allowedTags.has(normalizedTag) || tagName === 'div') {
    const safeElement = document.createElement(tagName === 'div' ? 'p' : normalizedTag)
    for (const child of Array.from(node.childNodes)) {
      const safeChild = sanitizeNode(child, document, allowedMediaIds)
      if (safeChild) safeElement.appendChild(safeChild)
    }
    return safeElement
  }

  const unwrapped = document.createDocumentFragment()
  for (const child of Array.from(node.childNodes)) {
    const safeChild = sanitizeNode(child, document, allowedMediaIds)
    if (safeChild) unwrapped.appendChild(safeChild)
  }
  return unwrapped
}

export function sanitizeProductHtml(html: string, allowedMediaIds: number[]): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const safeBody = document.createElement('body')
  for (const child of Array.from(document.body.childNodes)) {
    const safeChild = sanitizeNode(child, document, allowedMediaIds)
    if (safeChild) safeBody.appendChild(safeChild)
  }
  return safeBody.innerHTML
}

export function getProductImageMediaIds(html: string): number[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const mediaIds = new Set<number>()
  for (const image of Array.from(document.images)) {
    const mediaId = mediaIdFromSource(image.getAttribute('src') ?? '')
    if (mediaId !== null) mediaIds.add(mediaId)
  }
  return [...mediaIds]
}
