/** Filled in by docs/openapi.json at build time; see scripts in package.json. */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let doc: unknown = { openapi: '3.1.0', info: { title: 'Kedem Life API', version: '0.1.0' }, paths: {} }
try {
  doc = require('../openapi.json')
} catch {
  /* generated file absent in development until docs are written */
}
export const openApiDocument = doc
