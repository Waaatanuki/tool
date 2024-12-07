<script setup lang="ts">
import dayjs from 'dayjs'

interface Item {
  yieldRange: number
  yieldRaito: number
  principal: number
  daily: number
  weekly: number
  monthly: number
  yearly: number
}

const list = ref<Item[]>([{
  yieldRange: 7,
  yieldRaito: 1.36,
  principal: 100000,
  daily: 0,
  weekly: 0,
  monthly: 0,
  yearly: 0,
}])

function handleAdd(index: number) {
  list.value.splice(index, 0, { ...list.value[index] })
}

function handleRemove(index: number) {
  list.value.splice(index, 1)
}

function handleChange(item: Item) {
  const ratio = item.yieldRaito / 100
  const total = item.principal

  const result = ratio * item.yieldRange / 365 * total

  item.daily = Number((result / item.yieldRange).toFixed(2))
  item.weekly = Number((item.daily * 7).toFixed(2))
  item.monthly = Number((item.daily * 30).toFixed(2))
  item.yearly = Number((item.daily * 365).toFixed(2))
}

const current = ref({
  money: 0,
  dateRange: '',
  daily: 0,
  weekly: 0,
  monthly: 0,
  yearly: 0,
})

function handleCurrentChange() {
  if (!current.value.dateRange)
    return

  const dayDiff = dayjs(current.value.dateRange[1]).diff(dayjs(current.value.dateRange[0]), 'day')
  current.value.daily = Number((current.value.money / dayDiff).toFixed(2))
  current.value.weekly = Number((current.value.daily * 7).toFixed(2))
  current.value.monthly = Number((current.value.daily * 30).toFixed(2))
  current.value.yearly = Number((current.value.daily * 365).toFixed(2))
}

onMounted(() => {
  handleChange(list.value[0])
})
</script>

<template>
  <div m-auto max-w-900px>
    <div v-for="item, idx in list" :key="idx" mb-4>
      <el-form :model="item" inline>
        <el-form-item label="年化收益率范围">
          <el-input v-model="item.yieldRange" style="width: 100px;" @change="handleChange(item)">
            <template #suffix>
              天
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="收益率">
          <el-input v-model="item.yieldRaito" style="width: 100px;" @change="handleChange(item)">
            <template #suffix>
              %
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="本金">
          <el-input v-model="item.principal" style="width: 150px;" @change="handleChange(item)">
            <template #suffix>
              元
            </template>
          </el-input>
        </el-form-item>

        <el-form-item label=" ">
          <ItemRegulation :index="idx" :total="list.length" @add="handleAdd" @remove="handleRemove" />
        </el-form-item>
      </el-form>
      <el-descriptions border :column="4" label-width="100">
        <el-descriptions-item label="每天收益" width="100">
          {{ item.daily }}
        </el-descriptions-item>
        <el-descriptions-item label="每周收益" width="100">
          {{ item.weekly }}
        </el-descriptions-item>
        <el-descriptions-item label="每月收益" width="100">
          {{ item.monthly }}
        </el-descriptions-item>
        <el-descriptions-item label="每年收益" width="100">
          {{ item.yearly }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
    <div mb-4>
      <el-form :model="current" inline>
        <el-form-item label="当前收益">
          <el-input v-model="current.money" style="width: 100px;" @change="handleCurrentChange">
            <template #suffix>
              元
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="起止时间">
          <el-date-picker v-model="current.dateRange" type="daterange" @change="handleCurrentChange" />
        </el-form-item>
      </el-form>
      <el-descriptions border :column="4" label-width="100">
        <el-descriptions-item label="每天收益" width="100">
          {{ current.daily }}
        </el-descriptions-item>
        <el-descriptions-item label="每周收益" width="100">
          {{ current.weekly }}
        </el-descriptions-item>
        <el-descriptions-item label="每月收益" width="100">
          {{ current.monthly }}
        </el-descriptions-item>
        <el-descriptions-item label="每年收益" width="100">
          {{ current.yearly }}
        </el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>
