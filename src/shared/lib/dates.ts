import { format } from 'date-fns'
import type { IsoDate } from '@/domain/shared/types'

/** Calendar date in `YYYY-MM-DD`, in the *local* timezone.
 *
 *  Deliberately not `toISOString().slice(0, 10)` — that converts to UTC first,
 *  so anyone east of Greenwich after 00:00, or west of it before 00:00, gets
 *  the wrong day. Booking the wrong date is exactly the bug that causes. */
export const toIsoDate = (date: Date): IsoDate => format(date, 'yyyy-MM-dd')

/** Today, in the viewer's timezone. */
export const today = (): IsoDate => toIsoDate(new Date())
