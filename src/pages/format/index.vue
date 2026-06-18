<script setup lang="ts">
import * as json_typegen_wasm from 'json_typegen_wasm'
import JsonCompareEditor from '../../components/JsonCompareEditor.vue'
import JsonNode from './components/JsonNode.vue'

type CommandType = 'json' | 'diff' | 'ts'
type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

interface OutputState {
  ok: boolean
  text: string
  errorMessage: string | null
  parsed?: JsonValue
}

interface DiffStats {
  blocks: number
  added: number
  removed: number
}

const command = ref<CommandType>('json')
const textarea = ref('')
const compareTextarea = ref('')
const diffStats = ref<DiffStats>({
  blocks: 0,
  added: 0,
  removed: 0,
})

const { copy, isSupported } = useClipboard()
const expandId = ref(0)
const collapseId = ref(0)

function parseJsonInput(input: string): JsonValue {
  let parsed: unknown

  try {
    parsed = JSON.parse(input)
  }
  catch {
    throw new Error('请输入合法 JSON，支持标准 JSON 或 JSON.stringify 后的字符串')
  }

  if (typeof parsed !== 'string')
    return parsed as JsonValue

  try {
    return JSON.parse(parsed) as JsonValue
  }
  catch {
    return parsed
  }
}

const outputState = computed<OutputState>(() => {
  const input = textarea.value.trim()
  if (!input) {
    return {
      ok: false,
      text: '',
      errorMessage: null,
    }
  }

  try {
    if (command.value === 'json') {
      const parsed = parseJsonInput(input)
      return {
        ok: true,
        text: JSON.stringify(parsed, null, 2),
        errorMessage: null,
        parsed,
      }
    }

    if (command.value === 'diff') {
      return {
        ok: false,
        text: '',
        errorMessage: null,
      }
    }

    if (command.value === 'ts') {
      return {
        ok: true,
        text: generateTsFromJson(input),
        errorMessage: null,
      }
    }

    return {
      ok: false,
      text: '',
      errorMessage: null,
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    return {
      ok: false,
      text: `解析错误：${errorMessage}`,
      errorMessage,
    }
  }
})

const activeResult = computed(() => command.value === 'diff' ? compareTextarea.value : outputState.value.text)

async function handleCopy() {
  const canCopy = command.value === 'diff' ? Boolean(compareTextarea.value) : outputState.value.ok
  if (!canCopy || !activeResult.value)
    return

  if (!isSupported.value) {
    ElMessage.error('当前浏览器不支持复制')
    return
  }

  try {
    await copy(activeResult.value)
    ElMessage.success('复制成功')
  }
  catch {
    ElMessage.error('复制失败，请重试')
  }
}

const inputHelperText = computed(() => {
  switch (command.value) {
    case 'json':
      return '请输入标准 JSON 或 JSON.stringify 后的字符串，系统会自动识别'
    case 'diff':
      return '左侧为基准 JSON，右侧为对比后的 JSON'
    case 'ts':
      return '请输入 JSON 自动推断并生成 TS 接口'
    default:
      return ''
  }
})

const inputPlaceholder = computed(() => {
  switch (command.value) {
    case 'json':
      return '在此粘贴标准 JSON 内容或 JSON.stringify 之后的字符串结果'
    case 'diff':
      return '在此粘贴基准 JSON'
    case 'ts':
      return '在此粘贴用于生成 TypeScript 类型的 JSON'
    default:
      return ''
  }
})

const result = computed(() => activeResult.value)
const parsedJson = computed(() => outputState.value.parsed)
const canRenderJsonTree = computed(() => command.value !== 'ts' && parsedJson.value !== undefined)
const canExpandRoot = computed(() => parsedJson.value !== undefined && parsedJson.value !== null && typeof parsedJson.value === 'object')

function generateTsFromJson(input: string) {
  const parsed = parseJsonInput(input)
  return json_typegen_wasm.run('Root', JSON.stringify(parsed), JSON.stringify({ output_mode: 'typescript' }))
}

function formatJsonText(input: string) {
  if (!input.trim())
    return ''

  return JSON.stringify(parseJsonInput(input), null, 2)
}

function formatDiffEditor(side: 'left' | 'right') {
  const source = side === 'left' ? textarea.value : compareTextarea.value

  try {
    const formatted = formatJsonText(source)
    if (side === 'left')
      textarea.value = formatted
    else
      compareTextarea.value = formatted
  }
  catch {
    ElMessage.error(side === 'left' ? '左侧不是合法 JSON' : '右侧不是合法 JSON')
  }
}

function updateDiffStats(stats: DiffStats) {
  diffStats.value = stats
}
</script>

<template>
  <div class="m-auto max-w-1200px min-h-screen p-4 lg:p-8 sm:p-6">
    <!-- 控制面板 -->
    <el-card shadow="hover" class="mb-6">
      <div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
        <el-radio-group v-model="command" size="large">
          <el-radio-button value="json">
            JSON解析
          </el-radio-button>
          <el-radio-button value="diff">
            JSON对比
          </el-radio-button>
          <el-radio-button value="ts">
            生成类型文件
          </el-radio-button>
        </el-radio-group>

        <div v-if="command === 'diff'" class="flex flex-wrap items-center justify-center gap-2">
          <el-tag size="small" type="info" effect="plain">
            {{ diffStats.blocks }} 处差异
          </el-tag>
          <el-tag size="small" type="success" effect="plain">
            +{{ diffStats.added }}
          </el-tag>
          <el-tag size="small" type="danger" effect="plain">
            -{{ diffStats.removed }}
          </el-tag>
        </div>
      </div>
    </el-card>

    <!-- 对比工作区 -->
    <div v-if="command === 'diff'" class="flex flex-col gap-6">
      <el-card shadow="hover" class="diff-editor-card rounded-xl" :body-style="{ padding: 0 }">
        <template #header>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-gray-700 font-bold dark:text-gray-200">JSON 差异对比</span>
              <el-tag size="small" type="info" effect="plain">
                左右均可编辑
              </el-tag>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <el-button size="small" @click="formatDiffEditor('left')">
                格式化左侧
              </el-button>
              <el-button size="small" @click="formatDiffEditor('right')">
                格式化右侧
              </el-button>
              <el-button size="small" type="primary" @click="handleCopy">
                复制右侧
              </el-button>
            </div>
          </div>
        </template>

        <JsonCompareEditor
          v-model:left="textarea"
          v-model:right="compareTextarea"
          :dark="isDark"
          @stats-change="updateDiffStats"
        />
      </el-card>
    </div>

    <!-- 工作区 -->
    <div v-else class="flex flex-col gap-6 lg:flex-row">
      <!-- 输入区 -->
      <el-card shadow="hover" class="flex-1 rounded-xl" :body-style="{ padding: 0 }">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-gray-700 font-bold dark:text-gray-200">输入内容</span>
            <el-tag size="small" type="info" effect="plain">
              {{ inputHelperText }}
            </el-tag>
          </div>
        </template>
        <el-input
          v-model="textarea"
          type="textarea"
          :rows="24"
          class="custom-textarea"
          :placeholder="inputPlaceholder"
          resize="none"
        />
      </el-card>

      <!-- 输出区 -->
      <el-card shadow="hover" class="h-full flex flex-1 flex-col rounded-xl" :body-style="{ padding: 0, maxHeight: '570px' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="fc gap-2">
              <span class="text-gray-700 font-bold dark:text-gray-200">输出结果</span>
              <el-button v-if="outputState.ok && result" size="small" type="primary" @click="handleCopy">
                复制结果
              </el-button>
            </div>
            <div class="flex items-center gap-2">
              <template v-if="canExpandRoot">
                <el-button size="small" @click="expandId++">
                  展开全部
                </el-button>
                <el-button size="small" @click="collapseId++">
                  折叠全部
                </el-button>
              </template>

              <el-tag v-if="outputState.ok && result" size="small" type="success" effect="plain">
                解析成功
              </el-tag>
              <el-tag v-else-if="outputState.errorMessage" size="small" type="danger" effect="plain">
                解析失败
              </el-tag>
            </div>
          </div>
        </template>

        <div v-if="canRenderJsonTree && parsedJson !== undefined" class="flex-1 overflow-auto rounded-b-xl bg-gray-50 p-4 dark:bg-gray-900">
          <JsonNode :value="parsedJson" :expand-id="expandId" :collapse-id="collapseId" />
        </div>
        <el-input
          v-else
          :model-value="result"
          type="textarea"
          :rows="24"
          readonly
          class="custom-textarea h-full"
          placeholder="转换结果将在此显示..."
          resize="none"
        />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
:deep(.custom-textarea .el-textarea__inner) {
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 0 12px 12px;
  padding: 16px;
  background-color: transparent;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
}

:deep(.custom-textarea .el-textarea__inner:focus) {
  box-shadow: none !important;
}

:deep(.custom-textarea .el-textarea__inner::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:deep(.custom-textarea .el-textarea__inner::-webkit-scrollbar-thumb) {
  background: #cbd5e1;
  border-radius: 4px;
}

.dark :deep(.custom-textarea .el-textarea__inner::-webkit-scrollbar-thumb) {
  background: #475569;
}

.diff-editor-card {
  overflow: hidden;
}
</style>
