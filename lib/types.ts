// ─── Opaque ID types ───────────────────────────────────────────────────────
// StanceId and ValueId are plain strings. The actual values are defined in
// content files (content/fake/ or content/real/). No framework-specific names
// live in code.

export type StanceId = string
export type ValueId = string

// ─── Content types (loaded from YAML) ────────────────────────────────────────

export interface StanceContent {
  id: StanceId
  name: string
  short: string        // one-line plain-language summary
  description: string  // paragraph
  example: string      // real-world illustration
  order?: number       // explicit sort order; stances are sorted by this when present
  color?: string       // hex color, e.g. '#e74c3c'
  emoji?: string       // single emoji character
}

export interface ValueContent {
  id: ValueId
  name: string
  description: string
}

// ─── Position data model ─────────────────────────────────────────────────────
// Mirrors docs/position-data-model.md exactly. Partial positions are valid.

// Layer 2: a value can have an explicit stance or be left unexplored.
// 'unexplored' = participant hasn't looked at this value yet.
// 'drift' (a real StanceId) = participant looked and confirmed no deliberate approach.
export type ValueStance = StanceId | 'unexplored'

// Parallel: value importance (independent of layers)
export interface ValueImportance {
  score: number | null // 1–100; null when dontCare is true
  dontCare: boolean
}

// Layer 3: multiple stances with weights and stories within a single value
export interface StanceEntry {
  stance: StanceId
  weight: number // 1–100, relative within this value
  story?: string
}

export interface StanceRelationship {
  from: StanceId
  to: StanceId
}

export interface ValueDetail {
  stances: StanceEntry[]
  relationships: StanceRelationship[]
}

// A position is a dated snapshot. All layers are optional; a position with
// only an overallStance is a complete, valid result.
export interface Position {
  takenAt: Date
  overallStance?: StanceId
  stancesPerValue?: Record<ValueId, ValueStance>
  valueImportances?: Record<ValueId, ValueImportance>
  valueDetails?: Record<ValueId, ValueDetail>
}
