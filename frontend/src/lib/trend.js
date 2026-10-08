/* A straight line through points, and how far to trust its slope: least squares, with the slope's
 * standard error. Shared by the rate of gain (lib/gain-rate.js) and the quests' forecasts
 * (lib/quests.js). Pure. */

/**
 * The least-squares line through `pts` ([{ x, y }]): { n, slope, se, mx, my, at(x) }, `at` the
 * line's y at x and `se` the slope's standard error (0 with exactly two points). Null with fewer
 * than two points, or with every x the same.
 */
export function fitLine(pts) {
  const n = Array.isArray(pts) ? pts.length : 0
  if (n < 2) return null
  const mx = pts.reduce((s, p) => s + p.x, 0) / n
  const my = pts.reduce((s, p) => s + p.y, 0) / n
  let sxx = 0, sxy = 0
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my) }
  if (!(sxx > 0)) return null
  const slope = sxy / sxx
  let sse = 0
  for (const p of pts) sse += (p.y - my - slope * (p.x - mx)) ** 2
  const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : 0
  return { n, slope, se, mx, my, at: x => my + slope * (x - mx) }
}

/** Day number of an ISO date, for a line over days. */
export const dayIndex = iso => { const [y, m, d] = String(iso).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5) }
