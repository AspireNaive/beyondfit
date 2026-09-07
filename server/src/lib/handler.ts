import type { Request, RequestHandler, Response } from 'express'
import type { ZodTypeAny, z } from 'zod'
import type { AuthUser } from '../auth/middleware.js'

/**
 * Typed route handler: validates body/query/params with zod, then calls `fn`
 * with the parsed values. Whatever `fn` returns is sent as JSON; `undefined`
 * becomes 204. Express 5 forwards rejected promises to the error handler, so
 * no try/catch boilerplate is needed here.
 */
type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }

type Parsed<S extends Schemas> = {
  body: S['body'] extends ZodTypeAny ? z.infer<S['body']> : undefined
  query: S['query'] extends ZodTypeAny ? z.infer<S['query']> : undefined
  params: S['params'] extends ZodTypeAny ? z.infer<S['params']> : undefined
  user: AuthUser | undefined
  req: Request
  res: Response
}

export function route<S extends Schemas>(
  schemas: S,
  fn: (ctx: Parsed<S>) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req, res) => {
    const ctx = {
      body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
      query: schemas.query ? schemas.query.parse(req.query ?? {}) : undefined,
      params: schemas.params ? schemas.params.parse(req.params ?? {}) : undefined,
      user: req.user,
      req,
      res,
    } as Parsed<S>
    const result = await fn(ctx)
    if (res.headersSent) return
    if (result === undefined) {
      res.status(204).end()
      return
    }
    res.json(result)
  }
}
