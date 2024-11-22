declare global {
  interface PageQuery {
    pageNum: number
    pageSize: number
  }

  interface PageResult<T> {
    list: T
    total: number
  }

}

declare module 'vue' {
  export interface GlobalComponents {
    Icon: typeof import('@iconify/vue')['Icon']
  }
}
export {}
