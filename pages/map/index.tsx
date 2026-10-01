import React, { useReducer, useState } from 'react'
import type { GetStaticProps } from 'next'
import { Container } from '@radix-ui/themes'
import { loadStances, loadValues, loadConceptContent } from '@/lib/content'
import { useStepHistory } from '@/lib/useStepHistory'
import type { StanceContent, ValueContent, Position, ValueStance } from '@/lib/types'

// ─── Content type ─────────────────────────────────────────────────────────────

interface MapContent {
  hottake: { heading: string; prompt: string }
  map: { centerLabel: string }
  reflect: {
    divergedIntro: string
    divergedBody: string
    keepLabel: string
    switchLabel: string
  }
  stanceOnValue?: Record<string, Record<string, string>>
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  stances: StanceContent[]
  values: ValueContent[]
  content: MapContent
}

// ─── Canvas constants ─────────────────────────────────────────────────────────

const CANVAS_W = 900
const CANVAS_H = 580
const CENTER_X = 450
const CENTER_Y = 290
const ZOOM_N = 3    // scale factor when zoomed into an asteroid
const RING_R = 115  // px from canvas center to stance chip center (ring view)
const CHIP_R = 19   // stance chip half-diameter

const ASTEROID_RING: Record<string, { cx: number; cy: number; r: number }> = {
  'value-a': { cx: 450, cy: 100, r: 22 },
  'value-b': { cx: 560, cy: 100, r: 24 },
  'value-c': { cx: 593, cy: 191, r: 20 },
  'value-d': { cx: 654, cy: 272, r: 23 },
  'value-e': { cx: 618, cy: 368, r: 21 },
  'value-f': { cx: 588, cy: 454, r: 24 },
  'value-g': { cx: 490, cy: 476, r: 20 },
  'value-h': { cx: 405, cy: 459, r: 22 },
  'value-i': { cx: 315, cy: 451, r: 23 },
  'value-j': { cx: 267, cy: 357, r: 21 },
  'value-k': { cx: 272, cy: 265, r: 20 },
  'value-l': { cx: 274, cy: 167, r: 24 },
  'value-m': { cx: 372, cy: 122, r: 22 },
}

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: (i * 137.508) % 100,
  y: (i * 97.305) % 100,
  size: [1, 1, 1, 1.5, 1][i % 5],
  opacity: 0.04 + (i % 9) * 0.02,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function dominantStance(valueStances: Record<string, string | null>): string | null {
  const counts: Record<string, number> = {}
  for (const sid of Object.values(valueStances)) {
    if (!sid) continue
    counts[sid] = (counts[sid] ?? 0) + 1
  }
  let best: string | null = null
  let bestCount = 0
  for (const [id, count] of Object.entries(counts)) {
    if (count > bestCount) { best = id; bestCount = count }
  }
  return best
}

// ─── State ────────────────────────────────────────────────────────────────────

type MapPhase = 'hottake' | 'values'

interface MapState {
  phase: MapPhase
  overallStanceId: string | null
  valueStances: Record<string, string | null>
  activeValueId: string | null
  position: Position
}

type MapAction =
  | { type: 'SET_OVERALL_STANCE'; stanceId: string }
  | { type: 'SET_VALUE_STANCE'; valueId: string; stanceId: string | null }
  | { type: 'SET_ACTIVE_VALUE'; valueId: string | null }
  | { type: 'SWAP_OVERALL'; stanceId: string }
  | { type: 'RESTORE_PHASE'; phase: MapPhase }

function reducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case 'SET_OVERALL_STANCE':
      return {
        ...state,
        phase: 'values',
        overallStanceId: action.stanceId,
        position: { ...state.position, overallStance: action.stanceId },
      }

    case 'SET_VALUE_STANCE': {
      const next = { ...state.valueStances, [action.valueId]: action.stanceId }
      const spv: Record<string, ValueStance> = {}
      for (const [vid, sid] of Object.entries(next)) {
        if (sid) spv[vid] = sid as ValueStance
      }
      return {
        ...state,
        valueStances: next,
        activeValueId: null,
        position: { ...state.position, stancesPerValue: spv },
      }
    }

    case 'SET_ACTIVE_VALUE':
      return { ...state, activeValueId: action.valueId }

    case 'SWAP_OVERALL':
      return {
        ...state,
        overallStanceId: action.stanceId,
        position: { ...state.position, overallStance: action.stanceId },
      }

    case 'RESTORE_PHASE':
      return { ...state, phase: action.phase }

    default:
      return state
  }
}

function initialState(): MapState {
  return {
    phase: 'hottake',
    overallStanceId: null,
    valueStances: {},
    activeValueId: null,
    position: { takenAt: new Date() },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MapPage({ stances, values, content }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useStepHistory('/map', { phase: state.phase }, q =>
    dispatch({ type: 'RESTORE_PHASE', phase: (q.phase as MapPhase) ?? 'hottake' }),
  )

  const overallStance = state.overallStanceId
    ? stances.find(s => s.id === state.overallStanceId) ?? null
    : null

  const setCount = Object.values(state.valueStances).filter(Boolean).length
  const dominant = setCount >= 5 ? dominantStance(state.valueStances) : null
  const showReflect = !!dominant && dominant !== state.overallStanceId
  const dominantStanceObj = dominant ? stances.find(s => s.id === dominant) ?? null : null

  // Zoom layer transform: when an asteroid is active, translate the whole layer
  // so that asteroid moves to canvas center, then scale up.
  // transformOrigin is canvas center, so: scale(N) translate((cx→center), (cy→center))
  const activePos = state.activeValueId ? ASTEROID_RING[state.activeValueId] : null
  const zoomTransform = activePos
    ? `scale(${ZOOM_N}) translate(${CENTER_X - activePos.cx}px, ${CENTER_Y - activePos.cy}px)`
    : 'scale(1) translate(0, 0)'

  // Active value for the zoomed picker
  const activeValue = state.activeValueId
    ? values.find(v => v.id === state.activeValueId) ?? null
    : null

  return (
    <Container size="3" px="4" py="8">
      <div
        role="region"
        aria-label="Position map"
        style={{
          position: 'relative',
          width: CANVAS_W,
          height: CANVAS_H,
          margin: '0 auto',
          background: `radial-gradient(ellipse at ${CENTER_X}px ${CENTER_Y}px, #0d1428 0%, #06080f 100%)`,
          borderRadius: 12,
          overflow: 'hidden',
          userSelect: 'none',
          // Fuzzy nebula edge — thick diffuse shadow bleeding onto page background
          boxShadow: [
            '0 0 0 1px rgba(30, 50, 100, 0.4)',
            '0 0 40px 16px rgba(10, 20, 55, 0.7)',
            '0 0 90px 40px rgba(6, 12, 35, 0.5)',
          ].join(', '),
        }}
        onClick={() => dispatch({ type: 'SET_ACTIVE_VALUE', valueId: null })}
      >
        {/* ── Zoom layer: everything that scales with the "camera" ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
            transform: zoomTransform,
            transition: 'transform 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}
        >
          {/* Star field */}
          {STARS.map((s, i) => (
            <div
              key={i}
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                background: 'white',
                opacity: s.opacity,
                pointerEvents: 'none',
              }}
            />
          ))}

          {/* Hot take view (L1) */}
          <HotTakeView
            stances={stances}
            content={content}
            visible={state.phase === 'hottake'}
            onSelect={stanceId => dispatch({ type: 'SET_OVERALL_STANCE', stanceId })}
          />

          {/* Value asteroids (L2) */}
          {values.map((value, i) => {
            const pos = ASTEROID_RING[value.id]
            if (!pos) return null
            const sid = state.valueStances[value.id] ?? null
            const stanceColor = sid ? (stances.find(s => s.id === sid)?.color ?? null) : null
            return (
              <AsteroidNode
                key={value.id}
                value={value}
                selectedStanceId={sid}
                stanceColor={stanceColor}
                isActive={state.activeValueId === value.id}
                cx={pos.cx}
                cy={pos.cy}
                r={pos.r}
                visible={state.phase === 'values'}
                delay={180 + i * 28}
                showStartHint={i === 0 && setCount === 0}
                onActivate={() => dispatch({ type: 'SET_ACTIVE_VALUE', valueId: value.id })}
              />
            )
          })}
        </div>

        {/* ── Fixed UI layer: not affected by zoom ── */}

        {/* Center node — overall stance anchor, hidden while zoomed */}
        <CenterNode
          stance={overallStance}
          visible={state.phase === 'values' && !state.activeValueId}
        />

        {/* Instruction hint at top */}
        {state.phase === 'values' && !state.activeValueId && (
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Click any area to explore your stance
          </div>
        )}

        {/* Dim overlay when zoomed into an asteroid */}
        {state.activeValueId && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 8,
            }}
            onClick={() => dispatch({ type: 'SET_ACTIVE_VALUE', valueId: null })}
          />
        )}

        {/* Stance ring — appears at canvas center, not inside the zoom layer */}
        {state.activeValueId && activeValue && (
          <StanceRing
            value={activeValue}
            stances={stances}
            selectedStanceId={state.valueStances[activeValue.id] ?? null}
            stanceOnValue={content.stanceOnValue}
            onSelect={stanceId =>
              dispatch({ type: 'SET_VALUE_STANCE', valueId: activeValue.id, stanceId })
            }
          />
        )}

        {/* Reflect callout — bottom banner */}
        {showReflect && dominantStanceObj && overallStance && state.overallStanceId && (
          <ReflectCallout
            content={content}
            overallStance={overallStance}
            dominantStance={dominantStanceObj}
            onKeep={() => dispatch({ type: 'SET_ACTIVE_VALUE', valueId: null })}
            onSwap={() => dispatch({ type: 'SWAP_OVERALL', stanceId: dominantStanceObj.id })}
          />
        )}
      </div>
    </Container>
  )
}

// ─── Hot take view (L1) ───────────────────────────────────────────────────────

function HotTakeView({
  stances,
  content,
  visible,
  onSelect,
}: {
  stances: StanceContent[]
  content: MapContent
  visible: boolean
  onSelect: (stanceId: string) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoveredStance = hoveredId ? stances.find(s => s.id === hoveredId) ?? null : null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 60px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 10,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.92)',
          marginBottom: 8,
          textAlign: 'center',
          letterSpacing: '-0.01em',
        }}
      >
        {content.hottake.heading}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.42)',
          marginBottom: 28,
          textAlign: 'center',
        }}
      >
        {content.hottake.prompt}
      </div>

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 580 }}
        onClick={e => e.stopPropagation()}
      >
        {stances.map(stance => {
          const color = stance.color ?? '#888'
          return (
            <button
              key={stance.id}
              onClick={() => onSelect(stance.id)}
              onMouseEnter={() => setHoveredId(stance.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: 6,
                border: `1px solid ${hexToRgba(color, 0.55)}`,
                background: hexToRgba(color, 0.14),
                color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                // Glow so darker stances pop off the dark background
                boxShadow: `0 0 14px ${hexToRgba(color, 0.35)}, 0 2px 4px rgba(0,0,0,0.4)`,
                transition: 'background 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <span style={{ fontSize: 15 }}>{stance.emoji}</span>
              <span>{stance.name}</span>
            </button>
          )
        })}
      </div>

      {/* Hovered stance description — floats at the bottom of the canvas */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'center',
          opacity: hoveredStance ? 1 : 0,
          transition: 'opacity 180ms ease',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8,
            padding: '8px 18px',
            boxShadow: '0 0 28px rgba(255,255,255,0.12), 0 0 70px rgba(255,255,255,0.05)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.82)',
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}
          >
            {hoveredStance?.short}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Center node ──────────────────────────────────────────────────────────────

function CenterNode({
  stance,
  visible,
}: {
  stance: StanceContent | null
  visible: boolean
}) {
  const color = stance?.color ?? '#4a5568'
  const D = 84

  return (
    <div
      style={{
        position: 'absolute',
        left: CENTER_X - D / 2,
        top: CENTER_Y - D / 2,
        width: D,
        height: D,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${hexToRgba(color, 0.42)} 0%, ${hexToRgba(color, 0.18)} 100%)`,
        border: `2px solid ${hexToRgba(color, 0.78)}`,
        boxShadow: `0 0 20px ${hexToRgba(color, 0.5)}, 0 0 40px ${hexToRgba(color, 0.22)}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms ease',
        zIndex: 4,
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>{stance?.emoji}</span>
      <span
        style={{
          fontSize: 11,
          color: hexToRgba(color, 0.92),
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {stance?.name}
      </span>
    </div>
  )
}

// ─── Asteroid node ────────────────────────────────────────────────────────────

function AsteroidNode({
  value,
  selectedStanceId,
  stanceColor,
  isActive,
  cx,
  cy,
  r,
  visible,
  delay,
  showStartHint,
  onActivate,
}: {
  value: ValueContent
  selectedStanceId: string | null
  stanceColor: string | null
  isActive: boolean
  cx: number
  cy: number
  r: number
  visible: boolean
  delay: number
  showStartHint: boolean
  onActivate: () => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const hasStance = !!selectedStanceId

  return (
    <div
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.2)',
        transition: `opacity 420ms ease ${delay}ms, transform 420ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
        zIndex: isActive ? 6 : 3,
        cursor: 'pointer',
      }}
      onClick={e => { e.stopPropagation(); onActivate() }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Body */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: hasStance && stanceColor
            ? `radial-gradient(circle, ${hexToRgba(stanceColor, 0.55)} 0%, ${hexToRgba(stanceColor, 0.25)} 100%)`
            : isHovered || isActive
            ? 'radial-gradient(circle, rgba(55,65,95,0.95) 0%, rgba(30,36,58,0.9) 100%)'
            : 'radial-gradient(circle, rgba(38,46,72,0.9) 0%, rgba(18,22,36,0.8) 100%)',
          border: hasStance && stanceColor
            ? `1.5px solid ${hexToRgba(stanceColor, 0.75)}`
            : isHovered || isActive
            ? '1px solid rgba(130,145,200,0.55)'
            : '1px solid rgba(60,72,105,0.5)',
          boxShadow: hasStance && stanceColor
            ? `0 0 12px ${hexToRgba(stanceColor, 0.45)}`
            : isHovered || isActive
            ? '0 0 10px rgba(100,120,200,0.35)'
            : 'none',
          transition: 'background 400ms ease, border 300ms ease, box-shadow 300ms ease',
        }}
      />

      {/* Value name — shown on hover or after stance is set (but not when active/zoomed) */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 5,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: isHovered ? 'rgba(220,225,245,0.85)' : 'rgba(180,185,210,0.7)',
          whiteSpace: 'nowrap',
          opacity: (hasStance || isHovered) && !isActive ? 1 : 0,
          transition: 'opacity 250ms ease',
          pointerEvents: 'none',
        }}
      >
        {value.name}
      </div>

      {/* "Start here" hint on first asteroid when map is freshly revealed */}
      {showStartHint && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 5,
            fontSize: 8,
            color: 'rgba(255,255,255,0.38)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          start here ↓
        </div>
      )}
    </div>
  )
}

// ─── Stance ring (zoomed value picker) ───────────────────────────────────────
// Rendered in the fixed UI layer. The active asteroid zooms to canvas center,
// so we render stance chips in a ring at RING_R px from that center point.
// Hovering a chip shows the stance name + short description at the canvas bottom.

function StanceRing({
  value,
  stances,
  selectedStanceId,
  stanceOnValue,
  onSelect,
}: {
  value: ValueContent
  stances: StanceContent[]
  selectedStanceId: string | null
  stanceOnValue?: Record<string, Record<string, string>>
  onSelect: (stanceId: string | null) => void
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoveredStance = hoveredId ? stances.find(s => s.id === hoveredId) ?? null : null
  const hoveredDescription = hoveredStance
    ? (stanceOnValue?.[hoveredStance.id]?.[value.id] ?? hoveredStance.short)
    : null

  return (
    <>
      {/* Value name — centered over the zoomed asteroid body */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: CENTER_Y - 7,
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 21,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          {value.name}
        </span>
      </div>

      {/* Stance chips in a ring around canvas center */}
      {stances.map((stance, i) => {
        const angle = (2 * Math.PI * i) / stances.length - Math.PI / 2
        const cx = CENTER_X + RING_R * Math.cos(angle)
        const cy = CENTER_Y + RING_R * Math.sin(angle)
        const isSelected = selectedStanceId === stance.id
        const isHovered = hoveredId === stance.id
        const color = stance.color ?? '#888'
        return (
          <button
            key={stance.id}
            aria-label={stance.name}
            onClick={e => { e.stopPropagation(); onSelect(isSelected ? null : stance.id) }}
            onMouseEnter={() => setHoveredId(stance.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: 'absolute',
              left: cx - CHIP_R,
              top: cy - CHIP_R,
              width: CHIP_R * 2,
              height: CHIP_R * 2,
              borderRadius: '50%',
              border: `2px solid ${hexToRgba(color, isSelected || isHovered ? 0.9 : 0.45)}`,
              background: isSelected
                ? hexToRgba(color, 0.8)
                : isHovered
                ? hexToRgba(color, 0.35)
                : hexToRgba(color, 0.16),
              boxShadow: isSelected
                ? `0 0 16px ${hexToRgba(color, 0.6)}, 0 0 5px ${hexToRgba(color, 0.35)}`
                : isHovered
                ? `0 0 12px ${hexToRgba(color, 0.35)}`
                : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              transition: 'background 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
              zIndex: 20,
            }}
          >
            {stance.emoji}
          </button>
        )
      })}

      {/* Stance name + description on hover — ethereal pill at canvas bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: 60,
          right: 60,
          display: 'flex',
          justifyContent: 'center',
          opacity: hoveredStance ? 1 : 0,
          transition: 'opacity 180ms ease',
          pointerEvents: 'none',
          zIndex: 21,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.09)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8,
            padding: '8px 18px',
            boxShadow: '0 0 28px rgba(255,255,255,0.12), 0 0 70px rgba(255,255,255,0.05)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: hexToRgba(hoveredStance?.color ?? '#888', 0.9),
              marginBottom: 3,
              letterSpacing: '0.05em',
            }}
          >
            {hoveredStance?.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.75)',
              fontStyle: 'italic',
              lineHeight: 1.45,
            }}
          >
            {hoveredDescription}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Reflect callout ──────────────────────────────────────────────────────────

function ReflectCallout({
  content,
  overallStance,
  dominantStance,
  onKeep,
  onSwap,
}: {
  content: MapContent
  overallStance: StanceContent
  dominantStance: StanceContent
  onKeep: () => void
  onSwap: () => void
}) {
  const dc = dominantStance.color ?? '#888'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(7, 9, 18, 0.96)',
        borderTop: `1px solid ${hexToRgba(dc, 0.4)}`,
        padding: '10px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 8,
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginRight: 8 }}>
          {content.reflect.divergedIntro}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          {content.reflect.divergedBody
            .replace('{overall}', overallStance.name)
            .replace('{dominant}', dominantStance.name)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onKeep}
          style={{
            padding: '5px 12px',
            borderRadius: 5,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: 11,
            whiteSpace: 'nowrap',
          }}
        >
          {content.reflect.keepLabel.replace('{overall}', overallStance.name)}
        </button>
        <button
          onClick={onSwap}
          style={{
            padding: '5px 12px',
            borderRadius: 5,
            border: `1px solid ${hexToRgba(dc, 0.65)}`,
            background: hexToRgba(dc, 0.22),
            color: hexToRgba(dc, 0.95),
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {content.reflect.switchLabel.replace('{dominant}', dominantStance.name)}
        </button>
      </div>
    </div>
  )
}

// ─── Data loading ─────────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<Props> = async () => {
  const stances = loadStances()
  const values = loadValues()
  const content = loadConceptContent<MapContent>('map')
  return { props: { stances, values, content } }
}
