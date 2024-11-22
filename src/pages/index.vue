<script setup lang="ts">
const menu = ref([
  { name: '利率', path: 'money', icon: 'ri:money-cny-circle-fill' },
  { name: '时间', path: 'time', icon: 'mdi:clock' },
  { name: 'JSON', path: 'format', icon: 'lucide:file-json' },
])

const router = useRouter()
function go(path: string) {
  router.push(`/${path}`)
}
</script>

<template>
  <div m-auto max-w-600px flex flex-wrap gap-5 border-1 p-5>
    <div v-for="m in menu" :key="m.path" h-10 w-10 fc cursor-pointer hover="ring-1" @click="go(m.path)">
      <Icon :icon="m.icon" width="50" />
    </div>
  </div>
</template>
