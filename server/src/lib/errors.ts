import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'
import { logger } from './logger.js'

/**
 * Errors are rendered as RFC 7807 Problem Details, which is what the front-end
 * ApiClient already parses: `detail` becomes the message shown to the user and
 * `errors` maps onto form fields.
 */
export type ProblemDetails = {
  type: string
  title: string
  status: number
  detail?: string
  code?: string
  errors?: Record<string, string[]>
}

export class HttpError extends Error {
  readonly status: number
  readonly title: string
  readonly code: string | undefined
  readonly errors: Record<string, string[]> | undefined

  constructor(
    status: number,
    detail: string,
    options: { title?: string; code?: string; errors?: Record<string, string[]> } = {},
  ) {
    super(detail)
    this.name = 'HttpError'
    this.status = status
    this.title = options.title ?? DEFAULT_TITLES[status] ?? 'Error'
    this.code = options.code
    this.errors = options.errors
  }
}

const DEFAULT_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
}

export const badRequest = (detail: string, code?: string) => new HttpError(400, detail, { code })
export const unauthorized = (detail = 'Sign in to continue.') => new HttpError(401, detail)
export const forbidden = (detail = 'You do not have access to that.', code?: string) =>
  new HttpError(403, detail, { code })
export const notFound = (detail = 'Not found.') => new HttpError(404, detail)
export const conflict = (detail: string, code?: string) => new HttpError(409, detail, { code })
export const unprocessable = (detail: string, errors?: Record<string, string[]>, code?: string) =>
  new HttpError(422, detail, { errors, code })

export function toProblem(err: unknown): ProblemDetails {
  if (err instanceof HttpError) {
    return {
      type: 'about:blank',
      title: err.title,
      status: err.status,
      detail: err.message,
      ...(err.code ? { code: err.code } : {}),
      ...(err.errors ? { errors: err.errors } : {}),
    }
  }
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {}
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_'
      ;(errors[key] ??= []).push(issue.message)
    }
    const first = err.issues[0]
    return {
      type: 'about:blank',
      title: 'Unprocessable Entity',
      status: 422,
      detail: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input.',
      code: 'validation',
      errors,
    }
  }
  // Duplicate key from MySQL surfaces as a conflict rather than a 500.
  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ER_DUP_ENTRY') {
    return { type: 'about:blank', title: 'Conflict', status: 409, detail: 'That record already exists.' }
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return { type: 'about:blank', title: 'Bad Request', status: 400, detail: 'Malformed JSON body.' }
  }
  return { type: 'about:blank', title: 'Internal Server Error', status: 500, detail: 'Something went wrong.' }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const problem = toProblem(err)
  if (problem.status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'unhandled error')
  }
  res.status(problem.status).type('application/problem+json').json(problem)
}
