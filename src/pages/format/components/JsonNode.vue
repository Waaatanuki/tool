<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonEntry = [string | number, JsonValue]

const props = withDefaults(defineProps<{
  nodeKey?: string | number
  value: JsonValue
  isLast?: boolean
  expandId?: number
  collapseId?: number
  depth?: number
}>(), {
  isLast: true,
  expandId: 0,
  collapseId: 0,
  depth: 0,
})

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const isObject = computed(() => isJsonObject(props.value))
const isArray = computed(() => Array.isArray(props.value))
const isExpandable = computed(() => isObject.value || isArray.value)

const expanded = ref(true)

watch(() => props.expandId, () => {
  if (isExpandable.value && props.expandId > 0) {
    expanded.value = true
  }
})

watch(() => props.collapseId, () => {
  if (isExpandable.value && props.collapseId > 0) {
    expanded.value = false
  }
})

function toggle() {
  if (isExpandable.value) {
    expanded.value = !expanded.value
  }
}

const entries = computed<JsonEntry[]>(() => {
  if (props.value === null)
    return []

  if (isObject.value) {
    return Object.entries(props.value) as JsonEntry[]
  }

  if (isArray.value) {
    return (props.value as Array<JsonValue>).map((entry, index) => [index, entry] as JsonEntry)
  }

  return []
})

const valueType = computed(() => {
  if (props.value === null)
    return 'null'
  if (isArray.value)
    return 'array'
  return typeof props.value
})

const summary = computed(() => {
  if (isArray.value) {
    return `Array(${(props.value as Array<JsonValue>).length})`
  }

  if (isObject.value) {
    return `{${entries.value.length} 项}`
  }

  return String(props.value)
})
</script>

<template>
  <div class="json-node">
    <div class="json-line">
      <button
        v-if="isExpandable"
        type="button"
        class="json-toggle"
        @click="toggle"
      >
        <span class="inline-block transform text-[10px] transition-transform" :class="{ 'rotate-90': expanded }">▶</span>
      </button>

      <div class="json-content">
        <span v-if="nodeKey !== undefined" class="mr-1 text-[#067d17] dark:text-[#a5d6ff]">
          <template v-if="typeof nodeKey === 'string'">"{{ nodeKey }}"</template>
          <template v-else>{{ nodeKey }}</template>:
        </span>

        <template v-if="isExpandable">
          <span v-if="!expanded" class="cursor-pointer text-gray-500 hover:underline" @click="toggle">
            {{ summary }}<template v-if="!isLast">,</template>
          </span>
          <span v-else class="text-gray-700 dark:text-gray-300">{{ isArray ? '[' : '{' }}</span>
        </template>
        <template v-else>
          <span
            :class="{
              'text-[#0a3069] dark:text-[#79c0ff]': valueType === 'string',
              'text-[#0969da] dark:text-[#79c0ff]': valueType === 'number',
              'text-[#cf222e] dark:text-[#ff7b72]': valueType === 'boolean',
              'text-gray-500': valueType === 'null',
            }"
          >
            <template v-if="valueType === 'string'">"{{ value }}"</template>
            <template v-else>{{ String(value) }}</template>
          </span>
        </template>
        <span v-if="!isExpandable && !isLast" class="text-gray-500">,</span>
      </div>
    </div>

    <div v-if="expanded && isExpandable" class="json-children">
      <JsonNode
        v-for="(entry, index) in entries"
        :key="entry[0]"
        :node-key="entry[0]"
        :value="entry[1]"
        :is-last="index === entries.length - 1"
        :expand-id="expandId"
        :collapse-id="collapseId"
        :depth="depth + 1"
      />
    </div>

    <div v-if="expanded && isExpandable" class="json-line">
      <span class="text-gray-700 dark:text-gray-300">{{ isArray ? ']' : '}' }}</span><span v-if="!isLast" class="text-gray-500">,</span>
    </div>
  </div>
</template>

<style scoped>
.json-node {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  text-align: left;
}

.json-line {
  position: relative;
  display: block;
}

.json-content {
  display: block;
  min-height: 22px;
  white-space: normal;
  word-break: break-word;
}

.json-toggle {
  position: absolute;
  top: 4px;
  left: -14px;
  display: inline-flex;
  height: 14px;
  width: 14px;
  cursor: pointer;
  user-select: none;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  padding: 0;
  color: #9ca3af;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

.json-toggle:hover {
  background-color: #e5e7eb;
  color: #4b5563;
}

.json-children {
  padding-left: 16px;
}

:global(.dark) .json-toggle {
  color: #9ca3af;
}

:global(.dark) .json-toggle:hover {
  background-color: #374151;
  color: #e5e7eb;
}
</style>
