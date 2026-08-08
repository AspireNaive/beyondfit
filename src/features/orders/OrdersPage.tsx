import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Package, Search } from 'lucide-react'
import { Role } from '@/domain/identity/model'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  OrderStatus,
  type Order,
} from '@/domain/commerce/model'
import { formatMoney, money, type OrderId } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { DataTable, type Column } from '@/shared/ui/DataTable'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Modal } from '@/shared/ui/Modal'
import { Stat } from '@/shared/ui/Stat'
import { Tabs } from '@/shared/ui/Tabs'
import { useCurrentUser } from '@/features/auth/store'
import { useOrders, useUpdateOrderStatus } from './hooks'

type Filter = 'open' | 'fulfilled' | 'all'

/** The status a coach/admin can move an order to from its current state. */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.Paid]: OrderStatus.Processing,
  [OrderStatus.Processing]: OrderStatus.Shipped,
  [OrderStatus.Shipped]: OrderStatus.Delivered,
}

export default function OrdersPage() {
  const user = useCurrentUser()
  const [filter, setFilter] = useState<Filter>('open')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)

  const { data, isPending, isError, refetch } = useOrders(user)
  const updateStatus = useUpdateOrderStatus(user?.id)

  const groups = useMemo(() => {
    const all = data ?? []
    return {
      open: all.filter(
        (o) =>
          o.status === OrderStatus.AwaitingPayment ||
          o.status === OrderStatus.Paid ||
          o.status === OrderStatus.Processing ||
          o.status === OrderStatus.Shipped,
      ),
      fulfilled: all.filter(
        (o) =>
          o.status === OrderStatus.Delivered ||
          o.status === OrderStatus.Refunded ||
          o.status === OrderStatus.Cancelled,
      ),
      all,
    }
  }, [data])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = groups[filter]
    if (!q) return base
    return base.filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.lines.some((l) => l.name.toLowerCase().includes(q)),
    )
  }, [groups, filter, query])

  const revenue = useMemo(
    () =>
      (data ?? [])
        .filter((o) => o.status !== OrderStatus.Cancelled && o.status !== OrderStatus.Refunded)
        .reduce((sum, o) => sum + o.total.amountMinor, 0),
    [data],
  )

  const columns: Column<Order>[] = [
    {
      key: 'customer',
      header: 'Customer',
      primary: true,
      cell: (order) => (
        <div className="flex items-center gap-3">
          <Avatar name={order.customerName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-chalk">{order.customerName}</p>
            <p className="truncate text-xs text-chalk-faint">{order.reference}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      hideBelow: 'lg',
      cell: (order) => (
        <span className="line-clamp-1">
          {order.lines[0]?.name}
          {order.lines.length > 1 && (
            <span className="text-chalk-faint"> +{order.lines.length - 1}</span>
          )}
        </span>
      ),
    },
    {
      key: 'placed',
      header: 'Placed',
      hideBelow: 'lg',
      cell: (order) => format(new Date(order.placedAt), 'd MMM yyyy'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (order) => (
        <Badge tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (order) => <span className="font-semibold text-chalk">{formatMoney(order.total)}</span>,
    },
  ]

  const next = selected ? NEXT_STATUS[selected.status] : undefined

  return (
    <>
      <PageHeading
        title="Orders"
        subtitle={
          user?.role === Role.Coach
            ? 'Orders containing programmes you authored.'
            : 'Every order placed through the studio storefront.'
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Open orders" value={groups.open.length} icon={Package} />
        <Stat label="Fulfilled" value={groups.fulfilled.length} />
        <Stat label="Order revenue" value={formatMoney(money(revenue), { compact: true })} />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'open', label: 'Open', count: groups.open.length },
            { id: 'fulfilled', label: 'Fulfilled', count: groups.fulfilled.length },
            { id: 'all', label: 'All', count: groups.all.length },
          ]}
        />

        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reference, customer or product"
            aria-label="Search orders"
            className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400 sm:w-72"
          />
        </div>
      </div>

      {isPending ? (
        <SkeletonList rows={6} />
      ) : isError ? (
        <ErrorState description="Couldn't load orders." onRetry={() => void refetch()} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(order) => order.id}
          onRowClick={setSelected}
          caption="Orders"
          empty={
            <EmptyState
              icon={Package}
              title="No orders here"
              description="Orders appear as soon as a member checks out."
            />
          }
        />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Order ${selected.reference}` : ''}
        description={selected ? `Placed by ${selected.customerName}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && next && (
              <Button
                loading={updateStatus.isPending}
                onClick={() =>
                  updateStatus.mutate(
                    { id: selected.id as OrderId, status: next },
                    { onSuccess: (updated) => setSelected(updated) },
                  )
                }
              >
                Mark as {ORDER_STATUS_LABELS[next].toLowerCase()}
              </Button>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={ORDER_STATUS_TONE[selected.status]}>
                {ORDER_STATUS_LABELS[selected.status]}
              </Badge>
              <span className="text-xs text-chalk-faint">
                {format(new Date(selected.placedAt), "d MMMM yyyy 'at' h:mm a")}
              </span>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                Items
              </h3>
              <ul className="mt-3 divide-y divide-ink-700">
                {selected.lines.map((line) => (
                  <li key={line.productId} className="flex justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-chalk">{line.name}</p>
                      <p className="text-xs text-chalk-faint">
                        {line.quantity} × {formatMoney(line.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-chalk">
                      {formatMoney(money(line.unitPrice.amountMinor * line.quantity))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <dl className="space-y-2 border-t border-ink-700 pt-4 text-sm">
              {[
                ['Subtotal', selected.subtotal],
                ['Shipping', selected.shipping],
                ['Tax', selected.tax],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                  <dt className="text-chalk-dim">{String(label)}</dt>
                  <dd className="tabular-nums text-chalk">
                    {formatMoney(value as ReturnType<typeof money>)}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 border-t border-ink-700 pt-3">
                <dt className="font-semibold text-chalk">Total</dt>
                <dd className="font-display text-2xl leading-none text-chalk">
                  {formatMoney(selected.total)}
                </dd>
              </div>
            </dl>

            <dl className="space-y-2 border-t border-ink-700 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-chalk-dim">Email</dt>
                <dd className="truncate text-chalk">{selected.customerEmail}</dd>
              </div>
              {selected.trackingNumber && (
                <div className="flex justify-between gap-4">
                  <dt className="text-chalk-dim">Tracking</dt>
                  <dd className="text-chalk">{selected.trackingNumber}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </Modal>
    </>
  )
}
