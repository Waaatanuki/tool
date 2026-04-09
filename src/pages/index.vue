<script setup lang="ts">
const menu = ref([
  { name: '利率', desc: '房贷与收益计算', path: 'money', icon: 'ri:money-cny-circle-fill' },
  { name: '时间', desc: '时间戳与日期转换', path: 'time', icon: 'mdi:clock' },
  { name: 'JSON', desc: '数据格式化与预览', path: 'format', icon: 'lucide:file-json' },
  { name: 'HAR', desc: '网络请求抓包分析', path: 'har', icon: 'mdi:file-document-outline' },
  { name: '画板', desc: '轻量自由草图绘制', path: 'whiteboard', icon: 'fluent:whiteboard-48-filled' },
  { name: '色彩', desc: '颜色提取与转换', path: 'color', icon: 'ic:sharp-color-lens' },
])

const router = useRouter()
function go(path: string) {
  router.push(`/${path}`)
}
</script>

<template>
  <div class="mx-auto max-w-4xl min-h-screen flex flex-col px-6 py-12 lg:py-20">
    <!-- Header -->
    <header class="mb-12 md:mb-16">
      <h1 class="mb-3 text-3xl text-gray-900 font-semibold tracking-tight md:text-4xl dark:text-gray-100">
        工具箱
      </h1>
      <p class="text-sm text-gray-500 font-light md:text-base dark:text-gray-400">
        简约、现代的日常开发与效率辅助集。
      </p>
    </header>

    <!-- Grid -->
    <main class="flex-1">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        <div
          v-for="m in menu"
          :key="m.path"
          class="group relative flex flex-col cursor-pointer border border-gray-200/60 rounded-2xl bg-white p-5 transition-all duration-300 ease-out dark:border-zinc-800/80 hover:border-gray-300 dark:bg-zinc-900/50 hover:bg-gray-50/50 md:p-6 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80"
          @click="go(m.path)"
        >
          <div class="mb-4 h-12 w-12 inline-flex items-center justify-center rounded-xl bg-gray-100/80 text-gray-700 transition-all duration-300 group-hover:scale-105 dark:bg-zinc-800 group-hover:bg-white dark:text-gray-300 group-hover:shadow-sm dark:group-hover:bg-zinc-700 dark:group-hover:shadow-none">
            <Icon :icon="m.icon" width="24" height="24" />
          </div>
          <h2 class="mb-1.5 text-base text-gray-800 font-medium dark:text-gray-200">
            {{ m.name }}
          </h2>
          <p class="text-xs text-gray-400 font-light leading-relaxed md:text-sm dark:text-zinc-500">
            {{ m.desc }}
          </p>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <div class="mt-16 flex justify-center">
      <TheFooter />
    </div>
  </div>
</template>
