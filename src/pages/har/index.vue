<script setup lang="ts">
interface HarNameValuePair {
  name?: string
  value?: string
}

interface HarPostData {
  mimeType?: string
  text?: string
  params?: Array<Record<string, unknown>>
}

interface HarContent {
  size?: number
  mimeType?: string
  text?: string
  encoding?: string
}

interface HarRequest {
  method?: string
  url?: string
  httpVersion?: string
  headers?: HarNameValuePair[]
  queryString?: HarNameValuePair[]
  cookies?: HarNameValuePair[]
  headersSize?: number
  bodySize?: number
  postData?: HarPostData
}

interface HarResponse {
  status?: number
  statusText?: string
  httpVersion?: string
  headers?: HarNameValuePair[]
  cookies?: HarNameValuePair[]
  content?: HarContent
  redirectURL?: string
  headersSize?: number
  bodySize?: number
}

interface HarTimings {
  blocked?: number
  dns?: number
  connect?: number
  ssl?: number
  send?: number
  wait?: number
  receive?: number
}

interface HarEntry {
  startedDateTime?: string
  time?: number
  request?: HarRequest
  response?: HarResponse
  cache?: Record<string, unknown>
  timings?: HarTimings
  serverIPAddress?: string
  connection?: string
  comment?: string
  [key: string]: unknown
}

interface HarLog {
  version?: string
  creator?: unknown
  browser?: unknown
  pages?: unknown
  comment?: string
  entries: HarEntry[]
  [key: string]: unknown
}

interface HarData {
  log: HarLog
}

interface HarDisplayEntry {
  id: string
  entry: HarEntry
}

const harData = ref<HarData | null>(null)
const fileName = ref('')
const fileInput = ref<HTMLInputElement>()
const errorMessage = ref('')
const dragActive = ref(false)
const dragDepth = ref(0)

const selectedEntryId = ref<string | null>(null)
const activeTab = ref('Headers')
const keyword = ref('')

const displayEntries = computed<HarDisplayEntry[]>(() => {
  const entries = (harData.value?.log.entries ?? []).map((entry, index) => ({
    id: buildEntryId(entry, index),
    entry,
  }))

  const search = keyword.value.trim().toLowerCase()
  if (!search)
    return entries

  return entries.filter(({ entry }) => {
    const url = entry.request?.url?.toLowerCase() ?? ''
    const method = entry.request?.method?.toLowerCase() ?? ''
    const status = String(entry.response?.status ?? '')
    const host = getHost(entry.request?.url).toLowerCase()
    return url.includes(search) || method.includes(search) || status.includes(search) || host.includes(search)
  })
})

const selectedEntry = computed(() => {
  return displayEntries.value.find(item => item.id === selectedEntryId.value)
})

function buildEntryId(entry: HarEntry, index: number) {
  return [
    index,
    entry.startedDateTime ?? '',
    entry.request?.method ?? '',
    entry.request?.url ?? '',
    entry.response?.status ?? '',
  ].join('::')
}

function delCurrentEntries() {
  if (!harData.value)
    return

  const idsToRemove = new Set(displayEntries.value.map(item => item.id))
  if (idsToRemove.size === 0)
    return

  const currentEntries = (harData.value.log.entries ?? []).map((entry, index) => ({
    id: buildEntryId(entry, index),
    entry,
  }))
  const nextEntries = currentEntries
    .filter(item => !idsToRemove.has(item.id))
    .map(item => item.entry)

  harData.value.log.entries = nextEntries

  keyword.value = ''
  if (nextEntries.length !== 0) {
    selectedEntryId.value = buildEntryId(nextEntries[0], 0)
    activeTab.value = 'Headers'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArrayPairList(value: unknown): value is HarNameValuePair[] {
  if (!Array.isArray(value))
    return false

  return value.every((item) => {
    if (!isRecord(item))
      return false

    return (item.name === undefined || typeof item.name === 'string')
      && (item.value === undefined || typeof item.value === 'string')
  })
}

function validateHarData(value: unknown): value is HarData {
  if (!isRecord(value))
    return false

  const { log } = value
  if (!isRecord(log) || !Array.isArray(log.entries))
    return false

  return log.entries.every((entry) => {
    if (!isRecord(entry))
      return false

    if (entry.startedDateTime !== undefined && typeof entry.startedDateTime !== 'string')
      return false

    if (entry.time !== undefined && typeof entry.time !== 'number')
      return false

    if (entry.request !== undefined) {
      if (!isRecord(entry.request))
        return false
      if (entry.request.method !== undefined && typeof entry.request.method !== 'string')
        return false
      if (entry.request.url !== undefined && typeof entry.request.url !== 'string')
        return false
      if (entry.request.headers !== undefined && !isStringArrayPairList(entry.request.headers))
        return false
      if (entry.request.queryString !== undefined && !isStringArrayPairList(entry.request.queryString))
        return false
      if (entry.request.cookies !== undefined && !isStringArrayPairList(entry.request.cookies))
        return false
    }

    if (entry.response !== undefined) {
      if (!isRecord(entry.response))
        return false
      if (entry.response.status !== undefined && typeof entry.response.status !== 'number')
        return false
      if (entry.response.statusText !== undefined && typeof entry.response.statusText !== 'string')
        return false
      if (entry.response.headers !== undefined && !isStringArrayPairList(entry.response.headers))
        return false
      if (entry.response.cookies !== undefined && !isStringArrayPairList(entry.response.cookies))
        return false
    }

    return true
  })
}

function readFileText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        resolve(event.target.result)
        return
      }
      reject(new Error('not-string'))
    }
    reader.onerror = () => reject(new Error('read-failed'))
    reader.readAsText(file)
  })
}

async function handleFile(file: File) {
  errorMessage.value = ''
  dragActive.value = false
  dragDepth.value = 0

  try {
    const text = await readFileText(file)
    const parsed: unknown = JSON.parse(text)

    if (!validateHarData(parsed)) {
      errorMessage.value = 'HAR 文件无效：请确认包含正确的 log.entries 和请求字段'
      return
    }

    harData.value = parsed
    fileName.value = file.name
    const firstEntry = parsed.log.entries[0]
    selectedEntryId.value = firstEntry ? buildEntryId(firstEntry, 0) : null
    activeTab.value = 'Headers'
  }
  catch (error) {
    errorMessage.value = error instanceof SyntaxError
      ? 'HAR 文件解析失败，请检查文件内容是否为有效 JSON'
      : 'HAR 文件读取失败，请重新选择文件后再试'
  }
}

function hasDraggedFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onDragEnter(event: DragEvent) {
  if (!hasDraggedFiles(event))
    return

  event.preventDefault()
  dragDepth.value += 1
  dragActive.value = true
}

function onDrop(event: DragEvent) {
  if (!hasDraggedFiles(event))
    return

  event.preventDefault()
  dragActive.value = false
  dragDepth.value = 0

  const files = event.dataTransfer?.files
  if (!files?.length)
    return

  if (files.length > 1) {
    errorMessage.value = '一次只能导入一个 HAR 文件'
    return
  }

  const file = files[0]
  if (file)
    void handleFile(file)
}

function onDragOver(event: DragEvent) {
  if (!hasDraggedFiles(event))
    return

  event.preventDefault()
  dragActive.value = true
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'copy'
}

function onDragLeave(event: DragEvent) {
  if (!hasDraggedFiles(event))
    return

  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0)
    dragActive.value = false
}

function selectFile() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement))
    return

  const file = target.files?.[0]
  if (file)
    void handleFile(file)

  target.value = ''
}

function deleteEntry(id: string) {
  if (!harData.value)
    return

  const currentEntries = (harData.value?.log.entries ?? []).map((entry, index) => ({
    id: buildEntryId(entry, index),
    entry,
  }))
  const removedIndex = currentEntries.findIndex(item => item.id === id)

  const nextEntries = currentEntries
    .filter(item => item.id !== id)
    .map(item => item.entry)

  harData.value.log.entries = nextEntries

  if (selectedEntryId.value === id) {
    const nextId = nextEntries[removedIndex]
      ? buildEntryId(nextEntries[removedIndex], removedIndex)
      : nextEntries[removedIndex - 1]
        ? buildEntryId(nextEntries[removedIndex - 1], removedIndex - 1)
        : null
    selectedEntryId.value = nextId
  }
}

function formatEntry(entry: HarEntry) {
  return JSON.stringify(entry, null, 2)
}

function formatJsonContent(text?: string) {
  if (!text)
    return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  }
  catch {
    return text
  }
}

function formatTime(value?: number) {
  if (typeof value !== 'number')
    return '—'
  return `${Math.round(value)} ms`
}

function formatSize(bytes?: number) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0)
    return '0 B'
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getPath(urlString?: string) {
  if (!urlString)
    return 'Unknown'
  try {
    const url = new URL(urlString)
    return url.pathname.split('/').at(-1) || urlString
  }
  catch {
    return urlString.length > 60 ? `${urlString.slice(0, 60)}...` : urlString
  }
}

function getHost(urlString?: string) {
  if (!urlString)
    return ''
  try {
    return new URL(urlString).hostname
  }
  catch {
    return ''
  }
}

function getContentTypeLabel(value?: string) {
  if (!value)
    return 'unknown'

  return value.split(';')[0] || value
}

function copyText(value: string, successMessage: string) {
  void navigator.clipboard.writeText(value).then(() => {
    ElMessage.success(successMessage)
  }).catch(() => {
    ElMessage.error('复制失败，请重试')
  })
}

function isJsonLikeContent(value?: string) {
  if (!value)
    return false

  const trimmed = value.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function getMethodClass(method?: string) {
  const m = (method || '').toUpperCase()
  if (m === 'GET')
    return 'text-blue-600 dark:text-blue-400'
  if (m === 'POST')
    return 'text-green-600 dark:text-green-400'
  if (m === 'PUT')
    return 'text-yellow-600 dark:text-yellow-400'
  if (m === 'DELETE')
    return 'text-red-600 dark:text-red-400'
  if (m === 'OPTIONS')
    return 'text-purple-600 dark:text-purple-400'
  return 'text-gray-600 dark:text-gray-400'
}

function getStatusClass(status?: number) {
  if (typeof status !== 'number')
    return 'text-gray-500 dark:text-gray-400'
  if (status >= 200 && status < 300)
    return 'text-green-600 dark:text-green-400'
  if (status >= 300 && status < 400)
    return 'text-yellow-600 dark:text-yellow-400'
  if (status >= 400 && status < 500)
    return 'text-orange-600 dark:text-orange-400'
  if (status >= 500)
    return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

function formatFileName(name: string) {
  return name.replace(/\.(har|json)$/i, '') || 'har-export'
}

interface MultipartPart {
  index: number
  name?: string
  filename?: string
  contentType: string
  size: number
  isFile: boolean
  isText: boolean
  isBinaryPlaceholder: boolean
  /** body 是否为 latin1 二进制串（来源于 base64 解码）。false 表示是原生 Unicode 字符串。 */
  isBinaryString: boolean
  /** body 中含有 Unicode 替换符（U+FFFD），表示原始二进制字节在 HAR 导出时已被 UTF-8 解码破坏，不可恢复。 */
  isCorrupted: boolean
  textPreview?: string
  /** 原始 body（latin1 二进制串或 Unicode 字符串），用于后续生成下载文件 */
  body?: string
  headers: Array<{ name: string, value: string }>
}

interface MultipartParseResult {
  boundary: string
  parts: MultipartPart[]
  decodedFromBase64: boolean
  hasBinaryPlaceholder: boolean
  parseError?: string
}

function getBoundary(mimeType?: string) {
  if (!mimeType)
    return ''
  const match = mimeType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  return (match?.[1] ?? match?.[2] ?? '').trim()
}

function isMultipartForm(mimeType?: string) {
  return !!mimeType && /^multipart\/form-data/i.test(mimeType.trim())
}

function looksLikeBase64(value: string) {
  const cleaned = value.replace(/\s+/g, '')
  if (cleaned.length === 0 || cleaned.length % 4 !== 0)
    return false
  return /^[A-Z0-9+/]+={0,2}$/i.test(cleaned)
}

function tryDecodeBase64(value: string): string | null {
  try {
    return atob(value.replace(/\s+/g, ''))
  }
  catch {
    return null
  }
}

function binaryStringToBytes(binary: string) {
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i) & 0xFF
  return bytes
}

function decodeUtf8(binary: string) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(binaryStringToBytes(binary))
  }
  catch {
    return binary
  }
}

function isTextualContentType(contentType: string) {
  if (!contentType)
    return true
  return /^(?:text\/|application\/(?:json|xml|javascript|x-www-form-urlencoded|graphql)|.*\+(?:json|xml))/i.test(contentType.trim())
}

function decodeRfc5987(value: string) {
  // filename*=UTF-8''... support
  const match = value.match(/^([^']*)'[^']*'(.+)$/)
  if (!match)
    return value
  try {
    return decodeURIComponent(match[2])
  }
  catch {
    return match[2]
  }
}

function parseMultipartBody(
  text: string,
  boundary: string,
  params?: Array<Record<string, unknown>>,
  binaryEncoded = false,
): MultipartParseResult {
  const result: MultipartParseResult = {
    boundary,
    parts: [],
    decodedFromBase64: false,
    hasBinaryPlaceholder: false,
  }

  if (!boundary) {
    result.parseError = '未在 Content-Type 中找到 boundary'
    return result
  }

  let raw = text ?? ''
  let isBinaryString = false
  const startsWithBoundary = raw.includes(`--${boundary}`)
  if (binaryEncoded || (!startsWithBoundary && looksLikeBase64(raw))) {
    const decoded = tryDecodeBase64(raw)
    if (decoded != null && decoded.includes(`--${boundary}`)) {
      raw = decoded
      result.decodedFromBase64 = true
      isBinaryString = true
    }
  }

  if (!raw.includes(`--${boundary}`)) {
    result.parseError = '未能在内容中定位到 multipart 边界'
    return result
  }

  // Identify "(binary)" placeholder names from DevTools params
  const placeholderNames = new Set<string>()
  for (const p of params ?? []) {
    const name = typeof p?.name === 'string' ? p.name : undefined
    const value = typeof p?.value === 'string' ? p.value : undefined
    if (name && value === '(binary)')
      placeholderNames.add(name)
  }

  // Normalize: ensure leading CRLF/LF before first boundary so split works
  let normalized = raw
  if (normalized.startsWith(`--${boundary}`))
    normalized = `\r\n${normalized}`
  else if (normalized.startsWith(`\n--${boundary}`))
    normalized = `\r${normalized}`

  const useCrlf = normalized.includes(`\r\n--${boundary}`)
  const delimiter = useCrlf ? `\r\n--${boundary}` : `\n--${boundary}`
  const headerSep = useCrlf ? '\r\n\r\n' : '\n\n'
  const lineSep = useCrlf ? '\r\n' : '\n'

  const segments = normalized.split(delimiter)
  // segments[0] is preamble, last is closing `--\r\n`
  let partIndex = 0
  for (let i = 1; i < segments.length; i++) {
    let seg = segments[i]
    if (seg.startsWith('--'))
      break
    if (seg.startsWith(lineSep))
      seg = seg.slice(lineSep.length)

    const sepIdx = seg.indexOf(headerSep)
    if (sepIdx < 0)
      continue

    const headerBlock = seg.slice(0, sepIdx)
    let body = seg.slice(sepIdx + headerSep.length)
    // The split delimiter consumed leading CRLF before next boundary; nothing to trim from body tail
    // But normalize a possible single trailing CR for LF-only files
    if (!useCrlf && body.endsWith('\r'))
      body = body.slice(0, -1)

    const headers: Array<{ name: string, value: string }> = []
    let name: string | undefined
    let filename: string | undefined
    let contentType = ''

    for (const line of headerBlock.split(lineSep)) {
      const idx = line.indexOf(':')
      if (idx < 0)
        continue
      const headerName = line.slice(0, idx).trim()
      const headerValue = line.slice(idx + 1).trim()
      headers.push({ name: headerName, value: headerValue })

      const lower = headerName.toLowerCase()
      if (lower === 'content-disposition') {
        const nameMatch = headerValue.match(/name="([^"]*)"|name=([^;]+)/i)
        if (nameMatch)
          name = (nameMatch[1] ?? nameMatch[2] ?? '').trim()
        const filenameStarMatch = headerValue.match(/filename\*=([^;]+)/i)
        const filenameMatch = headerValue.match(/filename="([^"]*)"|filename=([^;]+)/i)
        if (filenameStarMatch)
          filename = decodeRfc5987(filenameStarMatch[1].trim())
        else if (filenameMatch)
          filename = (filenameMatch[1] ?? filenameMatch[2] ?? '').trim()
      }
      else if (lower === 'content-type') {
        contentType = headerValue
      }
    }

    const isFile = filename !== undefined
    if (!contentType)
      contentType = isFile ? 'application/octet-stream' : 'text/plain'

    const isBinaryPlaceholder = isFile && body.length === 0 && !!name && placeholderNames.has(name)
    if (isBinaryPlaceholder)
      result.hasBinaryPlaceholder = true

    const treatAsText = !isFile || isTextualContentType(contentType)
    // 检测二进制数据是否已在 HAR 导出阶段被破坏：
    // Chrome 导出未标记 _postDataBinaryEncoded 的 multipart 二进制 body 时，
    // 会按 UTF-8 解码原始字节，非法序列被替换为 U+FFFD，信息不可恢复。
    const isCorrupted = !isBinaryString && isFile && !isTextualContentType(contentType) && body.includes('\uFFFD')

    let textPreview: string | undefined
    if (treatAsText) {
      const previewSource = body.length > 200000 ? `${body.slice(0, 200000)}\n... [已截断]` : body
      // 仅在 body 来自 base64 解码（latin1 二进制串）时按 UTF-8 重新解码，
      // 否则 body 已经是 Unicode 字符串，直接展示，避免中文被二次解码导致乱码。
      textPreview = isBinaryString ? decodeUtf8(previewSource) : previewSource
    }

    // size 用字节数表示更准确：Unicode 字符串需先按 UTF-8 编码计算字节长度
    const byteSize = isBinaryString
      ? body.length
      : new Blob([body]).size

    result.parts.push({
      index: partIndex++,
      name,
      filename,
      contentType,
      size: byteSize,
      isFile,
      isText: treatAsText,
      isBinaryPlaceholder,
      isBinaryString,
      isCorrupted,
      textPreview,
      body: !isBinaryPlaceholder ? body : undefined,
      headers,
    })
  }

  return result
}

function downloadMultipartPart(part: MultipartPart) {
  if (part.body === undefined) {
    ElMessage.warning('该字段没有可下载的数据')
    return
  }
  if (part.isCorrupted) {
    ElMessage.warning('该文件在 HAR 导出时已被破坏（二进制字节被 UTF-8 解码替换），无法还原原文件')
    return
  }
  // 二进制串（base64 解码而来）按字节直接还原；
  // 普通 Unicode 字符串则按 UTF-8 编码生成字节，避免多字节字符被截断导致文件损坏。
  const bytes = part.isBinaryString
    ? binaryStringToBytes(part.body)
    : new TextEncoder().encode(part.body)
  const blob = new Blob([bytes as BlobPart], { type: part.contentType || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = part.filename || part.name || `part-${part.index + 1}`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const multipartParseResult = computed<MultipartParseResult | null>(() => {
  const postData = selectedEntry.value?.entry.request?.postData
  if (!postData || !isMultipartForm(postData.mimeType))
    return null
  const boundary = getBoundary(postData.mimeType)
  const binaryEncoded = (postData as { _postDataBinaryEncoded?: boolean })._postDataBinaryEncoded === true
  return parseMultipartBody(postData.text ?? '', boundary, postData.params, binaryEncoded)
})

function exportHar() {
  if (!harData.value)
    return

  const dataStr = JSON.stringify(harData.value, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${formatFileName(fileName.value)}_edited.har`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div
    class="m relative m-auto h-[calc(100vh-80px)] max-w-[1600px] flex flex-col gap-4 bg-gray-50 p-4 text-gray-800 transition-colors dark:bg-dark-900 dark:text-gray-100"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      v-if="harData && dragActive"
      class="pointer-events-none absolute inset-4 z-20 flex items-center justify-center border-2 border-teal-500 rounded-lg border-dashed bg-teal-500/10 backdrop-blur-[1px]"
    >
      <div class="rounded-lg bg-white/90 px-6 py-4 text-center text-sm text-teal-700 font-medium shadow dark:bg-[#1a1a1c]/90 dark:text-teal-300">
        <div class="text-base font-semibold">
          释放鼠标以替换当前 HAR 文件
        </div>
        <div class="mt-1 text-xs text-teal-600/90 dark:text-teal-300/80">
          当前内容会保留到新文件解析成功为止
        </div>
      </div>
    </div>

    <!-- Header / Toolbar -->
    <div class="flex shrink-0 items-center justify-between">
      <h1 class="text-2xl text-gray-900 font-bold dark:text-gray-100">
        HAR Viewer
      </h1>

      <div class="flex gap-2">
        <el-button type="primary" @click="selectFile">
          {{ harData ? '重新导入' : '选择文件' }}
        </el-button>
        <el-button :disabled="!harData" @click="exportHar">
          导出 HAR
        </el-button>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".har,.json,application/json" hidden @change="onFileChange">

    <div v-if="errorMessage" class="shrink-0 border border-red-200 rounded bg-red-50 px-4 py-3 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
      {{ errorMessage }}
    </div>

    <!-- Empty Dropzone -->
    <div
      v-if="!harData"
      class="flex flex-1 flex-col cursor-pointer items-center justify-center border-2 rounded-lg border-dashed p-10 transition"
      :class="dragActive ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-teal-500 dark:hover:border-teal-500'"
      @click="selectFile"
    >
      <Icon icon="mdi:upload" width="48" class="mb-4 text-gray-400 dark:text-gray-500" />
      <div class="text-lg text-gray-800 font-medium dark:text-gray-200">
        点击选择或拖拽 .har 文件到这里
      </div>
      <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        支持导入、高密度浏览、删除请求并导出
      </div>
    </div>

    <!-- Main Viewer Workspace -->
    <div v-if="harData" class="flex flex-1 gap-2 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-[#1a1a1c]">
      <!-- Left List -->
      <div class="max-w-[500px] min-w-[320px] w-1/3 flex flex-col border-1 border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1a1a1c]">
        <div class="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-[#252529] dark:text-gray-400">
          <div class="flex items-center justify-between gap-3">
            <span class="truncate text-gray-800 font-medium dark:text-gray-200" :title="fileName">{{ formatFileName(fileName) }}</span>
            <div class="flex items-center gap-3">
              <span class="whitespace-nowrap">{{ displayEntries.length }} 项</span>
              <button class="text-red-500 hover:text-red-600 dark:hover:text-red-400" title="删除当前结果" @click="delCurrentEntries">
                <Icon icon="mdi:close-circle" width="18" />
              </button>
            </div>
          </div>

          <el-input v-model="keyword" placeholder="搜索 URL / Method / Status" clearable />
        </div>

        <el-scrollbar>
          <div v-if="displayEntries.length === 0" class="p-8 text-center text-gray-500 dark:text-gray-400">
            {{ keyword ? '没有匹配的请求' : '没有请求记录' }}
          </div>
          <div
            v-for="item in displayEntries" :key="item.id"
            class="group relative cursor-pointer border-b border-gray-100 px-3 py-2.5 transition dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            :class="selectedEntryId === item.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''"
            @click="selectedEntryId = item.id;"
          >
            <div v-if="selectedEntryId === item.id" class="absolute bottom-0 left-0 top-0 w-1 bg-blue-500" />

            <div class="mb-1 flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 overflow-hidden">
                <span class="w-14 shrink-0 text-[11px] font-bold" :class="getMethodClass(item.entry.request?.method)">
                  {{ item.entry.request?.method || 'N/A' }}
                </span>
                <span class="truncate text-sm text-gray-800 font-medium dark:text-gray-200" :title="item.entry.request?.url">
                  {{ getPath(item.entry.request?.url) }}
                </span>
              </div>
              <span class="shrink-0 text-xs font-bold font-mono" :class="getStatusClass(item.entry.response?.status)">
                {{ item.entry.response?.status || '—' }}
              </span>
            </div>

            <div class="flex items-center justify-between pl-16 text-[11px] text-gray-500 dark:text-gray-400">
              <span class="truncate pr-2" :title="getHost(item.entry.request?.url)">{{ getHost(item.entry.request?.url) }}</span>
              <div class="flex shrink-0 gap-3">
                <span>{{ formatSize(item.entry.response?.content?.size) }}</span>
                <span>{{ formatTime(item.entry.time) }}</span>
              </div>
            </div>

            <button
              class="absolute right-2 top-2 border border-gray-200 rounded bg-white p-1 text-gray-400 opacity-0 shadow-sm transition dark:border-gray-700 dark:bg-gray-800 hover:text-red-500 group-hover:opacity-100 dark:hover:text-red-400"
              title="删除" @click.stop="deleteEntry(item.id)"
            >
              <Icon icon="mdi:delete" width="14" />
            </button>
          </div>
        </el-scrollbar>
      </div>

      <!-- Right Details -->
      <div class="relative min-w-0 flex flex-1 flex-col overflow-hidden border-1 border-gray-200 bg-white dark:border-gray-700 dark:bg-[#1e1e20]">
        <div v-if="!selectedEntry" class="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500">
          在左侧选择一个请求以查看详情
        </div>

        <div v-else class="h-full flex flex-col">
          <!-- Custom Tabs for better dark mode compatibility -->
          <div class="flex shrink-0 gap-1 border-b border-gray-200 bg-gray-50 px-2 pt-2 dark:border-gray-700 dark:bg-[#1a1a1c]">
            <button
              v-for="tab in ['Headers', 'Payload', 'Response', 'Timing', 'Raw']" :key="tab"
              class="border-b-2 px-4 py-2 text-sm font-medium transition-colors"
              :class="activeTab === tab ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
              @click="activeTab = tab"
            >
              {{ tab }}
            </button>
          </div>

          <!-- Tab Content -->
          <div class="flex-1 overflow-hidden bg-white dark:bg-[#1e1e20]">
            <el-scrollbar>
              <div class="p-4 space-y-6">
                <!-- Headers Tab -->
                <template v-if="activeTab === 'Headers'">
                  <section>
                    <h3 class="mb-3 border-b border-gray-100 pb-1 text-gray-800 font-bold dark:border-gray-800 dark:text-gray-200">
                      General
                    </h3>
                    <div class="grid grid-cols-[250px_1fr] gap-2 px-2 py-1.5 text-left text-sm">
                      <div class="text-gray-500 dark:text-gray-400">
                        Request URL:
                      </div>
                      <div class="break-all text-gray-900 dark:text-gray-100">
                        {{ selectedEntry.entry.request?.url }}
                      </div>
                      <div class="text-gray-500 dark:text-gray-400">
                        Request Method:
                      </div>
                      <div class="text-gray-900 dark:text-gray-100">
                        {{ selectedEntry.entry.request?.method }}
                      </div>
                      <div class="text-gray-500 dark:text-gray-400">
                        Status Code:
                      </div>
                      <div class="text-gray-900 dark:text-gray-100" :class="getStatusClass(selectedEntry.entry.response?.status)">
                        {{ selectedEntry.entry.response?.status }} {{ selectedEntry.entry.response?.statusText }}
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 class="mb-3 border-b border-gray-100 pb-1 text-gray-800 font-bold dark:border-gray-800 dark:text-gray-200">
                      Response Headers ({{ selectedEntry.entry.response?.headers?.length || 0 }})
                    </h3>
                    <div v-if="!selectedEntry.entry.response?.headers?.length" class="text-sm text-gray-400 dark:text-gray-500">
                      No response headers
                    </div>
                    <div class="text-left text-sm space-y-2">
                      <template v-for="(h, i) in selectedEntry.entry.response?.headers" :key="i">
                        <div class="grid grid-cols-[250px_1fr] items-start gap-3 border border-transparent rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-[#222226]">
                          <div class="break-all text-left text-gray-600 font-medium dark:text-gray-400">
                            {{ h.name }}:
                          </div>
                          <div class="break-all text-left text-gray-900 dark:text-gray-200">
                            {{ h.value }}
                          </div>
                        </div>
                      </template>
                    </div>
                  </section>

                  <section>
                    <h3 class="mb-3 border-b border-gray-100 pb-1 text-gray-800 font-bold dark:border-gray-800 dark:text-gray-200">
                      Request Headers ({{ selectedEntry.entry.request?.headers?.length || 0 }})
                    </h3>
                    <div v-if="!selectedEntry.entry.request?.headers?.length" class="text-sm text-gray-400 dark:text-gray-500">
                      No request headers
                    </div>
                    <div class="text-left text-sm space-y-2">
                      <template v-for="(h, i) in selectedEntry.entry.request?.headers" :key="i">
                        <div class="grid grid-cols-[250px_1fr] items-start gap-3 border border-transparent rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-[#222226]">
                          <div class="break-all text-left text-gray-600 font-medium dark:text-gray-400">
                            {{ h.name }}:
                          </div>
                          <div class="break-all text-left text-gray-900 dark:text-gray-200">
                            {{ h.value }}
                          </div>
                        </div>
                      </template>
                    </div>
                  </section>
                </template>

                <!-- Payload Tab -->
                <template v-else-if="activeTab === 'Payload'">
                  <section>
                    <h3 class="mb-3 border-b border-gray-100 pb-1 text-gray-800 font-bold dark:border-gray-800 dark:text-gray-200">
                      Query String Parameters ({{ selectedEntry.entry.request?.queryString?.length || 0 }})
                    </h3>
                    <div v-if="!selectedEntry.entry.request?.queryString?.length" class="text-sm text-gray-400 dark:text-gray-500">
                      No query parameters
                    </div>
                    <div class="text-left text-sm space-y-2">
                      <template v-for="(q, i) in selectedEntry.entry.request?.queryString" :key="i">
                        <div class="grid grid-cols-[180px_1fr] items-start gap-3 border border-transparent rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-[#222226]">
                          <div class="break-all text-left text-gray-600 font-medium dark:text-gray-400">
                            {{ q.name }}:
                          </div>
                          <div class="break-all text-left text-gray-900 dark:text-gray-200">
                            {{ q.value }}
                          </div>
                        </div>
                      </template>
                    </div>
                  </section>

                  <section v-if="selectedEntry.entry.request?.postData" class="mt-6">
                    <h3 class="mb-3 border-b border-gray-100 pb-1 text-gray-800 font-bold dark:border-gray-800 dark:text-gray-200">
                      Request Payload
                    </h3>
                    <div class="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      MIME: {{ selectedEntry.entry.request.postData.mimeType || 'unknown' }}
                    </div>

                    <!-- Multipart/form-data 解析视图 -->
                    <template v-if="multipartParseResult">
                      <div v-if="multipartParseResult.parseError" class="border border-orange-200 rounded bg-orange-50 px-3 py-2 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                        {{ multipartParseResult.parseError }}，已显示原始内容
                      </div>
                      <template v-else>
                        <div class="mb-3 flex flex-wrap items-center gap-2 text-xs">
                          <span class="rounded bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            boundary: {{ multipartParseResult.boundary }}
                          </span>
                          <span class="rounded bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {{ multipartParseResult.parts.length }} parts
                          </span>
                          <span v-if="multipartParseResult.decodedFromBase64" class="rounded bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            已自动 Base64 解码
                          </span>
                          <span v-if="multipartParseResult.hasBinaryPlaceholder" class="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                            包含 (binary) 占位符（DevTools 未保存原始字节）
                          </span>
                        </div>

                        <div class="space-y-3">
                          <div
                            v-for="part in multipartParseResult.parts"
                            :key="part.index"
                            class="border border-gray-200 rounded-md bg-gray-50 dark:border-gray-800 dark:bg-[#161618]"
                          >
                            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
                              <div class="flex flex-wrap items-center gap-2 text-sm">
                                <span class="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 font-mono dark:bg-blue-900/40 dark:text-blue-300">
                                  #{{ part.index + 1 }}
                                </span>
                                <span class="text-gray-800 font-semibold dark:text-gray-200">
                                  {{ part.name || '(unnamed)' }}
                                </span>
                                <span v-if="part.filename" class="break-all text-gray-600 dark:text-gray-400">
                                  {{ part.filename }}
                                </span>
                                <span class="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                  {{ getContentTypeLabel(part.contentType) }}
                                </span>
                                <span class="text-xs text-gray-500 dark:text-gray-400">
                                  {{ formatSize(part.size) }}
                                </span>
                                <span v-if="part.isBinaryPlaceholder" class="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                                  binary 占位
                                </span>
                                <span v-if="part.isCorrupted" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300" title="HAR 导出时 Chrome 将二进制字节按 UTF-8 解码，原始文件已不可恢复">
                                  已损坏
                                </span>
                              </div>
                              <div class="flex items-center gap-2">
                                <button
                                  v-if="part.isFile && !part.isBinaryPlaceholder && part.body !== undefined"
                                  class="flex items-center gap-1 border rounded bg-white px-2.5 py-1 text-xs transition dark:bg-[#1e1e20]"
                                  :class="part.isCorrupted
                                    ? 'border-red-300 text-red-600 cursor-not-allowed dark:border-red-700 dark:text-red-400 opacity-70'
                                    : 'border-teal-300 text-teal-600 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/20'"
                                  :title="part.isCorrupted ? 'HAR 导出时二进制已被破坏，无法下载原文件' : ''"
                                  @click="downloadMultipartPart(part)"
                                >
                                  <Icon icon="mdi:download" width="14" />
                                  下载文件
                                </button>
                                <button
                                  v-if="part.isText && part.textPreview"
                                  class="border border-gray-200 rounded bg-white px-2.5 py-1 text-xs text-gray-600 transition dark:border-gray-700 hover:border-teal-500 dark:bg-[#1e1e20] dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"
                                  @click="copyText(part.textPreview, '字段内容已复制')"
                                >
                                  复制
                                </button>
                              </div>
                            </div>

                            <div class="p-3">
                              <template v-if="part.isBinaryPlaceholder">
                                <div class="text-sm text-gray-500 italic dark:text-gray-400">
                                  浏览器 DevTools 未保存原始二进制内容（标记为 (binary)）。请使用包含完整 base64 编码的 HAR 文件以获取下载能力。
                                </div>
                              </template>
                              <template v-else-if="part.isFile && !part.isText">
                                <div class="text-sm text-gray-500 dark:text-gray-400">
                                  二进制文件 · {{ formatSize(part.size) }} · 点击右上角“下载文件”保存
                                </div>
                              </template>
                              <template v-else-if="part.textPreview !== undefined">
                                <pre class="whitespace-pre-wrap break-all rounded bg-white p-2 text-left text-sm text-gray-800 leading-6 dark:bg-[#141415] dark:text-gray-300">{{ isJsonLikeContent(part.textPreview) ? formatJsonContent(part.textPreview) : part.textPreview }}</pre>
                              </template>
                              <template v-else>
                                <div class="text-sm text-gray-400 dark:text-gray-500">
                                  (空)
                                </div>
                              </template>
                            </div>
                          </div>
                        </div>
                      </template>
                    </template>

                    <!-- 默认（非 multipart）payload 展示 -->
                    <pre v-else class="whitespace-pre-wrap break-all border border-gray-200 rounded bg-gray-50 p-3 text-left text-sm text-gray-800 leading-6 dark:border-gray-800 dark:bg-[#141415] dark:text-gray-300">{{ isJsonLikeContent(selectedEntry.entry.request.postData.text) ? formatJsonContent(selectedEntry.entry.request.postData.text) : (selectedEntry.entry.request.postData.text || 'No payload body') }}</pre>
                  </section>
                </template>

                <!-- Response Tab -->
                <template v-else-if="activeTab === 'Response'">
                  <div class="grid gap-3 border border-gray-200 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 md:grid-cols-3 dark:border-gray-800 dark:bg-[#161618] dark:text-gray-400">
                    <div><span class="text-gray-800 font-medium dark:text-gray-200">Size:</span> {{ formatSize(selectedEntry.entry.response?.content?.size ?? selectedEntry.entry.response?.bodySize) }}</div>
                    <div><span class="text-gray-800 font-medium dark:text-gray-200">MIME:</span> {{ getContentTypeLabel(selectedEntry.entry.response?.content?.mimeType) }}</div>
                    <div><span class="text-gray-800 font-medium dark:text-gray-200">Encoding:</span> {{ selectedEntry.entry.response?.content?.encoding ?? '—' }}</div>
                  </div>
                  <div class="mt-4 flex items-center justify-between gap-3 text-sm">
                    <div class="text-gray-500 dark:text-gray-400">
                      响应内容预览
                    </div>
                    <button
                      class="border border-gray-200 rounded bg-white px-3 py-1.5 text-xs text-gray-700 transition dark:border-gray-700 hover:border-teal-500 dark:bg-[#1e1e20] dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"
                      @click="copyText(formatJsonContent(selectedEntry.entry.response?.content?.text) || '', '响应内容已复制')"
                    >
                      复制响应体
                    </button>
                  </div>
                  <pre class="mt-3 min-h-40 whitespace-pre-wrap break-all border border-gray-200 rounded bg-gray-50 p-3 text-left text-sm text-gray-800 leading-6 dark:border-gray-800 dark:bg-[#141415] dark:text-gray-300">{{ isJsonLikeContent(selectedEntry.entry.response?.content?.text) ? formatJsonContent(selectedEntry.entry.response?.content?.text) : (selectedEntry.entry.response?.content?.text || 'No response content') }}</pre>
                </template>

                <!-- Timing Tab -->
                <template v-else-if="activeTab === 'Timing'">
                  <div class="max-w-md">
                    <h3 class="mb-3 border-b border-gray-100 pb-1 text-gray-800 font-bold dark:border-gray-800 dark:text-gray-200">
                      Resource Timing
                    </h3>
                    <div class="text-sm space-y-2">
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Blocked</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.blocked) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">DNS Resolution</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.dns) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Connecting</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.connect) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">TLS Setup</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.ssl) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Sending</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.send) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Waiting (TTFB)</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.wait) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-500 dark:text-gray-400">Receiving</span><span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.timings?.receive) }}</span>
                      </div>
                      <div class="mt-2 flex justify-between border-t border-gray-100 pt-2 font-bold dark:border-gray-800">
                        <span class="text-gray-800 dark:text-gray-200">Total</span>
                        <span class="text-gray-900 font-mono dark:text-gray-200">{{ formatTime(selectedEntry.entry.time) }}</span>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Raw Tab -->
                <template v-else-if="activeTab === 'Raw'">
                  <div class="mb-3 flex justify-end">
                    <button
                      class="border border-gray-200 rounded bg-white px-3 py-1.5 text-xs text-gray-700 transition dark:border-gray-700 hover:border-teal-500 dark:bg-[#1e1e20] dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400"
                      @click="copyText(formatEntry(selectedEntry.entry), '原始 Entry JSON 已复制')"
                    >
                      复制 JSON
                    </button>
                  </div>
                  <pre class="whitespace-pre-wrap break-all border border-gray-200 rounded bg-gray-50 p-3 text-left text-sm text-gray-800 leading-6 dark:border-gray-800 dark:bg-[#141415] dark:text-gray-300">{{ formatEntry(selectedEntry.entry) }}</pre>
                </template>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
