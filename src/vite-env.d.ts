/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (default) runs the in-memory adapter; 'http' targets the .NET API. */
  readonly VITE_API_MODE?: 'mock' | 'http'
  /** Base URL for the .NET API. Defaults to '/api', which the dev server proxies. */
  readonly VITE_API_URL?: string
  /** Artificial latency in ms for the mock adapter. */
  readonly VITE_MOCK_LATENCY?: string
  /** Optional hero video override, e.g. a CDN URL. */
  readonly VITE_HERO_VIDEO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
