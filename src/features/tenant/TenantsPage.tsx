import { useMemo } from 'react'
import { format } from 'date-fns'
import { Building2, Users } from 'lucide-react'
import type { Tenant } from '@/domain/identity/model'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Stat } from '@/shared/ui/Stat'
import { useTenants } from '@/features/payments/hooks'
import { useTenant } from '@/features/auth/store'
import { cn } from '@/shared/lib/cn'

const PLAN_TONE = {
  starter: 'neutral',
  growth: 'volt',
  scale: 'info',
} as const

function SeatMeter({ tenant }: { tenant: Tenant }) {
  const usage = Math.round((tenant.seatsUsed / tenant.seats) * 100)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-chalk-faint">Seats</span>
        <span className="text-sm tabular-nums text-chalk">
          {tenant.seatsUsed.toLocaleString()}
          <span className="text-chalk-faint"> / {tenant.seats.toLocaleString()}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-valuenow={usage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${tenant.name} seat usage`}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"
      >
        <div
          className={cn(
            'h-full rounded-full',
            usage > 90 ? 'bg-danger-500' : usage > 75 ? 'bg-warn-500' : 'bg-volt-400',
          )}
          style={{ width: `${usage}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-chalk-faint">{usage}% used</p>
    </div>
  )
}

export default function TenantsPage() {
  const currentTenant = useTenant()
  const { data, isPending, isError, refetch } = useTenants()

  const totals = useMemo(() => {
    const rows = data ?? []
    return {
      studios: rows.length,
      seats: rows.reduce((sum, t) => sum + t.seats, 0),
      used: rows.reduce((sum, t) => sum + t.seatsUsed, 0),
    }
  }, [data])

  return (
    <>
      <PageHeading
        title="Studios"
        subtitle="Every tenant on the platform, their plan and how much of it they are using."
        actions={<Button size="md">Provision a studio</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Studios" value={totals.studios} icon={Building2} />
        <Stat label="Members provisioned" value={totals.used.toLocaleString()} icon={Users} />
        <Stat
          label="Platform capacity"
          value={`${Math.round((totals.used / Math.max(totals.seats, 1)) * 100)}%`}
          hint={`${totals.seats.toLocaleString()} seats sold`}
        />
      </div>

      {isPending ? (
        <SkeletonList rows={3} />
      ) : isError ? (
        <ErrorState description="Couldn't load the studio list." onRetry={() => void refetch()} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((tenant) => {
            const isCurrent = tenant.id === currentTenant?.id
            return (
              <article
                key={tenant.id}
                className={cn(
                  'rounded-xl border bg-ink-850/70 p-6',
                  isCurrent ? 'border-volt-400/50' : 'border-ink-700',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl">{tenant.name}</h2>
                    <p className="mt-0.5 truncate text-xs text-chalk-faint">/{tenant.slug}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={PLAN_TONE[tenant.plan]}>{tenant.plan}</Badge>
                    {isCurrent && <Badge tone="info">Current</Badge>}
                  </div>
                </div>

                <div className="mt-6">
                  <SeatMeter tenant={tenant} />
                </div>

                <dl className="mt-5 flex justify-between gap-4 border-t border-ink-700 pt-4 text-xs">
                  <div>
                    <dt className="text-chalk-faint">Onboarded</dt>
                    <dd className="mt-0.5 text-chalk-dim">
                      {format(new Date(tenant.createdAt), 'MMM yyyy')}
                    </dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-chalk-faint">Brand colour</dt>
                    <dd className="mt-0.5 flex items-center justify-end gap-1.5 text-chalk-dim">
                      <span
                        aria-hidden
                        className="size-3 rounded-full border border-ink-600"
                        style={{ background: tenant.primaryColor ?? 'var(--color-ink-600)' }}
                      />
                      {tenant.primaryColor ?? 'Default'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Manage
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    Impersonate
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
