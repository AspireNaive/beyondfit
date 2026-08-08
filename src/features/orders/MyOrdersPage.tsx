import { format } from 'date-fns'
import { Package, Truck } from 'lucide-react'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE, OrderStatus } from '@/domain/commerce/model'
import { formatMoney, money } from '@/domain/shared/types'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { useOrders } from './hooks'

/** Progress of a physical order, so "where is my thing" needs no support email. */
const STAGES = [
  OrderStatus.Paid,
  OrderStatus.Processing,
  OrderStatus.Shipped,
  OrderStatus.Delivered,
] as const

function FulfilmentTrack({ status }: { status: OrderStatus }) {
  const index = STAGES.indexOf(status as (typeof STAGES)[number])
  if (index === -1) return null

  return (
    <ol className="mt-5 flex items-center gap-1">
      {STAGES.map((stage, i) => (
        <li key={stage} className="flex flex-1 flex-col gap-1.5">
          <span
            className={
              i <= index ? 'h-1 rounded-full bg-volt-400' : 'h-1 rounded-full bg-ink-700'
            }
          />
          <span
            className={
              i <= index
                ? 'text-[10px] font-semibold uppercase tracking-wider text-volt-400'
                : 'text-[10px] uppercase tracking-wider text-chalk-faint'
            }
          >
            {ORDER_STATUS_LABELS[stage]}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function MyOrdersPage() {
  const user = useCurrentUser()
  const { data, isPending, isError, refetch } = useOrders(user)

  return (
    <>
      <PageHeading
        title="My orders"
        subtitle="Programmes unlock immediately; physical items show their fulfilment status here."
        actions={
          <ButtonLink to="/shop" size="md" variant="outline">
            Browse the shop
          </ButtonLink>
        }
      />

      {isPending ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState description="Couldn't load your orders." onRetry={() => void refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Everything you buy — programmes, testing, supplements — lands here."
          action={<ButtonLink to="/shop">Browse the shop</ButtonLink>}
        />
      ) : (
        <div className="space-y-5">
          {(data ?? []).map((order) => (
            <article key={order.id} className="rounded-xl border border-ink-700 bg-ink-850/70 p-6">
              <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                    {order.reference} · {format(new Date(order.placedAt), 'd MMMM yyyy')}
                  </p>
                  <p className="mt-1 font-display text-2xl leading-none text-chalk">
                    {formatMoney(order.total)}
                  </p>
                </div>
                <Badge tone={ORDER_STATUS_TONE[order.status]} dot>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </header>

              <ul className="mt-5 divide-y divide-ink-700">
                {order.lines.map((line) => (
                  <li key={line.productId} className="flex justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-chalk">{line.name}</p>
                      <p className="text-xs text-chalk-faint">
                        {line.quantity} × {formatMoney(line.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-chalk-dim">
                      {formatMoney(money(line.unitPrice.amountMinor * line.quantity))}
                    </span>
                  </li>
                ))}
              </ul>

              <FulfilmentTrack status={order.status} />

              {order.trackingNumber && (
                <p className="mt-4 flex items-center gap-2 text-xs text-chalk-dim">
                  <Truck className="size-3.5 text-volt-400" />
                  Tracking <span className="font-semibold text-chalk">{order.trackingNumber}</span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  )
}
