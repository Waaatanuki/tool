<script setup lang="ts">
import dayjs from 'dayjs'

const isSecond = ref(true)
const { copy } = useClipboard()
const currentTimestamp = useTimestamp({ offset: 0 })
const showTimestamp = computed(() => isSecond.value ? Math.floor (currentTimestamp.value / 1000) : currentTimestamp.value)

const timestamp = ref<string>()
const timestampFormat = computed(() => {
  if (!timestamp.value)
    return ''
  const stamp = timestamp.value.length === 10 ? Number(timestamp.value) * 1000 : Number(timestamp.value)

  return dayjs(stamp).format('YYYY-MM-DD HH:mm:ss')
})
const dateTime = ref()
const dateTimeFormat = computed(() => {
  if (!dateTime.value)
    return ''

  return dayjs(dateTime.value).unix()
})
const dateRange = ref('')

const dayDiff = computed(() => {
  if (!dateRange.value)
    return ''

  return dayjs(dateRange.value[1]).diff(dayjs(dateRange.value[0]), 'day')
})
</script>

<template>
  <div m-auto max-w-900px>
    <div m-auto w-150 flex flex-col items-start gap-2>
      <div m-auto fc flex-col>
        <div text-lg>
          当前时间戳
        </div>
        <div>
          {{ showTimestamp }}
        </div>
        <div>
          <TheButton @click="isSecond = !isSecond">
            切换单位
          </TheButton>
          <TheButton @click="copy(String(showTimestamp))">
            复制
          </TheButton>
        </div>
      </div>
      <div fc gap-2>
        <div w-25 text-end>
          时间戳
        </div>
        <div>
          <el-input v-model="timestamp" style="width: 150px" />
        </div>
        <div>
          {{ timestampFormat }}
        </div>
      </div>
      <div fc gap-2>
        <div w-25 text-end>
          日期
        </div>
        <div>
          <el-date-picker v-model="dateTime" type="datetime" />
        </div>
        <div>
          {{ dateTimeFormat }}
        </div>
      </div>
      <div fc gap-2>
        <div w-25 text-end>
          日期差
        </div>
        <div>
          <el-date-picker v-model="dateRange" type="daterange" />
        </div>
        <div v-if="dayDiff">
          {{ `相差${dayDiff}天` }}
        </div>
      </div>
    </div>
  </div>
</template>
