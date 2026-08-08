/**
 * Chart tokens.
 *
 * The series colours are NOT the brand accent. Volt (#d0fb54) sits at OKLCH
 * L≈0.93, far outside the 0.48–0.67 band a dark-surface series colour has to
 * live in, and a lime series next to an orange one collapses under deuteranopia
 * (measured ΔE 1.3 — indistinguishable). So volt stays on UI chrome — buttons,
 * active states, KPI figures — and the data marks use a palette validated
 * against this app's own chart surface:
 *
 *   node scripts/validate_palette.js "#3987e5,#d95926,#199e70" \
 *     --mode dark --surface "#0e141c" --pairs all
 *   → lightness band PASS · chroma PASS · CVD ΔE 9.4 PASS
 *     normal-vision ΔE 20.9 PASS · contrast PASS
 *
 * Slots are assigned in fixed order and never cycled. Adding a fourth series
 * means folding the tail into "Other" or faceting — not inventing a hue.
 */

export const CHART = {
  /** Effective surface: ink-850 at 80% over ink-950, which is what Card renders. */
  surface: '#0e141c',

  series: {
    /** Slot 1 — the default single-series hue. */
    primary: '#3987e5',
    /** Slot 2 — only ever paired with slot 1. */
    secondary: '#d95926',
    /** Slot 3. */
    tertiary: '#199e70',
  },

  /** Chrome. Deliberately recessive — the data should be the only loud thing. */
  grid: '#1e2a37',
  axis: '#6d8298',
  label: '#a7b8c9',
  /** Goal/target reference lines are chrome, not a series. */
  reference: '#6d8298',
  /** Brand accent, for emphasis marks outside the data (KPI text, active dot). */
  accent: '#d0fb54',
} as const
