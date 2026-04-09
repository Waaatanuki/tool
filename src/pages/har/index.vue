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
                    <pre class="whitespace-pre-wrap break-all border border-gray-200 rounded bg-gray-50 p-3 text-left text-sm text-gray-800 leading-6 dark:border-gray-800 dark:bg-[#141415] dark:text-gray-300">{{ isJsonLikeContent(selectedEntry.entry.request.postData.text) ? formatJsonContent(selectedEntry.entry.request.postData.text) : (selectedEntry.entry.request.postData.text || 'No payload body') }}</pre>
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
