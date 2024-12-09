<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>

<template>
  <el-config-provider :locale="zhCn">
    <van-config-provider :theme="isDark ? 'dark' : 'light'">
      <main font-sans p="x-4 y-10" text="center gray-700 dark:gray-200">
        <RouterView />
      </main>
    </van-config-provider>
  </el-config-provider>
</template>
