<script setup lang="ts">
import type { Change } from 'diff'
import { diffLines } from 'diff'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import 'monaco-editor/min/vs/editor/editor.main.css'

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type DiffSide = 'left' | 'right'
type DiffLineKind = 'added' | 'removed' | 'changed'

interface DiffStats {
  blocks: number
  added: number
  removed: number
}

interface DiffBlock {
  leftStartLine: number
  leftEndLine: number
  rightStartLine: number
  rightEndLine: number
  leftLineCount: number
  rightLineCount: number
  kind: DiffLineKind
}

const props = defineProps<{
  left: string
  right: string
  dark: boolean
}>()

const emit = defineEmits<{
  'update:left': [value: string]
  'update:right': [value: string]
  'statsChange': [stats: DiffStats]
}>()

const leftContainer = ref<HTMLElement>()
const rightContainer = ref<HTMLElement>()

let leftEditor: monaco.editor.IStandaloneCodeEditor | null = null
let rightEditor: monaco.editor.IStandaloneCodeEditor | null = null
let leftModel: monaco.editor.ITextModel | null = null
let rightModel: monaco.editor.ITextModel | null = null
let leftDecorations: monaco.editor.IEditorDecorationsCollection | null = null
let rightDecorations: monaco.editor.IEditorDecorationsCollection | null = null
let disposables: monaco.IDisposable[] = []
let diffTimer: number | undefined
let syncingFromProps = false
let syncingScroll = false

const emptyStats: DiffStats = {
  blocks: 0,
  added: 0,
  removed: 0,
}

const monacoGlobal = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (_workerId: string, label: string) => Worker
  }
}

monacoGlobal.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'json')
      return new JsonWorker()

    return new EditorWorker()
  },
}

const modelOptions = {
  tabSize: 2,
  indentSize: 2,
  insertSpaces: true,
  trimAutoWhitespace: true,
} satisfies monaco.editor.ITextModelUpdateOptions

const editorOptions = {
  automaticLayout: true,
  autoIndent: 'full',
  bracketPairColorization: {
    enabled: true,
  },
  detectIndentation: false,
  fixedOverflowWidgets: true,
  folding: false,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: 14,
  formatOnPaste: false,
  formatOnType: false,
  glyphMargin: false,
  guides: {
    bracketPairs: true,
    indentation: true,
  },
  lineDecorationsWidth: 8,
  lineHeight: 22,
  lineNumbers: 'off',
  lineNumbersMinChars: 0,
  minimap: {
    enabled: false,
  },
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  padding: {
    bottom: 12,
    top: 12,
  },
  readOnly: false,
  renderLineHighlight: 'none',
  renderWhitespace: 'selection',
  scrollBeyondLastLine: false,
  scrollbar: {
    alwaysConsumeMouseWheel: false,
    horizontalScrollbarSize: 10,
    verticalScrollbarSize: 10,
  },
  tabSize: 2,
  wordWrap: 'off',
  wrappingIndent: 'none',
} satisfies monaco.editor.IStandaloneEditorConstructionOptions

function parseJsonInput(input: string): JsonValue {
  const parsed = JSON.parse(input) as unknown

  if (typeof parsed !== 'string')
    return parsed as JsonValue

  try {
    return JSON.parse(parsed) as JsonValue
  }
  catch {
    return parsed
  }
}

function formatJsonText(input: string) {
  if (!input.trim())
    return ''

  return JSON.stringify(parseJsonInput(input), null, 2)
}

function formatJsonTextIfValid(input: string) {
  try {
    return formatJsonText(input)
  }
  catch {
    return input
  }
}

function normalizeInitialText() {
  const left = formatJsonTextIfValid(props.left)
  const right = formatJsonTextIfValid(props.right)

  if (left !== props.left)
    emit('update:left', left)

  if (right !== props.right)
    emit('update:right', right)

  return { left, right }
}

function createJsonModel(value: string, uri: string) {
  const model = monaco.editor.createModel(value, 'json', monaco.Uri.parse(uri))
  model.updateOptions(modelOptions)
  return model
}

function applyTheme() {
  monaco.editor.setTheme(props.dark ? 'vs-dark' : 'vs')
}

function setEditorOptions() {
  leftModel?.updateOptions(modelOptions)
  rightModel?.updateOptions(modelOptions)
  leftEditor?.updateOptions(editorOptions)
  rightEditor?.updateOptions(editorOptions)
}

function syncModelFromProp(side: DiffSide, value: string) {
  const model = side === 'left' ? leftModel : rightModel
  if (!model || model.getValue() === value)
    return

  syncingFromProps = true
  model.setValue(value)
  syncingFromProps = false
  resetHorizontalScroll(model)
  scheduleDiffRefresh()
}

function scheduleDiffRefresh() {
  if (diffTimer !== undefined)
    window.clearTimeout(diffTimer)

  diffTimer = window.setTimeout(() => {
    diffTimer = undefined
    refreshDiff()
  }, 60)
}

function clampLine(line: number, model: monaco.editor.ITextModel | null) {
  if (!model)
    return 1

  return Math.max(1, Math.min(line, model.getLineCount()))
}

function createLineDecoration(startLine: number, endLine: number, kind: DiffLineKind) {
  const color = kind === 'added' ? '#22c55e55' : kind === 'removed' ? '#ef444455' : '#f59e0b55'
  const className = kind === 'added'
    ? 'json-diff-line-added'
    : kind === 'removed'
      ? 'json-diff-line-removed'
      : 'json-diff-line-changed'

  return {
    range: new monaco.Range(startLine, 1, endLine, 1),
    options: {
      className,
      isWholeLine: true,
      linesDecorationsClassName: `${className}-gutter`,
      overviewRuler: {
        color,
        position: monaco.editor.OverviewRulerLane.Full,
      },
    },
  } satisfies monaco.editor.IModelDeltaDecoration
}

function addDecorations(blocks: DiffBlock[]) {
  const left: monaco.editor.IModelDeltaDecoration[] = []
  const right: monaco.editor.IModelDeltaDecoration[] = []

  for (const block of blocks) {
    if (block.leftLineCount > 0) {
      left.push(createLineDecoration(
        clampLine(block.leftStartLine, leftModel),
        clampLine(block.leftEndLine, leftModel),
        block.kind === 'changed' ? 'removed' : block.kind,
      ))
    }

    if (block.rightLineCount > 0) {
      right.push(createLineDecoration(
        clampLine(block.rightStartLine, rightModel),
        clampLine(block.rightEndLine, rightModel),
        block.kind === 'changed' ? 'added' : block.kind,
      ))
    }
  }

  leftDecorations?.set(left)
  rightDecorations?.set(right)
}

function createDiffBlocks(changes: Change[]) {
  const blocks: DiffBlock[] = []
  let leftLine = 1
  let rightLine = 1

  for (let index = 0; index < changes.length; index++) {
    const change = changes[index]

    if (!change.added && !change.removed) {
      leftLine += change.count
      rightLine += change.count
      continue
    }

    let leftLineCount = 0
    let rightLineCount = 0
    let kind: DiffLineKind = 'changed'

    if (change.removed) {
      leftLineCount = change.count

      const nextChange = changes[index + 1]
      if (nextChange?.added) {
        rightLineCount = nextChange.count
        index += 1
      }
      else {
        kind = 'removed'
      }
    }
    else if (change.added) {
      rightLineCount = change.count
      kind = 'added'
    }

    const leftStartLine = leftLine
    const rightStartLine = rightLine
    const leftEndLine = leftLineCount > 0 ? leftLine + leftLineCount - 1 : leftLine - 1
    const rightEndLine = rightLineCount > 0 ? rightLine + rightLineCount - 1 : rightLine - 1

    blocks.push({
      leftStartLine,
      leftEndLine,
      rightStartLine,
      rightEndLine,
      leftLineCount,
      rightLineCount,
      kind,
    })

    leftLine += leftLineCount
    rightLine += rightLineCount
  }

  return blocks
}

function getDiffStats(blocks: DiffBlock[]): DiffStats {
  return blocks.reduce<DiffStats>((stats, block) => {
    stats.blocks += 1
    stats.added += block.rightLineCount
    stats.removed += block.leftLineCount
    return stats
  }, { ...emptyStats })
}

function refreshDiff() {
  if (!leftModel || !rightModel)
    return

  const changes = diffLines(leftModel.getValue(), rightModel.getValue(), {
    ignoreNewlineAtEof: true,
  })
  const blocks = createDiffBlocks(changes)

  addDecorations(blocks)
  emit('statsChange', getDiffStats(blocks))
}

function formatModelAfterPaste(model: monaco.editor.ITextModel | null) {
  if (!model)
    return

  const currentValue = model.getValue()
  const formatted = formatJsonTextIfValid(currentValue)
  if (formatted === currentValue)
    return

  model.setValue(formatted)
  setEditorOptions()
  resetHorizontalScroll(model)
}

function emitModelChange(side: DiffSide) {
  if (syncingFromProps)
    return

  const model = side === 'left' ? leftModel : rightModel
  if (!model)
    return

  if (side === 'left')
    emit('update:left', model.getValue())
  else
    emit('update:right', model.getValue())

  scheduleDiffRefresh()
}

function resetHorizontalScroll(model: monaco.editor.ITextModel) {
  const editor = model === leftModel ? leftEditor : rightEditor
  if (!editor)
    return

  editor.setScrollLeft(0, monaco.editor.ScrollType.Immediate)
  requestAnimationFrame(() => {
    editor.setScrollLeft(0, monaco.editor.ScrollType.Immediate)
  })
}

function isBulkTextChange(event: monaco.editor.IModelContentChangedEvent) {
  return event.changes.some(change => change.text.length > 1 || change.text.includes('\n'))
}

function handleModelContentChange(side: DiffSide, event: monaco.editor.IModelContentChangedEvent) {
  const model = side === 'left' ? leftModel : rightModel

  emitModelChange(side)

  if (isBulkTextChange(event))
    requestAnimationFrame(() => formatModelAfterPaste(model))
}

function syncScroll(source: monaco.editor.IStandaloneCodeEditor, target: monaco.editor.IStandaloneCodeEditor, event: monaco.IScrollEvent) {
  if (syncingScroll)
    return

  syncingScroll = true

  if (event.scrollTopChanged)
    target.setScrollTop(source.getScrollTop(), monaco.editor.ScrollType.Immediate)

  if (event.scrollLeftChanged)
    target.setScrollLeft(source.getScrollLeft(), monaco.editor.ScrollType.Immediate)

  requestAnimationFrame(() => {
    syncingScroll = false
  })
}

function createEditors() {
  if (!leftContainer.value || !rightContainer.value || leftEditor || rightEditor)
    return

  const initialText = normalizeInitialText()
  applyTheme()

  leftModel = createJsonModel(initialText.left, 'inmemory://json-compare/left.json')
  rightModel = createJsonModel(initialText.right, 'inmemory://json-compare/right.json')

  leftEditor = monaco.editor.create(leftContainer.value, {
    ...editorOptions,
    model: leftModel,
  })
  rightEditor = monaco.editor.create(rightContainer.value, {
    ...editorOptions,
    model: rightModel,
  })

  leftDecorations = leftEditor.createDecorationsCollection()
  rightDecorations = rightEditor.createDecorationsCollection()
  setEditorOptions()

  disposables = [
    leftEditor.onDidChangeModelContent(event => handleModelContentChange('left', event)),
    rightEditor.onDidChangeModelContent(event => handleModelContentChange('right', event)),
    leftEditor.onDidPaste(() => requestAnimationFrame(() => formatModelAfterPaste(leftModel))),
    rightEditor.onDidPaste(() => requestAnimationFrame(() => formatModelAfterPaste(rightModel))),
    leftEditor.onDidScrollChange(event => rightEditor && syncScroll(leftEditor!, rightEditor, event)),
    rightEditor.onDidScrollChange(event => leftEditor && syncScroll(rightEditor!, leftEditor, event)),
  ]

  refreshDiff()
}

function disposeEditors() {
  if (diffTimer !== undefined) {
    window.clearTimeout(diffTimer)
    diffTimer = undefined
  }

  disposables.forEach(disposable => disposable.dispose())
  disposables = []

  leftDecorations?.clear()
  rightDecorations?.clear()

  leftEditor?.dispose()
  rightEditor?.dispose()
  leftModel?.dispose()
  rightModel?.dispose()

  leftEditor = null
  rightEditor = null
  leftModel = null
  rightModel = null
  leftDecorations = null
  rightDecorations = null
}

watch(() => props.left, value => syncModelFromProp('left', value))
watch(() => props.right, value => syncModelFromProp('right', value))
watch(() => props.dark, applyTheme)

onMounted(async () => {
  await nextTick()
  createEditors()
})

onBeforeUnmount(() => {
  disposeEditors()
})
</script>

<template>
  <div class="json-compare-editor">
    <div class="json-compare-pane">
      <div class="json-compare-pane__title">
        基准 JSON
      </div>
      <div ref="leftContainer" class="json-compare-pane__editor" />
    </div>
    <div class="json-compare-pane">
      <div class="json-compare-pane__title">
        对比 JSON
      </div>
      <div ref="rightContainer" class="json-compare-pane__editor" />
    </div>
  </div>
</template>

<style scoped>
.json-compare-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 560px;
  height: min(74vh, 760px);
  overflow: hidden;
  background: var(--el-bg-color);
  text-align: left;
}

.json-compare-pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--el-border-color-light);
}

.json-compare-pane + .json-compare-pane {
  border-left: 1px solid var(--el-border-color-light);
}

.json-compare-pane__title {
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
}

.json-compare-pane__editor {
  min-height: 0;
  flex: 1;
}

:deep(.monaco-editor),
:deep(.monaco-editor .view-line),
:deep(.monaco-editor .view-line > span),
:deep(.monaco-editor .view-lines) {
  text-align: left !important;
}

:deep(.json-diff-line-added) {
  background: rgba(34, 197, 94, 0.16);
}

:deep(.json-diff-line-removed) {
  background: rgba(239, 68, 68, 0.16);
}

:deep(.json-diff-line-changed) {
  background: rgba(245, 158, 11, 0.16);
}

:deep(.json-diff-line-added-gutter) {
  border-left: 3px solid #22c55e;
}

:deep(.json-diff-line-removed-gutter) {
  border-left: 3px solid #ef4444;
}

:deep(.json-diff-line-changed-gutter) {
  border-left: 3px solid #f59e0b;
}

@media (max-width: 768px) {
  .json-compare-editor {
    grid-template-columns: 1fr;
    height: 860px;
  }

  .json-compare-pane + .json-compare-pane {
    border-top: 1px solid var(--el-border-color-light);
    border-left: none;
  }
}
</style>
