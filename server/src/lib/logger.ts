import pino from 'pino'
import { config } from '../config.js'

export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  ...(config.isProduction || config.isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
})
