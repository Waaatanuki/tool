<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <el-config-provider :locale="zhCn">
    <main font-sans p="x-4 y-10" text="center gray-700 dark:gray-200">
      <RouterView />
    </main>
  </el-config-provider>
</template>
