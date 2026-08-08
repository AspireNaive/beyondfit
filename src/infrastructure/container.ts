import type { Container } from '@/domain/ports'
import { mockContainer } from './mock/repositories'
import { createHttpContainer } from './http/container'

/**
 * Composition root.
 *
 * `VITE_API_MODE=http` points the whole app at the .NET API; anything else
 * (the default today) runs against the in-memory adapter so the UI can be
 * built and demoed before the backend exists.
 */
const mode = import.meta.env.VITE_API_MODE ?? 'mock'

export const container: Container = mode === 'http' ? createHttpContainer() : mockContainer

export const isMockMode = mode !== 'http'
