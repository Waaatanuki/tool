<script setup lang="ts">
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'

const { copy, isSupported } = useClipboard()
const currentTimestamp = useTimestamp({ offset: 0 })

const isSecond = ref(true)
const showTimestamp = computed(() => isSecond.value ? Math.floor(currentTimestamp.value / 1000) : currentTimestamp.value)
const unitLabel = computed(() => isSecond.value ? '秒 (s)' : '毫秒 (ms)')

async function handleCopy(str: string) {
  if (!str)
    return

  if (!isSupported.value) {
    ElMessage.error('当前浏览器不支持复制')
    return
  }

  try {
    await copy(str)
    ElMessage.success('复制成功')
  }
  catch {
    ElMessage.error('复制失败，请重试')
  }
}

const timestamp = ref<string>('')
const timestampFormat = computed(() => {
  if (!timestamp.value)
    return ''

  const val = Number(timestamp.value)
  if (Number.isNaN(val))
    return '无效的时间戳'

  const stamp = timestamp.value.length >= 13 ? val : val * 1000
  const date = dayjs(stamp)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm:ss') : '无效的时间戳'
})

const dateTime = ref<Date | null>(null)
const dateTimeFormat = computed(() => {
  if (!dateTime.value)
    return ''

  return isSecond.value ? dayjs(dateTime.value).unix() : dayjs(dateTime.value).valueOf()
})

const dateRange = ref<[Date, Date] | null>(null)
const dayDiff = computed(() => {
  if (!dateRange.value || !dateRange.value[0] || !dateRange.value[1])
    return ''

  return dayjs(dateRange.value[1]).diff(dayjs(dateRange.value[0]), 'day')
})
</script>

<template>
  <div class="m-auto max-w-4xl min-h-screen p-4 lg:p-8 sm:p-6">
    <div class="mb-8">
      <h1 class="mb-2 text-2xl text-gray-900 font-semibold tracking-tight dark:text-gray-100">
        时间转换
      </h1>
      <p class="text-sm text-gray-500 font-light dark:text-gray-400">
        时间戳与日期的相互转换，及日期差异计算。
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <el-card shadow="hover" class="border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm md:col-span-2 dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <div class="flex flex-col items-center justify-between gap-6 p-4 md:flex-row">
          <div class="flex flex-col gap-2">
            <span class="text-sm text-gray-500 font-medium">当前时间戳</span>
            <div class="flex items-end gap-2 text-3xl text-gray-900 tracking-tight font-mono dark:text-gray-100">
              {{ showTimestamp }}
              <span class="mb-1 text-sm text-gray-400 font-sans">{{ unitLabel }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <el-button @click="isSecond = !isSecond">
              切换为 {{ isSecond ? '毫秒' : '秒' }}
            </el-button>
            <el-button type="primary" @click="handleCopy(String(showTimestamp))">
              复制
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <template #header>
          <span class="text-gray-700 font-medium dark:text-gray-200">时间戳转日期</span>
        </template>
        <div class="flex flex-col gap-4 py-2">
          <el-input v-model="timestamp" placeholder="输入时间戳..." clearable size="large">
            <template #append>
              <el-button :disabled="!timestampFormat || timestampFormat === '无效的时间戳'" @click="handleCopy(timestampFormat)">
                <Icon icon="lucide:copy" />
              </el-button>
            </template>
          </el-input>
          <div class="min-h-12 flex items-center justify-center border border-gray-100 rounded-lg bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <span v-if="timestampFormat" :class="timestampFormat === '无效的时间戳' ? 'text-red-500' : 'text-lg font-mono text-gray-800 dark:text-gray-200'">
              {{ timestampFormat }}
            </span>
            <span v-else class="text-sm text-gray-400">等待输入...</span>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <template #header>
          <span class="text-gray-700 font-medium dark:text-gray-200">日期转时间戳</span>
        </template>
        <div class="flex flex-col gap-4 py-2">
          <el-date-picker v-model="dateTime" type="datetime" placeholder="选择日期时间" class="!w-full" size="large" />
          <div class="group min-h-12 flex items-center justify-between border border-gray-100 rounded-lg bg-gray-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <span v-if="dateTimeFormat" class="text-lg text-gray-800 font-mono dark:text-gray-200">
              {{ dateTimeFormat }}
            </span>
            <span v-else class="text-sm text-gray-400">等待选择...</span>

            <el-button v-if="dateTimeFormat" size="small" text class="opacity-0 transition-opacity group-hover:opacity-100" @click="handleCopy(String(dateTimeFormat))">
              复制
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm md:col-span-2 dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <template #header>
          <span class="text-gray-700 font-medium dark:text-gray-200">日期差计算</span>
        </template>
        <div class="flex flex-col items-center gap-6 py-2 sm:flex-row">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" class="flex-1 !w-full sm:!w-auto" size="large" />
          <div class="min-h-12 w-full flex items-center justify-center border border-gray-100 rounded-lg bg-gray-50 p-3 sm:w-48 dark:border-zinc-800 dark:bg-zinc-900/50">
            <span v-if="dayDiff !== ''" class="text-lg text-gray-800 dark:text-gray-200">
              相差 <span class="mx-1 text-xl text-blue-500 font-bold">{{ dayDiff }}</span> 天
            </span>
            <span v-else class="text-sm text-gray-400">等待选择...</span>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>
