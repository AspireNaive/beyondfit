/** MySQL returns JSON columns parsed; MariaDB returns them as text. Accept both. */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

export const toIsoDateTime = (value: Date | string | null | undefined): string | undefined =>
  value == null ? undefined : value instanceof Date ? value.toISOString() : new Date(value).toISOString()
