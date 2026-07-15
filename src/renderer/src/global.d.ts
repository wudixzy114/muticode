import type { MutiApi } from '../../shared/types'

declare global {
  interface Window {
    muti: MutiApi
  }
}

export {}
