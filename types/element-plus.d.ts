/// <reference types="element-plus/global.d.ts" />

export {}
declare global {
  const ElLoading: typeof import('element-plus')['ElLoading']
  type FormInstance = import('element-plus').FormInstance
  type TableInstance = import('element-plus').TableInstance
  type TreeInstance = import('element-plus').TreeInstance
  type InputInstance = import('element-plus').InputInstance
  type ScrollbarInstance = import('element-plus').ScrollbarInstance
  type DateModelType = import('element-plus').DateModelType
}
