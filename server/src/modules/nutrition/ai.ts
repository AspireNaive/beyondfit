import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { config } from '../../config.js'
import type { FoodAnalysis } from '../../domain.js'
import { HttpError, badRequest } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'

/**
 * Food-photo analysis with Claude. One vision request, structured output, and
 * the member always gets to correct the numbers before anything is saved —
 * estimates from a photo are estimates, and the UI says so.
 */

/**
 * The shape Claude must answer in (sent as `output_config.format`) and the
 * zod schema that checks what came back. Kept as plain JSON schema rather than
 * the SDK's zod helper, which is typed against a newer zod than this server uses.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dishName', 'items', 'confidence', 'notes'],
  properties: {
    dishName: { type: 'string', description: 'What the meal is, in a few words, e.g. "Chicken salad with rice"' },
    items: {
      type: 'array',
      description: 'Each distinct food or drink visible, with its own estimate. Empty if no food is visible.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'portion', 'calories', 'proteinG', 'carbsG', 'fatG'],
        properties: {
          name: { type: 'string', description: 'Short food name, e.g. "Grilled chicken breast"' },
          portion: { type: 'string', description: 'Estimated portion in everyday units, e.g. "150 g", "1 cup", "2 slices"' },
          calories: { type: 'number', description: 'kcal for that portion' },
          proteinG: { type: 'number', description: 'grams of protein' },
          carbsG: { type: 'number', description: 'grams of carbohydrate' },
          fatG: { type: 'number', description: 'grams of fat' },
        },
      },
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How sure you are about the portions and totals' },
    notes: { type: ['string', 'null'], description: 'One sentence for the member: what was hard to judge, or null' },
  },
} as const

const AnalysisSchema = z.object({
  dishName: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      portion: z.string(),
      calories: z.number(),
      proteinG: z.number(),
      carbsG: z.number(),
      fatG: z.number(),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().nullable(),
})

const SYSTEM = `You are a registered dietitian helping a fitness coaching app estimate what is in a meal photo.
Identify each distinct food or drink, estimate its portion from visual cues (plate size, utensils, packaging), and give calories and macros for that portion using standard nutrition references.
Be realistic rather than optimistic: restaurant portions and cooking oils count. If the photo shows no food, return an empty items list with low confidence and say so in notes.
Round calories to the nearest 5 and grams to the nearest 1. Never invent foods that are not visible.`

const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
type MediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

/** Splits a data URL into media type and base64 body; also accepts bare base64 (assumed JPEG). */
export function decodePhoto(input: string): { mediaType: MediaType; data: string } {
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(input.trim())
  const mediaType = m?.[1] ?? 'image/jpeg'
  const data = (m?.[2] ?? input.trim()).replace(/\s/g, '')
  if (!MEDIA_TYPES.has(mediaType)) throw badRequest('Use a JPEG, PNG, WebP or GIF photo.', 'unsupported_media')
  if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) throw badRequest('That photo could not be read.', 'bad_photo')
  // ~5 MB of image after base64 — the client downsizes to ~1024px before sending.
  if (data.length > 7_000_000) throw badRequest('That photo is too large. Try a smaller one.', 'photo_too_large')
  return { mediaType: mediaType as MediaType, data }
}

let client: Anthropic | null = null
const anthropic = () => (client ??= new Anthropic({ apiKey: config.ai.apiKey }))

const round5 = (n: number) => Math.max(0, Math.round(n / 5) * 5)
const round1 = (n: number) => Math.max(0, Math.round(n))

export async function analyseFoodPhoto(photo: string, hint?: string): Promise<FoodAnalysis> {
  if (!config.ai.enabled) {
    throw new HttpError(503, 'Photo analysis is not set up on this server. Log the meal manually instead.', {
      title: 'Service Unavailable',
      code: 'ai_unavailable',
    })
  }
  const { mediaType, data } = decodePhoto(photo)

  let response: Anthropic.Message
  try {
    response = await anthropic().messages.create({
      model: config.ai.model,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            {
              type: 'text',
              text: hint?.trim()
                ? `Estimate this meal. The member says: "${hint.trim().slice(0, 300)}".`
                : 'Estimate this meal.',
            },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      logger.error({ err }, 'anthropic: invalid API key')
      throw new HttpError(503, 'Photo analysis is misconfigured on this server.', { title: 'Service Unavailable', code: 'ai_unavailable' })
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError(429, 'Photo analysis is busy right now. Try again in a moment.', { title: 'Too Many Requests', code: 'ai_busy' })
    }
    if (err instanceof Anthropic.APIError) {
      logger.error({ err, status: err.status }, 'anthropic: request failed')
      throw new HttpError(502, 'Photo analysis failed. You can still log the meal manually.', { title: 'Bad Gateway', code: 'ai_failed' })
    }
    throw err
  }

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text
  if (response.stop_reason === 'refusal' || !text) {
    throw new HttpError(422, 'The photo could not be analysed. Try a clearer picture of the food.', { code: 'ai_no_result' })
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  const checked = AnalysisSchema.safeParse(json)
  if (!checked.success) {
    logger.warn({ issues: checked.error.issues.slice(0, 3) }, 'anthropic: structured output did not match the schema')
    throw new HttpError(502, 'Photo analysis returned something unexpected. Try again or log the meal manually.', { title: 'Bad Gateway', code: 'ai_failed' })
  }
  const parsed = checked.data
  const items = parsed.items.map((i) => ({
    name: i.name.trim().slice(0, 80),
    portion: i.portion.trim().slice(0, 40),
    calories: round5(i.calories),
    proteinG: round1(i.proteinG),
    carbsG: round1(i.carbsG),
    fatG: round1(i.fatG),
  }))
  return {
    dishName: parsed.dishName.trim().slice(0, 120),
    items,
    totals: items.reduce(
      (t, i) => ({ calories: t.calories + i.calories, proteinG: t.proteinG + i.proteinG, carbsG: t.carbsG + i.carbsG, fatG: t.fatG + i.fatG }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    ),
    confidence: parsed.confidence,
    notes: parsed.notes?.trim() || null,
    model: response.model,
  }
}
