import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { execute } from '../../db/pool.js'
import { route } from '../../lib/handler.js'
import { newId } from '../../lib/ids.js'
import { logger } from '../../lib/logger.js'
import { sendMail } from '../../lib/mailer.js'
import { config } from '../../config.js'

/** Public forms: stored first, notified second, and never a 500 because of email. */
const formLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.isTest ? 10_000 : 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { title: 'Too Many Requests', status: 429, detail: 'Too many submissions. Try again shortly.' },
})

export const contactRouter = Router()

contactRouter.post(
  '/',
  formLimiter,
  route(
    {
      body: z.object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        email: z.string().trim().toLowerCase().email(),
        phone: z.string().trim().max(40).optional(),
        topic: z.enum(['coaching', 'testing', 'specialists', 'orders', 'platform', 'other']).default('other'),
        message: z.string().trim().min(1).max(4000),
      }),
    },
    async ({ body, res }) => {
      const id = newId()
      await execute(
        'INSERT INTO contact_messages (id, first_name, last_name, email, phone, topic, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, body.firstName, body.lastName, body.email, body.phone || null, body.topic, body.message],
      )
      if (config.smtp?.from) {
        sendMail({
          to: config.smtp.from,
          subject: `[Contact] ${body.topic}: ${body.firstName} ${body.lastName}`,
          text: `${body.firstName} ${body.lastName} <${body.email}>${body.phone ? ` ${body.phone}` : ''}\n\n${body.message}`,
        }).catch((err) => logger.warn({ err }, 'contact notification failed'))
      }
      res.status(201)
      return { id }
    },
  ),
)

export const newsletterRouter = Router()

newsletterRouter.post(
  '/',
  formLimiter,
  route(
    { body: z.object({ email: z.string().trim().toLowerCase().email(), source: z.string().trim().max(40).default('footer') }) },
    async ({ body }) => {
      await execute(
        `INSERT INTO newsletter_subscribers (email, source) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE unsubscribed_at = NULL`,
        [body.email, body.source],
      )
    },
  ),
)
