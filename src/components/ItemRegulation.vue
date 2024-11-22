<script setup lang="ts">
defineProps<{ index: number, total: number }>()
defineEmits(['add', 'remove'])
</script>

<template>
  <div flex gap-10px text-3xl>
    <div i-carbon:add-filled text-teal-600 icon-btn hover:text-teal-600 hover:opacity-50 @click="$emit('add', index)" />
    <div :class="{ invisible: index === 0 && total === 1 }" i-carbon:close-filled text-rose-600 icon-btn hover:text-rose-600 hover:opacity-50 @click="$emit('remove', index)" />
  </div>
</template>
