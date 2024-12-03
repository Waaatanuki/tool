<script setup lang="ts">
import type { ColorPickerInstance } from 'element-plus'

const picker = ref<ColorPickerInstance[]>()
const color = ref('#409eff')
const showAlpha = ref(false)
const res = computed(() =>
  picker.value?.reduce<{ format: string, value: string }[]>((pre, cur) => {
    pre.push({ format: cur.color.format, value: cur.color.value })
    return pre
  }, []),
)

const formatList = ref(['rgb', 'hex', 'hsl', 'hsv'])

const { copy } = useClipboard()

function handleCopy(str: string) {
  copy(str).then(() => {
    ElMessage.success('复制成功')
  })
}
</script>

<template>
  <div>
    <el-color-picker v-for="format in formatList" :key="format" ref="picker" v-model="color" size="large" :color-format="format" :show-alpha="showAlpha" />
    <el-input v-model="color" style="width: 200px;margin: 20px;" clearable />
    alpha  <el-switch v-model="showAlpha" />
    <div mt-4>
      <div v-for="r in res" :key="r.format">
        <div m-auto w-100 flex>
          <div w-20>
            {{ r.format }}
          </div>
          <div cursor-pointer hover:text-teal-600 @click="handleCopy(r.value)">
            {{ r.value }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
