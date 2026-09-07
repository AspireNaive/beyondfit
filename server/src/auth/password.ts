import bcrypt from 'bcryptjs'

/** bcrypt (pure JS) — no native build step, which matters on shared hosting. */
const COST = 12

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST)
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash)

export const PASSWORD_MIN_LENGTH = 8
