import { randomBytes, randomUUID } from 'node:crypto'

/** Ids are opaque strings; UUIDs for new rows, readable slugs for seed data. */
export const newId = (): string => randomUUID()

/** URL-safe random token (refresh tokens, reset links). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url')
