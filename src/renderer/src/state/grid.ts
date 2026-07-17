import type { Agent } from '../../../shared/types'

/**
 * Adaptive grid math. Agents fill up to MAX_COLUMNS side-by-side columns
 * *horizontally first*; only once the agent count exceeds the comfortable
 * column count do agents stack two-per-column (top/bottom), filling
 * left-to-right. The column count is derived from the screen resolution (not
 * the live window size) so a non-fullscreen window still lays out the full set
 * of columns — the common case is running fullscreen.
 */

/** Target width (CSS px) for one comfortable column. ~4 columns at 1920 wide. */
export const IDEAL_COL_WIDTH = 480
/** Never more than this many side-by-side columns, regardless of screen size. */
export const MAX_COLUMNS = 4
/** Vertical stacking depth per column. */
export const MAX_ROWS = 2

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Comfortable column count for a screen of the given (larger) dimension. */
export function fitColumns(screenWidth: number): number {
  if (!Number.isFinite(screenWidth) || screenWidth <= 0) return 1
  return clamp(Math.floor(screenWidth / IDEAL_COL_WIDTH), 1, MAX_COLUMNS)
}

/** Max agents that fit comfortably at this screen size (columns × rows). */
export function capacity(screenWidth: number): number {
  return fitColumns(screenWidth) * MAX_ROWS
}

/**
 * Columns to actually render: fill horizontally first (one agent per column)
 * up to the screen's comfortable maximum, then start stacking. So 3 agents on a
 * 4-wide screen render as 3 single columns — never a split — and the 5th agent
 * is what first introduces a vertical split.
 */
export function columnCount(screenWidth: number, agentCount: number): number {
  return clamp(Math.min(agentCount, fitColumns(screenWidth)), 1, MAX_COLUMNS)
}

export interface GridColumn {
  top: Agent
  bottom?: Agent
}

/**
 * Place agents into `cols` columns, stacking left-to-right: column i holds
 * agents[i] (top) and agents[i + cols] (bottom). Empty columns are omitted.
 *
 * e.g. 5 agents, 4 cols → col0=[a0,a4], col1=[a1], col2=[a2], col3=[a3].
 */
export function toGrid(agents: Agent[], cols: number): GridColumn[] {
  const columns: GridColumn[] = []
  for (let i = 0; i < cols && i < agents.length; i++) {
    columns.push({ top: agents[i], bottom: agents[i + cols] })
  }
  return columns
}
