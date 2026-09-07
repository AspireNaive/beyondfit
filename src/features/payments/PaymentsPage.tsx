import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CreditCard, Download, Search, TrendingUp, Wallet } from 'lucide-react'
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_TONE,
  PaymentStatus,
  type Payment,
  type Subscription,
} from '@/domain/commerce/model'
import { formatMoney, money } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { DataTable, type Column } from '@/shared/ui/DataTable'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Stat } from '@/shared/ui/Stat'
import { Tabs } from '@/shared/ui/Tabs'
import { usePayments, useSubscriptions } from './hooks'

type View = 'payments' | 'subscriptions'

const SUBSCRIPTION_TONE = {
  active: 'ok',
  trialing: 'info',
  past_due: 'warn',
  cancelled: 'neutral',
} as const

export default function PaymentsPage() {
  const [view, setView] = useState<View>('payments')
  const [query, setQuery] = useState('')

  const payments = usePayments()
  const subscriptions = useSubscriptions()

  const totals = useMemo(() => {
    const rows = payments.data ?? []
    const succeeded = rows.filter((p) => p.status === PaymentStatus.Succeeded)
    return {
      gross: succeeded.reduce((sum, p) => sum + p.gross.amountMinor, 0),
      fees: succeeded.reduce((sum, p) => sum + p.fee.amountMinor, 0),
      net: succeeded.reduce((sum, p) => sum + p.net.amountMinor, 0),
      refunded: rows
        .filter((p) => p.status === PaymentStatus.Refunded)
        .reduce((sum, p) => sum + p.gross.amountMinor, 0),
    }
  }, [payments.data])

  const mrr = useMemo(
    () =>
      (subscriptions.data ?? [])
        .filter((s) => s.status === 'active')
        .reduce(
          (sum, s) =>
            sum +
            (s.interval === 'year' ? Math.round(s.price.amountMinor / 12) : s.price.amountMinor),
          0,
        ),
    [subscriptions.data],
  )

  const paymentRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = payments.data ?? []
    if (!q) return rows
    return rows.filter(
      (p) =>
        p.customerName.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    )
  }, [payments.data, query])

  const subscriptionRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = subscriptions.data ?? []
    if (!q) return rows
    return rows.filter(
      (s) => s.memberName.toLowerCase().includes(q) || s.planName.toLowerCase().includes(q),
    )
  }, [subscriptions.data, query])

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'customer',
      header: 'Customer',
      primary: true,
      cell: (payment) => (
        <div className="flex items-center gap-3">
          <Avatar name={payment.customerName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-chalk">{payment.customerName}</p>
            <p className="truncate text-xs text-chalk-faint">{payment.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      hideBelow: 'lg',
      cell: (payment) => (
        <span className="text-xs">
          {PAYMENT_METHOD_LABELS[payment.method]}
          {payment.cardLast4 && (
            <span className="text-chalk-faint">
              {' '}
              {payment.cardBrand} ···{payment.cardLast4}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Processed',
      hideBelow: 'lg',
      cell: (payment) => format(new Date(payment.processedAt), 'd MMM yyyy'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (payment) => (
        <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>{payment.status}</Badge>
      ),
    },
    {
      key: 'fee',
      header: 'Fee',
      align: 'right',
      hideBelow: 'md',
      cell: (payment) => <span className="text-chalk-faint">−{formatMoney(payment.fee)}</span>,
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      cell: (payment) => <span className="font-semibold text-chalk">{formatMoney(payment.net)}</span>,
    },
  ]

  const subscriptionColumns: Column<Subscription>[] = [
    {
      key: 'member',
      header: 'Member',
      primary: true,
      cell: (sub) => (
        <div className="flex items-center gap-3">
          <Avatar name={sub.memberName} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-chalk">{sub.memberName}</p>
            <p className="truncate text-xs text-chalk-faint">{sub.planName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'interval',
      header: 'Billing',
      hideBelow: 'md',
      cell: (sub) => (
        <span className="capitalize">
          {formatMoney(sub.price)} / {sub.interval}
        </span>
      ),
    },
    {
      key: 'started',
      header: 'Started',
      hideBelow: 'lg',
      cell: (sub) => format(new Date(sub.startedAt), 'd MMM yyyy'),
    },
    {
      key: 'renews',
      header: 'Renews',
      hideBelow: 'md',
      cell: (sub) => format(new Date(sub.renewsAt), 'd MMM yyyy'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (sub) => (
        <Badge tone={SUBSCRIPTION_TONE[sub.status]}>{sub.status.replace('_', ' ')}</Badge>
      ),
    },
  ]

  const loading = view === 'payments' ? payments.isPending : subscriptions.isPending
  const errored = view === 'payments' ? payments.isError : subscriptions.isError

  /** Client-side CSV so finance can reconcile without waiting on an export job. */
  const exportCsv = () => {
    const rows =
      view === 'payments'
        ? [
            ['Reference', 'Customer', 'Description', 'Gross', 'Fee', 'Net', 'Status', 'Processed'],
            ...paymentRows.map((p) => [
              p.reference,
              p.customerName,
              p.description,
              (p.gross.amountMinor / 100).toFixed(2),
              (p.fee.amountMinor / 100).toFixed(2),
              (p.net.amountMinor / 100).toFixed(2),
              p.status,
              p.processedAt,
            ]),
          ]
        : [
            ['Member', 'Plan', 'Price', 'Interval', 'Status', 'Started', 'Renews'],
            ...subscriptionRows.map((s) => [
              s.memberName,
              s.planName,
              (s.price.amountMinor / 100).toFixed(2),
              s.interval,
              s.status,
              s.startedAt,
              s.renewsAt,
            ]),
          ]

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `kedem-life-${view}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeading
        title="Payments"
        subtitle="Every charge and subscription for the studio, with fees and net payout."
        actions={
          <Button variant="outline" size="md" onClick={exportCsv}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Gross collected"
          value={formatMoney(money(totals.gross), { compact: true })}
          icon={CreditCard}
        />
        <Stat
          label="Net payout"
          value={formatMoney(money(totals.net), { compact: true })}
          hint={`${formatMoney(money(totals.fees), { compact: true })} in fees`}
          icon={Wallet}
        />
        <Stat
          label="Monthly recurring"
          value={formatMoney(money(mrr), { compact: true })}
          icon={TrendingUp}
        />
        <Stat
          label="Refunded"
          value={formatMoney(money(totals.refunded), { compact: true })}
          icon={CreditCard}
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={view}
          onChange={setView}
          items={[
            { id: 'payments', label: 'Payments', count: (payments.data ?? []).length },
            { id: 'subscriptions', label: 'Subscriptions', count: (subscriptions.data ?? []).length },
          ]}
        />

        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search payments"
            className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400 sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={8} />
      ) : errored ? (
        <ErrorState
          description="Couldn't load billing data."
          onRetry={() => {
            void payments.refetch()
            void subscriptions.refetch()
          }}
        />
      ) : view === 'payments' ? (
        <DataTable
          columns={paymentColumns}
          rows={paymentRows}
          rowKey={(p) => p.id}
          caption="Payments"
          empty={<EmptyState icon={CreditCard} title="No payments yet" />}
        />
      ) : (
        <DataTable
          columns={subscriptionColumns}
          rows={subscriptionRows}
          rowKey={(s) => s.memberId}
          caption="Subscriptions"
          empty={<EmptyState icon={TrendingUp} title="No subscriptions yet" />}
        />
      )}
    </>
  )
}
