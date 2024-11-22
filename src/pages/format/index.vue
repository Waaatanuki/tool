<script setup lang="ts">
import * as json_typegen_wasm from 'json_typegen_wasm'

const command = ref('json')
const textarea = ref('')

const result = computed(() => {
  try {
    if (command.value === 'json')
      // eslint-disable-next-line no-eval
      return JSON.stringify(eval(`(${textarea.value})`), null, 2)
    if (command.value === 'ts')
      return json_typegen_wasm.run('Root', textarea.value, JSON.stringify({ output_mode: 'typescript' }))
    return ''
  }
  catch (error) {
    return ''
  }
})
</script>

<template>
  <div m-auto max-w-900px>
    <div>
      <el-radio-group v-model="command">
        <el-radio value="json">
          to JSON
        </el-radio>
        <el-radio value="ts">
          to TS
        </el-radio>
      </el-radio-group>
    </div>
    <div fc flex-wrap gap-5>
      <div>
        <el-input
          v-model="textarea"
          style="width: 400px"
          :rows="10"
          type="textarea"
        />
      </div>
      <div>
        <el-input
          v-model="result"
          style="width: 400px"
          :rows="10"
          type="textarea"
        />
      </div>
    </div>
  </div>
</template>
