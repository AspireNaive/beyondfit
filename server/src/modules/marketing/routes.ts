import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { col, db, Timestamp } from '../../db/firestore.js'
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
      await db.collection(col.contactMessages).doc(id).create({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone || null,
        topic: body.topic,
        message: body.message,
        createdAt: Timestamp.now(),
        handledAt: null,
      })
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
      const ref = db.collection(col.newsletterSubscribers).doc(body.email)
      const existing = await ref.get()
      await ref.set(
        existing.exists
          ? { unsubscribedAt: null }
          : { email: body.email, source: body.source, createdAt: Timestamp.now(), unsubscribedAt: null },
        { merge: true },
      )
    },
  ),
)
