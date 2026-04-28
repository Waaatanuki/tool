<script setup lang="ts">
import type { Hsv, Oklch } from 'culori'
import type { ColorPickerInstance } from 'element-plus'
import { Icon } from '@iconify/vue'
import { converter, formatHex, formatHex8, formatHsl, formatRgb, parse, parseOklch, round } from 'culori'

interface ColorResult {
  format: string
  value: string
}

interface ParsedOklch {
  alpha: number
  parsed: Oklch
  source: string
}

const picker = ref<ColorPickerInstance[]>()
const color = ref('#409eff')
const showAlpha = ref(false)

const pickerFormatList = ['rgb', 'hex', 'hsl', 'hsv'] as const
const toHsl = converter('hsl')
const toHsv = converter('hsv')
const roundColor = round(2)

const parsedOklch = computed<ParsedOklch | null>(() => {
  const source = color.value.trim()
  const parsed = parseOklch(source) ?? parse(source)

  if (!parsed || parsed.mode !== 'oklch')
    return null

  return {
    alpha: typeof parsed.alpha === 'number' ? parsed.alpha : 1,
    parsed,
    source,
  }
})

const res = computed<ColorResult[]>(() => {
  if (parsedOklch.value)
    return toOklchResults(parsedOklch.value)

  return picker.value?.reduce<ColorResult[]>((pre, cur) => {
    pre.push({ format: cur.color.format.toUpperCase(), value: cur.color.value })
    return pre
  }, []) || []
})

const { copy, isSupported } = useClipboard()

function normalizeHue(value: number) {
  return ((value % 360) + 360) % 360
}

function formatHsv(color: Hsv) {
  const roundedColor = roundColor(color)
  const hue = normalizeHue(roundedColor.h ?? 0)
  const saturation = (roundedColor.s ?? 0) * 100
  const value = (roundedColor.v ?? 0) * 100

  if ((roundedColor.alpha ?? 1) < 1)
    return `hsva(${hue}, ${saturation}%, ${value}%, ${roundedColor.alpha})`

  return `hsv(${hue}, ${saturation}%, ${value}%)`
}

function toOklchResults(color: ParsedOklch): ColorResult[] {
  const hsl = toHsl(color.parsed)
  const hsv = toHsv(color.parsed)

  if (!hsl || !hsv)
    return [{ format: 'OKLCH', value: color.source }]

  const typedHsv: Hsv = hsv

  return [
    { format: 'OKLCH', value: color.source },
    { format: 'RGB', value: formatRgb(color.parsed) },
    { format: 'HEX', value: (color.alpha < 1 ? formatHex8(color.parsed) : formatHex(color.parsed)).toUpperCase() },
    { format: 'HSL', value: formatHsl(roundColor(hsl)) },
    { format: 'HSV', value: formatHsv(typedHsv) },
  ]
}

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
</script>

<template>
  <div class="m-auto max-w-4xl min-h-screen p-4 lg:p-8 sm:p-6">
    <div class="mb-8">
      <h1 class="mb-2 text-2xl text-gray-900 font-semibold tracking-tight dark:text-gray-100">
        色彩转换
      </h1>
      <p class="text-sm text-gray-500 font-light dark:text-gray-400">
        选择或输入颜色，快速获取对应 RGB、HEX、HSL 等格式值。
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <el-card shadow="hover" class="border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="text-gray-700 font-medium dark:text-gray-200">颜色输入</span>
            <el-switch v-model="showAlpha" active-text="透明度" />
          </div>
        </template>

        <div class="flex flex-col items-center gap-6 py-4">
          <div
            class="relative h-32 w-32 flex items-center justify-center overflow-hidden border border-gray-200 rounded-2xl shadow-inner transition-colors duration-200 dark:border-zinc-700"
          >
            <div class="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVQ4jWNgYGD4Twzu6FhFFGYYNXCABZcYDADn6A/wB7aHCAAAAABJRU5ErkJggg==')] opacity-20 -z-10 dark:opacity-10" />
            <div class="absolute inset-0 z-0" :style="{ backgroundColor: color }" />
            <div class="pointer-events-none absolute opacity-0">
              <el-color-picker
                v-for="format in pickerFormatList"
                :key="format"
                ref="picker"
                v-model="color"
                :color-format="format"
                :show-alpha="showAlpha"
              />
            </div>
          </div>

          <div class="w-full flex items-center gap-4 px-4">
            <el-color-picker v-model="color" :show-alpha="showAlpha" size="large" />
            <el-input v-model="color" placeholder="输入 HEX/RGB/HSL/OKLCH..." clearable size="large" class="flex-1" />
          </div>
        </div>
      </el-card>

      <el-card shadow="hover" class="border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/50">
        <template #header>
          <span class="text-gray-700 font-medium dark:text-gray-200">格式提取</span>
        </template>

        <div class="flex flex-col gap-3 py-2">
          <div
            v-for="r in res"
            :key="r.format"
            class="group flex cursor-pointer items-center justify-between border border-transparent rounded-lg p-3 transition-colors hover:border-gray-200 hover:bg-gray-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
            @click="handleCopy(r.value)"
          >
            <div class="flex flex-col gap-1">
              <span class="text-xs text-gray-500 font-medium">{{ r.format }}</span>
              <span class="text-sm text-gray-800 font-mono dark:text-gray-200">{{ r.value }}</span>
            </div>
            <div class="h-8 w-8 flex items-center justify-center rounded-md bg-white text-gray-400 opacity-0 shadow-sm transition-opacity dark:bg-zinc-900 hover:text-blue-500 group-hover:opacity-100">
              <Icon icon="lucide:copy" width="16" height="16" />
            </div>
          </div>

          <div v-if="!res.length" class="py-8 text-center text-sm text-gray-400">
            暂无转换结果
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
</style>
