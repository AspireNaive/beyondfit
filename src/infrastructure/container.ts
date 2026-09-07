import type { Container } from '@/domain/ports'
import { mockContainer } from './mock/repositories'
import { createHttpContainer } from './http/container'

/**
 * Composition root.
 *
 * `VITE_API_MODE=http` (the default) points the whole app at the Node API in
 * ./server; `mock` runs against the in-memory adapter so UI work needs no
 * database.
 */
const mode = import.meta.env.VITE_API_MODE ?? 'http'

export const container: Container = mode === 'http' ? createHttpContainer() : mockContainer

export const isMockMode = mode !== 'http'
