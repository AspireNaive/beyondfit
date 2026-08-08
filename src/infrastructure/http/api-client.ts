import { AuthError } from '@/domain/identity/model'

/**
 * Thin fetch wrapper for the .NET API.
 *
 * Deliberately not a library: everything the app needs is a base URL, a bearer
 * token, JSON in/out, ProblemDetails error mapping and a timeout. TanStack
 * Query already owns caching, retries and dedupe above this layer.
 */

export type ApiClientOptions = {
  baseUrl: string
  /** Read lazily so the client picks up a token refreshed after construction. */
  getToken?: () => string | null
  onUnauthorized?: () => void
  timeoutMs?: number
}

/** RFC 7807 ProblemDetails, which is what ASP.NET Core returns by default. */
type ProblemDetails = {
  title?: string
  detail?: string
  status?: number
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetails

  constructor(message: string, status: number, problem?: ProblemDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  /** Flattened ModelState errors, ready to drop onto form fields. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [field, messages] of Object.entries(this.problem?.errors ?? {})) {
      const key = field.charAt(0).toLowerCase() + field.slice(1)
      if (messages[0]) out[key] = messages[0]
    }
    return out
  }
}

export class ApiClient {
  private readonly options: ApiClientOptions

  constructor(options: ApiClientOptions) {
    this.options = options
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000)

    const headers = new Headers(init?.headers)
    headers.set('Accept', 'application/json')
    if (body !== undefined) headers.set('Content-Type', 'application/json')

    const token = this.options.getToken?.()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    let response: Response
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        ...init,
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'include',
      })
    } catch {
      throw new ApiError(
        controller.signal.aborted
          ? 'The server took too long to respond.'
          : 'Could not reach the server. Check your connection.',
        0,
        undefined,
      )
    } finally {
      clearTimeout(timeout)
    }

    if (response.status === 401) {
      this.options.onUnauthorized?.()
      throw new AuthError('Your session has expired. Sign in again.', 'invalid_credentials')
    }

    if (response.status === 204) return undefined as T

    const text = await response.text()
    const payload = text ? (JSON.parse(text) as unknown) : undefined

    if (!response.ok) {
      const problem = payload as ProblemDetails | undefined
      throw new ApiError(
        problem?.detail ?? problem?.title ?? `Request failed (${response.status})`,
        response.status,
        problem,
      )
    }

    return payload as T
  }

  get<T>(path: string, init?: RequestInit) {
    return this.request<T>('GET', path, undefined, init)
  }
  post<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>('POST', path, body, init)
  }
  put<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>('PUT', path, body, init)
  }
  patch<T>(path: string, body?: unknown, init?: RequestInit) {
    return this.request<T>('PATCH', path, body, init)
  }
  delete<T>(path: string, init?: RequestInit) {
    return this.request<T>('DELETE', path, undefined, init)
  }
}

/** Query-string builder that drops undefined/empty values. */
export const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}
