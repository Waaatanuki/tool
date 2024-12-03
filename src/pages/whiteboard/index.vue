<script setup lang="ts">
import type { Brush, DrawingMode } from 'drauu'
import { createDrauu } from 'drauu'

onUnmounted(() => {
  if (!isDark.value) {
    toggleDark()
  }
})

onMounted(() => {
  if (isDark.value) {
    toggleDark()
  }

  const drauu = createDrauu({
    el: '#svg',
    brush: {
      color: '#000',
      size: 3,
    },
    // acceptsInputTypes: ['pen'],
  })

  const sizeEl = document.getElementById('size')! as HTMLInputElement
  sizeEl.addEventListener('input', () => drauu.brush.size = +sizeEl.value)

  const modes: { el: HTMLElement, brush: Partial<Brush> }[] = [
    { el: document.getElementById('m-stylus')!, brush: { mode: 'stylus', arrowEnd: false } },
    { el: document.getElementById('m-eraser')!, brush: { mode: 'eraseLine', arrowEnd: false } },
    { el: document.getElementById('m-draw')!, brush: { mode: 'draw', arrowEnd: false } },
    { el: document.getElementById('m-line')!, brush: { mode: 'line', arrowEnd: false } },
    { el: document.getElementById('m-arrow')!, brush: { mode: 'line', arrowEnd: true } },
    { el: document.getElementById('m-rect')!, brush: { mode: 'rectangle', arrowEnd: false } },
    { el: document.getElementById('m-ellipse')!, brush: { mode: 'ellipse', arrowEnd: false } },
  ]
  modes.forEach(({ el, brush }) => {
    el.addEventListener('click', () => {
      modes.forEach(({ el }) => el.classList.remove('active'))
      el.classList.add('active')
      drauu.brush.arrowEnd = brush.arrowEnd
      drauu.mode = brush.mode as DrawingMode
    })
  })

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      if (e.shiftKey)
        drauu.redo()
      else
        drauu.undo()
      return
    }

    if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)
      return

    if (e.code === 'KeyL') {
      drauu.mode = 'line'
      modes.forEach(({ el }) => el.classList.remove('active'))
      document.getElementById('m-line')!.classList.add('active')
    }
    else if (e.code === 'KeyD') {
      drauu.mode = 'draw'
      modes.forEach(({ el }) => el.classList.remove('active'))
      document.getElementById('m-draw')!.classList.add('active')
    }
    else if (e.code === 'KeyS') {
      drauu.mode = 'stylus'
      modes.forEach(({ el }) => el.classList.remove('active'))
      document.getElementById('m-stylus')!.classList.add('active')
    }
    else if (e.code === 'KeyR') {
      drauu.mode = 'rectangle'
      modes.forEach(({ el }) => el.classList.remove('active'))
      document.getElementById('m-rect')!.classList.add('active')
    }
    else if (e.code === 'KeyE') {
      drauu.mode = 'ellipse'
      modes.forEach(({ el }) => el.classList.remove('active'))
      document.getElementById('m-ellipse')!.classList.add('active')
    }
    else if (e.code === 'KeyC') {
      drauu.clear()
    }
    else if (e.code === 'Equal') {
      drauu.brush.size = Math.min(10, drauu.brush.size + 0.5)
      sizeEl.value = `${drauu.brush.size}`
    }
    else if (e.code === 'Minus') {
      drauu.brush.size = Math.max(1, drauu.brush.size - 0.5)
      sizeEl.value = `${drauu.brush.size}`
    }
  })

  document.getElementById('undo')?.addEventListener('click', () => drauu.undo())
  document.getElementById('redo')?.addEventListener('click', () => drauu.redo())
  document.getElementById('clear')?.addEventListener('click', () => drauu.clear())
  document.getElementById('download')?.addEventListener('click', () => {
    drauu.el!.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const data = drauu.el!.outerHTML || ''
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const elem = window.document.createElement('a')
    elem.href = window.URL.createObjectURL(blob)
    elem.download = 'drauu.svg'
    document.body.appendChild(elem)
    elem.click()
    document.body.removeChild(elem)
  })

  const lines: { el: HTMLElement, value: string | undefined }[] = [
    { el: document.getElementById('l-solid')!, value: undefined },
    { el: document.getElementById('l-dashed')!, value: '4' },
    { el: document.getElementById('l-dotted')!, value: '1 7' },
  ]

  lines.forEach(({ el, value }) => {
    el.addEventListener('click', () => {
      lines.forEach(({ el }) => el.classList.remove('active'))
      el.classList.add('active')
      drauu.brush.dasharray = value
    })
  })

  const colors = Array.from(document.querySelectorAll('[data-color]'))
  colors
    .forEach((i) => {
      i.addEventListener('click', () => {
        colors.forEach(i => i.classList.remove('active'))
        i.classList.add('active')
        drauu.brush.color = (i as HTMLElement).dataset.color!
      })
    })
})
</script>

<template>
  <div h-92vh class="whiteboard">
    <div class="mt--8 flex flex-wrap gap-0.5 border-b border-gray-200 p-3 px-6 children:my-auto children:align-middle">
      <h1 class="mr-2 text-xl font-serif">
        <a href="https://github.com/antfu-sponsors/drauu" target="_blank" class="font-serif opacity-50 hover:opacity-100">Drauu</a>
      </h1>
      <div class="mx-4 opacity-25">
        /
      </div>
      <button id="undo" aria-label="Undo" title="Undo">
        ↩️
      </button>
      <button id="redo" aria-label="Redo" title="Redo">
        ↪️
      </button>
      <button id="clear" aria-label="Clear" title="Clear">
        🗑
      </button>
      <div class="mx-4 opacity-25">
        /
      </div>
      <button id="m-stylus" class="active" aria-label="Stylus" title="Stylus">
        ✍️
      </button>
      <button id="m-draw" aria-label="Draw" title="Draw">
        ✏️
      </button>
      <button id="m-line" aria-label="Line" title="Line">
        ⁄
      </button>
      <button id="m-arrow" aria-label="Arrow" title="Arrow">
        ↗
      </button>
      <button id="m-rect" aria-label="Rect" title="Rect">
        ⃞
      </button>
      <button id="m-ellipse" aria-label="Ellipse" title="Ellipse">
        ◯
      </button>
      <button id="m-eraser" aria-label="Eraser" title="Eraser">
        🧹
      </button>
      <div class="mx-4 opacity-25">
        /
      </div>
      <button data-color="#000000" class="active">
        ​⚫️
      </button>
      <button data-color="#ed153d" aria-label="Red" title="Red">
        ​🔴
      </button>
      <button data-color="#ed9a26" aria-label="Orange" title="Orange">
        ​🟠
      </button>
      <button data-color="#ede215" aria-label="Yellow" title="Yellow">
        ​​🟡
      </button>
      <button data-color="#30bd20" aria-label="Green" title="Green">
        ​🟢
      </button>
      <button data-color="#2656bf" aria-label="Blue" title="Blue">
        ​​🔵
      </button>
      <button data-color="#c24aed" aria-label="Purple" title="Purple">
        ​🟣
      </button>
      <button data-color="#bf6b26" aria-label="Brown" title="Brown">
        ​​🟤
      </button>
      <div class="mx-4 opacity-25">
        /
      </div>
      <input id="size" type="range" min="1" max="10" value="4" step="0.5" name="Size" title="Size">
      <div class="mx-4 opacity-25">
        /
      </div>
      <button id="l-solid" class="active" aria-label="Solid" title="Solid">
        —
      </button>
      <button id="l-dashed" aria-label="Dashed" title="Dashed">
        ┅
      </button>
      <button id="l-dotted" aria-label="Dotted" title="Dotted">
        ⋯
      </button>
      <div class="mx-4 opacity-25">
        /
      </div>
      <button id="download" title="Download">
        📥
      </button>
    </div>
    <svg id="svg" class="z-10 h-full w-full flex-auto" style="touch-action: none">1</svg>
    <pre class="pointer-events-none fixed bottom-6 right-8 font-mono opacity-35 <sm:hidden">
           d / draw
             s / stylus
           l / line
                r / rectangle
              e / ellipse
            c / clear
                    + / increase size
                    - / decrease size
      ctrl+z / undo
shift+ctrl+z / redo</pre>
  </div>
</template>

<style>
.whiteboard button {
  --uno: '!outline-none w-8 h-8';

  &.active {
    --uno: bg-gray-100 rounded;
  }

  /* &:focus {
    --uno: bg-gray-200;
  } */
}
</style>
