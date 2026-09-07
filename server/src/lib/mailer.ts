import nodemailer, { type Transporter } from 'nodemailer'
import { config } from '../config.js'
import { logger } from './logger.js'

/**
 * Outbound email. With SMTP configured (GoDaddy's relay works here) messages
 * are sent; without it they are logged, which keeps development and tests
 * free of a mail server and never blocks a flow on delivery.
 */
let transporter: Transporter | null = null

function transport(): Transporter | null {
  if (!config.smtp) return null
  transporter ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    ...(config.smtp.user ? { auth: { user: config.smtp.user, pass: config.smtp.pass ?? '' } } : {}),
  })
  return transporter
}

export async function sendMail(message: { to: string; subject: string; text: string; html?: string }) {
  const t = transport()
  if (!t) {
    logger.info({ to: message.to, subject: message.subject, text: message.text }, 'mail (not sent: SMTP not configured)')
    return
  }
  await t.sendMail({ from: config.smtp!.from, ...message })
}

export function sendPasswordResetEmail(to: string, link: string) {
  return sendMail({
    to,
    subject: 'Reset your Kedem Life password',
    text: `Someone asked to reset the password for this account.\n\nSet a new password here (the link expires in 30 minutes):\n${link}\n\nIf that was not you, ignore this email.`,
    html: `<p>Someone asked to reset the password for this account.</p><p><a href="${link}">Set a new password</a> — the link expires in 30 minutes.</p><p>If that was not you, ignore this email.</p>`,
  })
}
