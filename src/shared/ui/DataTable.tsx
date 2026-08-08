import { cn } from '@/shared/lib/cn'

export type Column<T> = {
  key: string
  header: string
  /** Cell renderer. Kept as a render prop so cells can hold links/badges. */
  cell: (row: T) => React.ReactNode
  /** Hide on small screens when the column is secondary. */
  hideBelow?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'right'
  /** Column shown as the card title in the mobile layout. */
  primary?: boolean
}

const hideClass = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const

/**
 * One data set, two layouts: a real <table> from `md` up, and a stack of
 * definition-list cards below it. Horizontal scrolling tables are miserable on
 * a phone, and coaches check orders on a phone constantly.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  caption,
  className,
}: {
  columns: readonly Column<T>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: React.ReactNode
  caption?: string
  className?: string
}) {
  if (rows.length === 0 && empty) return <>{empty}</>

  const primary = columns.find((c) => c.primary) ?? columns[0]
  const secondary = columns.filter((c) => c !== primary)

  return (
    <div className={className}>
      {/* Desktop / tablet */}
      <div className="hidden overflow-hidden rounded-xl border border-ink-700 md:block">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="bg-ink-900/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-chalk-faint',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.hideBelow && hideClass[col.hideBelow],
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-t border-ink-700/70 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-ink-800/60',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 align-middle text-chalk-dim',
                      col.align === 'right' && 'text-right tabular-nums',
                      col.hideBelow && hideClass[col.hideBelow],
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'rounded-xl border border-ink-700 bg-ink-850/80 p-4',
                onRowClick && 'cursor-pointer active:bg-ink-800',
              )}
            >
              <div className="mb-3 text-chalk">{primary?.cell(row)}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {secondary.map((col) => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-chalk-faint">
                      {col.header}
                    </dt>
                    <dd className="mt-0.5 truncate text-sm text-chalk-dim">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
