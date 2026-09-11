import { useEffect, useState } from 'react'
import { Camera, Save } from 'lucide-react'
import {
  PHOTO_ANALYSIS_MODEL_LABELS,
  PhotoAnalysisModel,
  type Tenant,
} from '@/domain/identity/model'
import { useUpdateTenant } from '@/features/payments/hooks'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle } from '@/shared/ui/Card'
import { Input, Select } from '@/shared/ui/Field'

const DEFAULT = ''

/**
 * A studio's food-photo analysis settings: which model reads the plates, and
 * how many photos a member may analyse per day. Both fall back to the
 * platform defaults when left blank; a cap of 0 switches the feature off.
 */
export function NutritionSettingsCard({ tenant }: { tenant: Tenant }) {
  const update = useUpdateTenant()
  const [model, setModel] = useState<string>(tenant.nutrition?.model ?? DEFAULT)
  const [limit, setLimit] = useState<string>(tenant.nutrition?.dailyPhotoLimit == null ? DEFAULT : String(tenant.nutrition.dailyPhotoLimit))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setModel(tenant.nutrition?.model ?? DEFAULT)
    setLimit(tenant.nutrition?.dailyPhotoLimit == null ? DEFAULT : String(tenant.nutrition.dailyPhotoLimit))
  }, [tenant.id, tenant.nutrition?.model, tenant.nutrition?.dailyPhotoLimit])

  const dirty =
    model !== (tenant.nutrition?.model ?? DEFAULT) ||
    limit !== (tenant.nutrition?.dailyPhotoLimit == null ? DEFAULT : String(tenant.nutrition.dailyPhotoLimit))

  const save = () => {
    const n = limit.trim() === '' ? null : Number(limit)
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1000)) return setError('The daily cap must be a whole number from 0 to 1000.')
    setError(null)
    update.mutate(
      { id: tenant.id, patch: { nutrition: { model: (model || null) as PhotoAnalysisModel | null, dailyPhotoLimit: n } } },
      { onError: (e) => setError(e.message) },
    )
  }

  const off = limit.trim() === '0'
  const perPhotoCents = model ? PHOTO_ANALYSIS_MODEL_LABELS[model as PhotoAnalysisModel].note.match(/About ([\d.]+)¢/)?.[1] : null

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-4 text-volt-400" /> Photo calorie analysis
            </CardTitle>
            <p className="mt-1 text-xs text-chalk-faint">
              Members photograph meals and the model estimates calories. You pay per photo, so pick the model and cap that suit your studio.
            </p>
          </div>
          {off ? <Badge tone="warn">Off</Badge> : <Badge tone="ok" dot>On</Badge>}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Select label="Model" value={model} onChange={(e) => setModel(e.target.value)} hint={model ? PHOTO_ANALYSIS_MODEL_LABELS[model as PhotoAnalysisModel].note : 'Platform default (currently the most accurate model).'}>
            <option value={DEFAULT}>Platform default</option>
            {Object.values(PhotoAnalysisModel).map((m) => (
              <option key={m} value={m}>
                {PHOTO_ANALYSIS_MODEL_LABELS[m].name}
              </option>
            ))}
          </Select>
          <Input
            label="Analysed photos per member per day"
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Default"
            hint={off ? 'Zero switches analysis off; members log manually.' : 'Counts analyses, not meals; re-analysing a photo uses one too. Blank uses the platform default (5).'}
          />
        </div>

        {perPhotoCents && limit.trim() !== '' && !off && (
          <p className="mt-3 text-xs text-chalk-dim">
            Worst case per member: {limit} × {perPhotoCents}¢ ≈{' '}
            <span className="tabular-nums text-chalk">${((Number(limit) * Number(perPhotoCents)) / 100).toFixed(2)}</span> a day,{' '}
            <span className="tabular-nums text-chalk">${((Number(limit) * Number(perPhotoCents) * 30) / 100).toFixed(0)}</span> a month.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-500">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={!dirty} loading={update.isPending}>
            <Save className="size-4" /> Save settings
          </Button>
          {update.isSuccess && !dirty && <p className="text-xs text-ok-500">Saved. Applies to the next photo.</p>}
        </div>
      </CardBody>
    </Card>
  )
}
