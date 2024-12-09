import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver, VantResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  base: '/tool/',
  build: { target: 'esnext' },
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  plugins: [
    Vue(),
    VueRouter(),
    AutoImport({
      imports: [
        'vue',
        '@vueuse/core',
        VueRouterAutoImports,
        {
          'vue-router/auto': ['useLink'],
        },
      ],
      resolvers: [ElementPlusResolver(), VantResolver()],
      dts: 'types/auto-imports.d.ts',
      dirs: ['./src/composables'],
      vueTemplate: true,
    }),
    Components({
      resolvers: [ElementPlusResolver(), VantResolver()],
      dts: 'types/components.d.ts',
    }),
    UnoCSS(),
    wasm(),
  ],
})
