<script setup lang="ts">
import dayjs from 'dayjs'

interface Item {
  yieldRaito: string
  yieldRaitoShow: boolean
  principal: string
  principalShow: boolean
  daily: number
  weekly: number
  monthly: number
  yearly: number
}

const list = ref<Item[]>([{
  yieldRaito: '1.36',
  yieldRaitoShow: false,
  principal: '100000',
  principalShow: false,
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
  item.yieldRaitoShow = false
  item.principalShow = false
  const ratio = Number(item.yieldRaito) / 100
  const total = Number(item.principal)

  const result = ratio / 365 * total

  item.daily = Number((result).toFixed(2))
  item.weekly = Number((item.daily * 7).toFixed(2))
  item.monthly = Number((item.daily * 30).toFixed(2))
  item.yearly = Number((item.daily * 365).toFixed(2))
}

const current = ref({
  money: '',
  startDate: dayjs().format('YYYY-MM-DD'),
  endDate: dayjs().format('YYYY-MM-DD'),
  daily: 0,
  weekly: 0,
  monthly: 0,
  yearly: 0,
})

const showPicker = ref(false)
const pickerValue = ref<string[]>([])
const currentDateKey = ref< 'startDate' | 'endDate'>('startDate')

const showNumberKeyboard = ref(false)

function handleNumberKeyboardBlur() {
  showNumberKeyboard.value = false
  getResult()
}

function handleOpenPicker(dateKey: 'startDate' | 'endDate') {
  pickerValue.value = current.value[dateKey].split('-')
  currentDateKey.value = dateKey
  showPicker.value = true
}

function onConfirm(data: { selectedValues: string[] }) {
  current.value[currentDateKey.value] = data.selectedValues.join('-')
  showPicker.value = false
  getResult()
}

function getResult() {
  if (!current.value.startDate)
    return

  const dayDiff = dayjs(current.value.endDate).diff(dayjs(current.value.startDate), 'day') || 1
  current.value.daily = Number((Number(current.value.money) / dayDiff).toFixed(2))
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
    <div v-for="item, idx in list" :key="idx" relative mb-8>
      <van-form>
        <van-cell-group inset>
          <van-field v-model="item.yieldRaito" readonly label="年化收益率" @click="item.yieldRaitoShow = true">
            <template #extra>
              %
            </template>
          </van-field>
          <van-number-keyboard
            v-model="item.yieldRaito"
            :show="item.yieldRaitoShow"
            theme="custom"
            extra-key="."
            close-button-text="完成"
            @blur="handleChange(item)"
          />
          <van-field v-model="item.principal" readonly label="本金" @click="item.principalShow = true" />
          <van-number-keyboard
            v-model="item.principal"
            :show="item.principalShow"
            theme="custom"
            extra-key="."
            close-button-text="完成"
            @blur="handleChange(item)"
          />
        </van-cell-group>
      </van-form>

      <ItemRegulation absolute right--2 top--7 :index="idx" :total="list.length" @add="handleAdd" @remove="handleRemove" />

      <el-descriptions mt-4 border :column="4" label-width="100" direction="vertical">
        <el-descriptions-item label="日收益" width="100">
          {{ item.daily }}
        </el-descriptions-item>
        <el-descriptions-item label="周收益" width="100">
          {{ item.weekly }}
        </el-descriptions-item>
        <el-descriptions-item label="月收益" width="100">
          {{ item.monthly }}
        </el-descriptions-item>
        <el-descriptions-item label="年收益" width="100">
          {{ item.yearly }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <van-form>
      <van-cell-group inset>
        <van-field v-model="current.money" readonly label="当前收益" @click="showNumberKeyboard = true" />
        <van-number-keyboard
          v-model="current.money"
          :show="showNumberKeyboard"
          theme="custom"
          extra-key="."
          close-button-text="完成"
          @blur="handleNumberKeyboardBlur"
        />
        <van-field v-model="current.startDate" is-link readonly name="datePicker" label="开始日期" @click="handleOpenPicker('startDate')" />
        <van-field v-model="current.endDate" is-link readonly name="datePicker" label="结束日期" @click="handleOpenPicker('endDate')" />
        <van-popup v-model:show="showPicker" destroy-on-close position="bottom">
          <van-date-picker :model-value="pickerValue" @confirm="onConfirm" @cancel="showPicker = false" />
        </van-popup>
      </van-cell-group>
    </van-form>

    <el-descriptions mt-4 border :column="4" label-width="100" direction="vertical">
      <el-descriptions-item label="日收益" width="100">
        {{ current.daily }}
      </el-descriptions-item>
      <el-descriptions-item label="周收益" width="100">
        {{ current.weekly }}
      </el-descriptions-item>
      <el-descriptions-item label="月收益" width="100">
        {{ current.monthly }}
      </el-descriptions-item>
      <el-descriptions-item label="年收益" width="100">
        {{ current.yearly }}
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>
