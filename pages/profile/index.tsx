import { useReducer, useEffect, useRef, useState } from 'react'
import type { GetStaticProps } from 'next'
import { useRouter } from 'next/router'
import {
  Box,
  Button,
  Card,
  Container,
  Dialog,
  Flex,
  Heading,
  Separator,
  Slider,
  Switch,
  Text,
} from '@radix-ui/themes'
import { loadStances, loadValues, loadConceptContent } from '@/lib/content'
import type {
  StanceContent,
  ValueContent,
  Position,
  ValueStance,
  ValueDetail,
  StanceEntry,
} from '@/lib/types'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function StanceLabel({ stance }: { stance: StanceContent }) {
  const color = stance.color ?? 'var(--gray-9)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        border: `1.5px solid ${color}`,
        overflow: 'hidden',
        fontSize: 12,
        lineHeight: 1,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    >
      <span style={{ background: color, padding: '3px 7px', fontSize: 14 }}>
        {stance.emoji ?? ''}
      </span>
      <span
        style={{
          background: 'white',
          padding: '3px 9px',
          color: 'var(--gray-12)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {stance.name}
      </span>
    </span>
  )
}

// ─── Content types ────────────────────────────────────────────────────────────

interface SurveyContent {
  intro: { heading: string; body: string }
  layer1: { question: string; cta: string }
  reflect: { heading: string; goDeeper: string; valuesIntro: string; unexploredLabel: string }
  layer2: {
    heading: string
    instruction: string
    stancePrompt: string
    skipLabel: string
    doneLabel: string
    progressLabel: string
  }
  importance: {
    heading: string
    instruction: string
    dontCareLabel: string
    doneLabel: string
  }
  // Layer 2b: multi-stance selection + relative weighting for one value.
  // Notes per stance are entered via modal (no separate layer 3 page).
  layer2b: {
    heading: string
    instruction: string
    weightLabel: string
    clarifyLabel: string
    editNotesLabel: string
    modalStoryPlaceholder: string
    modalSaveLabel: string
    modalCancelLabel: string
    doneLabel: string
  }
}

// ─── Page props ───────────────────────────────────────────────────────────────

interface Props {
  stances: StanceContent[]
  values: ValueContent[]
  content: SurveyContent
}

// ─── State ────────────────────────────────────────────────────────────────────

// Steps:
//   layer1      – pick overall stance
//   reflect     – reflect-back: shows full stance detail + values list; resting state
//   layer2      – pick one stance per value
//   layer2b     – multi-stance + relative weighting for one value (notes via modal)
//   importance  – relative importance per value (currently unreachable from UI)
type Step = 'layer1' | 'reflect' | 'layer2' | 'layer2b' | 'importance'

interface SurveyState {
  step: Step
  position: Position
  currentValueIndex: number
  // When true, SET_VALUE_STANCE and SKIP_VALUE return to reflect instead of advancing.
  revisiting: boolean
  // Tracks which value is being edited in layer2b.
  detailValueId: string | null
}

type SurveyAction =
  | { type: 'SELECT_AND_ADVANCE_LAYER1'; stanceId: string }
  | { type: 'SET_VALUE_STANCE'; valueId: string; stanceId: string }
  | { type: 'SKIP_VALUE' }
  | { type: 'JUMP_TO_VALUE'; valueIndex: number }
  | { type: 'STEP_TO_VALUE'; valueIndex: number }
  | { type: 'FINISH_LAYER2' }
  // Layer 2b: per-value detail (auto-saved on every interaction)
  | { type: 'ENTER_LAYER2B'; valueId: string; layer2StanceId: string | undefined }
  | { type: 'TOGGLE_VALUE_DETAIL_STANCE'; valueId: string; stanceId: string }
  | { type: 'SET_VALUE_DETAIL_WEIGHT'; valueId: string; stanceId: string; weight: number }
  | { type: 'SET_VALUE_DETAIL_STORY'; valueId: string; stanceId: string; story: string }
  | { type: 'EXIT_LAYER2B' }
  // Importance (value importance; currently unreachable from UI)
  | { type: 'GO_TO_IMPORTANCE' }
  | { type: 'SET_VALUE_IMPORTANCE'; valueId: string; score: number | null; dontCare: boolean }
  | { type: 'FINISH_IMPORTANCE' }

function reducer(state: SurveyState, action: SurveyAction): SurveyState {
  switch (action.type) {
    case 'SELECT_AND_ADVANCE_LAYER1':
      return {
        ...state,
        step: 'reflect',
        position: { ...state.position, overallStance: action.stanceId, takenAt: new Date() },
      }

    case 'SET_VALUE_STANCE': {
      const stancesPerValue = {
        ...(state.position.stancesPerValue ?? {}),
        [action.valueId]: action.stanceId as ValueStance,
      }
      if (state.revisiting) {
        return {
          ...state,
          step: 'reflect',
          revisiting: false,
          position: { ...state.position, stancesPerValue },
        }
      }
      return {
        ...state,
        position: { ...state.position, stancesPerValue },
        currentValueIndex: state.currentValueIndex + 1,
      }
    }

    case 'SKIP_VALUE':
      if (state.revisiting) {
        return { ...state, step: 'reflect', revisiting: false }
      }
      return { ...state, currentValueIndex: state.currentValueIndex + 1 }

    case 'JUMP_TO_VALUE':
      return { ...state, step: 'layer2', currentValueIndex: action.valueIndex, revisiting: true }

    case 'STEP_TO_VALUE':
      return { ...state, currentValueIndex: action.valueIndex }

    case 'FINISH_LAYER2':
      return { ...state, step: 'reflect' }

    case 'ENTER_LAYER2B': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid]
      // Pre-seed with the layer2 stance when opening for the first time.
      let valueDetails = state.position.valueDetails ?? {}
      if (
        !existing?.stances.length &&
        action.layer2StanceId &&
        action.layer2StanceId !== 'unexplored'
      ) {
        valueDetails = {
          ...valueDetails,
          [vid]: { stances: [{ stance: action.layer2StanceId, weight: 50 }], relationships: [] },
        }
      }
      return {
        ...state,
        step: 'layer2b',
        detailValueId: vid,
        position: { ...state.position, valueDetails },
      }
    }

    case 'TOGGLE_VALUE_DETAIL_STANCE': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid] ?? { stances: [], relationships: [] }
      const hasStance = existing.stances.some(e => e.stance === action.stanceId)
      const updatedStances = hasStance
        ? existing.stances.filter(e => e.stance !== action.stanceId)
        : [...existing.stances, { stance: action.stanceId, weight: 50 }]
      const valueDetails = {
        ...(state.position.valueDetails ?? {}),
        [vid]: { ...existing, stances: updatedStances },
      }
      return { ...state, position: { ...state.position, valueDetails } }
    }

    case 'SET_VALUE_DETAIL_WEIGHT': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid] ?? { stances: [], relationships: [] }
      const updatedStances = existing.stances.map(e =>
        e.stance === action.stanceId ? { ...e, weight: action.weight } : e
      )
      const valueDetails = {
        ...(state.position.valueDetails ?? {}),
        [vid]: { ...existing, stances: updatedStances },
      }
      return { ...state, position: { ...state.position, valueDetails } }
    }

    case 'SET_VALUE_DETAIL_STORY': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid] ?? { stances: [], relationships: [] }
      const updatedStances = existing.stances.map(e =>
        e.stance === action.stanceId ? { ...e, story: action.story } : e
      )
      const valueDetails = {
        ...(state.position.valueDetails ?? {}),
        [vid]: { ...existing, stances: updatedStances },
      }
      return { ...state, position: { ...state.position, valueDetails } }
    }

    case 'EXIT_LAYER2B':
      return { ...state, step: 'reflect', detailValueId: null }

    case 'GO_TO_IMPORTANCE':
      return { ...state, step: 'importance' }

    case 'SET_VALUE_IMPORTANCE': {
      const valueImportances = {
        ...(state.position.valueImportances ?? {}),
        [action.valueId]: { score: action.score, dontCare: action.dontCare },
      }
      return { ...state, position: { ...state.position, valueImportances } }
    }

    case 'FINISH_IMPORTANCE':
      return { ...state, step: 'reflect' }

    default:
      return state
  }
}

function initialState(): SurveyState {
  return {
    step: 'layer1',
    position: { takenAt: new Date() },
    currentValueIndex: 0,
    revisiting: false,
    detailValueId: null,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SurveyPage({ stances, values, content }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const router = useRouter()

  // Auto-advance to reflect once all values have been stepped through.
  useEffect(() => {
    if (state.step === 'layer2' && !state.revisiting && state.currentValueIndex >= values.length) {
      dispatch({ type: 'FINISH_LAYER2' })
    }
  }, [state.step, state.currentValueIndex, state.revisiting, values.length])

  // Keep the URL in sync with state so individual views are linkable.
  useEffect(() => {
    const query: Record<string, string> = { step: state.step }
    if (state.step === 'layer2') query.v = String(state.currentValueIndex)
    if (state.step === 'layer2b' && state.detailValueId) query.vid = state.detailValueId
    router.replace({ pathname: '/profile', query }, undefined, { shallow: true })
  }, [state.step, state.currentValueIndex, state.detailValueId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Container size="2" px="4" py="8">
      {state.step === 'layer1' && (
        <Layer1
          stances={stances}
          content={content}
          onSelect={stanceId => dispatch({ type: 'SELECT_AND_ADVANCE_LAYER1', stanceId })}
        />
      )}

      {state.step === 'reflect' && (
        <Reflect
          stances={stances}
          values={values}
          position={state.position}
          content={content}
          onJumpToValue={valueIndex => dispatch({ type: 'JUMP_TO_VALUE', valueIndex })}
          onEnterLayer2b={valueId =>
            dispatch({
              type: 'ENTER_LAYER2B',
              valueId,
              layer2StanceId: state.position.stancesPerValue?.[valueId],
            })
          }
        />
      )}

      {state.step === 'layer2' && (
        <Layer2
          stances={stances}
          values={values}
          content={content}
          currentIndex={state.currentValueIndex}
          stancesPerValue={state.position.stancesPerValue ?? {}}
          onSetStance={(valueId, stanceId) =>
            dispatch({ type: 'SET_VALUE_STANCE', valueId, stanceId })
          }
          onSkip={() => dispatch({ type: 'SKIP_VALUE' })}
          onFinish={() => dispatch({ type: 'FINISH_LAYER2' })}
          onJumpTo={valueIndex => dispatch({ type: 'STEP_TO_VALUE', valueIndex })}
        />
      )}

      {state.step === 'layer2b' && (() => {
        const vid = state.detailValueId
        if (!vid) return null
        const v = values.find(v => v.id === vid)
        if (!v) return null
        return (
          <Layer2b
            stances={stances}
            value={v}
            existing={state.position.valueDetails?.[vid]}
            content={content}
            onToggle={stanceId =>
              dispatch({ type: 'TOGGLE_VALUE_DETAIL_STANCE', valueId: vid, stanceId })
            }
            onSetWeight={(stanceId, weight) =>
              dispatch({ type: 'SET_VALUE_DETAIL_WEIGHT', valueId: vid, stanceId, weight })
            }
            onSetStory={(stanceId, story) =>
              dispatch({ type: 'SET_VALUE_DETAIL_STORY', valueId: vid, stanceId, story })
            }
            onDone={() => dispatch({ type: 'EXIT_LAYER2B' })}
          />
        )
      })()}

      {state.step === 'importance' && (
        <Importance
          values={values}
          content={content}
          position={state.position}
          onSetImportance={(valueId, score, dontCare) =>
            dispatch({ type: 'SET_VALUE_IMPORTANCE', valueId, score, dontCare })
          }
          onDone={() => dispatch({ type: 'FINISH_IMPORTANCE' })}
        />
      )}

    </Container>
  )
}

// ─── Layer 1 ──────────────────────────────────────────────────────────────────

function Layer1({
  stances,
  content,
  onSelect,
}: {
  stances: StanceContent[]
  content: SurveyContent
  onSelect: (id: string) => void
}) {
  return (
    <Flex direction="column" gap="6">
      <Heading size="5">{content.layer1.question}</Heading>

      <Flex direction="column" gap="2">
        {stances.map(stance => {
          const color = stance.color ?? 'var(--gray-6)'
          return (
            <button
              key={stance.id}
              onClick={() => onSelect(stance.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: `2px solid ${color}`,
                borderRadius: 'var(--radius-3)',
                background: stance.color ? hexToRgba(stance.color, 0.07) : 'var(--gray-1)',
                padding: 'var(--space-3)',
                cursor: 'pointer',
              }}
            >
              <Flex direction="column" gap="1">
                <Flex align="center" gap="2">
                  {stance.emoji && <Text>{stance.emoji}</Text>}
                  <Text weight="medium">{stance.name}</Text>
                </Flex>
                <Text size="2" color="gray">
                  {stance.short}
                </Text>
              </Flex>
            </button>
          )
        })}
      </Flex>
    </Flex>
  )
}

// ─── Reflect ─────────────────────────────────────────────────────────────────
// Unified resting state: shows full stance detail + values list.
// Entered after layer1 selection, after finishing layer2, and after layer2b.

function Reflect({
  stances,
  values,
  position,
  content,
  onJumpToValue,
  onEnterLayer2b,
}: {
  stances: StanceContent[]
  values: ValueContent[]
  position: Position
  content: SurveyContent
  onJumpToValue: (valueIndex: number) => void
  onEnterLayer2b: (valueId: string) => void
}) {
  const overallStance = stances.find(s => s.id === position.overallStance)
  const spv = position.stancesPerValue ?? {}
  const vd = position.valueDetails ?? {}
  const hasAnyValues = Object.keys(spv).length > 0

  return (
    <Flex direction="column" gap="6">
      <Heading size="5">{content.reflect.heading}</Heading>

      {overallStance && (
        <Flex direction="column" gap="4">
          <Box>
            <Text size="2" color="gray" mb="1" as="p">
              Overall
            </Text>
            <Heading size="6">{overallStance.name}</Heading>
          </Box>

          <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
            {overallStance.description}
          </Text>

          {overallStance.example && (
            <Card>
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium" color="gray">
                  What this looks like
                </Text>
                <Text size="2" style={{ lineHeight: '1.6' }}>
                  {overallStance.example}
                </Text>
              </Flex>
            </Card>
          )}
        </Flex>
      )}

      <Separator size="4" />

      {!hasAnyValues ? (
        <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
          {content.reflect.goDeeper}
        </Text>
      ) : (
        <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
          {content.reflect.valuesIntro}
        </Text>
      )}

      <Flex direction="column">
        {values.map((v, i) => {
          const stanceId = spv[v.id]
          const stance = stances.find(s => s.id === stanceId)
          const detail = vd[v.id]
          const detailStances = detail?.stances ?? []
          const hasDetail = detailStances.length > 0
          const isExplored = !!stanceId

          // Expanded view: value has layer2b detail with one or more stances
          if (hasDetail) {
            const totalWeight = detailStances.reduce((sum, e) => sum + e.weight, 0) || 1
            const hasStories = detailStances.some(e => e.story)

            return (
              <Flex
                key={v.id}
                direction="column"
                gap="2"
                style={{ borderBottom: '1px solid var(--gray-4)', padding: '10px 0' }}
              >
                {/* Header: value name + edit button */}
                <Flex justify="between" align="center">
                  <button
                    onClick={() => onJumpToValue(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                    }}
                  >
                    <Text size="2" weight="medium">{v.name}</Text>
                  </button>
                  <button
                    onClick={() => onEnterLayer2b(v.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--accent-9)',
                      fontSize: 12,
                      fontWeight: 500,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Edit detail
                  </button>
                </Flex>

                {/* Progress bar with tags positioned under each segment */}
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  {detailStances.map((e, idx) => {
                    const s = stances.find(st => st.id === e.stance)
                    const pct = (e.weight / totalWeight) * 100
                    const isFirst = idx === 0
                    const isLast = idx === detailStances.length - 1
                    return (
                      <div key={e.stance} style={{ width: `${pct}%`, minWidth: 0 }}>
                        <div
                          style={{
                            height: 8,
                            background: s?.color ?? 'var(--gray-6)',
                            borderRadius: isFirst && isLast ? 4
                              : isFirst ? '4px 0 0 4px'
                              : isLast ? '0 4px 4px 0'
                              : 0,
                          }}
                        />
                        <div style={{ paddingTop: 6, overflow: 'visible', whiteSpace: 'nowrap' }}>
                          <Flex align="center" gap="1">
                            <StanceLabel stance={s!} />
                            <Text size="1" color="gray">{e.weight}</Text>
                          </Flex>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Stories */}
                {hasStories && (
                  <Flex direction="column" gap="1">
                    {detailStances.filter(e => e.story).map(e => {
                      const s = stances.find(st => st.id === e.stance)
                      return (
                        <Text
                          key={e.stance}
                          size="1"
                          color="gray"
                          style={{ lineHeight: '1.5', fontStyle: 'italic' }}
                        >
                          {s?.emoji} {s?.name}: &ldquo;{e.story}&rdquo;
                        </Text>
                      )
                    })}
                  </Flex>
                )}
              </Flex>
            )
          }

          // Simple row: layer2 stance only, or unexplored
          return (
            <Flex
              key={v.id}
              align="center"
              style={{ borderBottom: '1px solid var(--gray-4)' }}
            >
              <button
                onClick={() => onJumpToValue(i)}
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 0',
                  textAlign: 'left',
                  gap: 12,
                }}
              >
                <Text size="2" weight="medium" style={{ flex: 1 }}>
                  {v.name}
                </Text>
                {stance ? (
                  <StanceLabel stance={stance} />
                ) : (
                  <Text size="2" color="gray">
                    {content.reflect.unexploredLabel}
                  </Text>
                )}
              </button>
              {isExplored && (
                <button
                  onClick={() => onEnterLayer2b(v.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 0 10px 12px',
                    color: 'var(--accent-9)',
                    fontSize: 12,
                    fontWeight: 500,
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Detail
                </button>
              )}
            </Flex>
          )
        })}
      </Flex>
    </Flex>
  )
}

// ─── Value steps ─────────────────────────────────────────────────────────────

function ValueSteps({
  values,
  stances,
  stancesPerValue,
  currentIndex,
  onJumpTo,
  disabled,
}: {
  values: ValueContent[]
  stances: StanceContent[]
  stancesPerValue: Record<string, ValueStance>
  currentIndex: number
  onJumpTo: (index: number) => void
  disabled?: boolean
}) {
  return (
    <Flex wrap="wrap" gap="1" style={{ flex: 1 }}>
      {values.map((v, i) => {
        const stanceId = stancesPerValue[v.id]
        const setStance = stanceId ? stances.find(s => s.id === stanceId) : undefined
        const isCurrent = i === currentIndex
        const isPast = i < currentIndex

        let bg = 'transparent'
        let border = '1px solid var(--gray-5)'
        let color = 'var(--gray-8)'
        const fontWeight: React.CSSProperties['fontWeight'] = isCurrent ? 'bold' : 'normal'

        if (isCurrent) {
          bg = 'var(--accent-9)'
          border = '1px solid var(--accent-9)'
          color = 'white'
        } else if (setStance?.color) {
          bg = hexToRgba(setStance.color, 0.15)
          border = `1px solid ${setStance.color}`
          color = setStance.color
        } else if (isPast) {
          bg = 'var(--gray-3)'
          border = '1px solid var(--gray-5)'
          color = 'var(--gray-8)'
        }

        return (
          <button
            key={v.id}
            onClick={() => onJumpTo(i)}
            title={v.name}
            disabled={disabled}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border,
              background: bg,
              color,
              fontWeight,
              fontSize: 11,
              cursor: disabled ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              lineHeight: 1,
            }}
          >
            {setStance && !isCurrent ? '✓' : i + 1}
          </button>
        )
      })}
    </Flex>
  )
}

// ─── Layer 2 ──────────────────────────────────────────────────────────────────

type AnimPhase = 'idle' | 'selecting' | 'holding' | 'exiting'

function Layer2({
  stances,
  values,
  content,
  currentIndex,
  stancesPerValue,
  onSetStance,
  onSkip,
  onFinish,
  onJumpTo,
}: {
  stances: StanceContent[]
  values: ValueContent[]
  content: SurveyContent
  currentIndex: number
  stancesPerValue: Record<string, ValueStance>
  onSetStance: (valueId: string, stanceId: string) => void
  onSkip: () => void
  onFinish: () => void
  onJumpTo: (valueIndex: number) => void
}) {
  const value = values[currentIndex] as ValueContent | undefined

  const [animPhase, setAnimPhase] = useState<AnimPhase>('idle')
  const [animStanceId, setAnimStanceId] = useState<string | null>(null)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearAllTimeouts() {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  // Reset animation if the user navigates to a different value mid-animation.
  useEffect(() => {
    clearAllTimeouts()
    setAnimPhase('idle')
    setAnimStanceId(null)
  }, [currentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount.
  useEffect(() => () => clearAllTimeouts(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStanceClick(valueId: string, stanceId: string) {
    if (animPhase !== 'idle') return
    setAnimStanceId(stanceId)
    setAnimPhase('selecting')

    // Phase 1 (0–300ms): others fade to gray, selected scales up.
    // Phase 2 (300–600ms): hold.
    // Phase 3 (600–900ms): selected fades out.
    // After 900ms: commit and advance.
    const t1 = setTimeout(() => {
      setAnimPhase('holding')
      const t2 = setTimeout(() => {
        setAnimPhase('exiting')
        const t3 = setTimeout(() => {
          clearAllTimeouts()
          setAnimPhase('idle')
          setAnimStanceId(null)
          onSetStance(valueId, stanceId)
        }, 300)
        timeoutsRef.current.push(t3)
      }, 300)
      timeoutsRef.current.push(t2)
    }, 300)
    timeoutsRef.current.push(t1)
  }

  // All values done; parent useEffect will dispatch FINISH_LAYER2.
  if (!value) return null

  const isAnimating = animPhase !== 'idle'
  const currentSetStanceId = stancesPerValue[value.id]

  return (
    <Flex direction="column" gap="6">
      <Flex justify="between" align="start">
        <ValueSteps
          values={values}
          stances={stances}
          stancesPerValue={stancesPerValue}
          currentIndex={currentIndex}
          onJumpTo={onJumpTo}
          disabled={isAnimating}
        />
        <Button
          size="2"
          variant="ghost"
          onClick={onFinish}
          disabled={isAnimating}
          style={{ flexShrink: 0 }}
        >
          {content.layer2.doneLabel}
        </Button>
      </Flex>

      {/* key forces remount on value change, restarting the fadeIn animation */}
      <div key={value.id} style={{ animation: 'fadeIn 0.3s ease' }}>
        <Flex direction="column" gap="6">
          <Flex direction="column" gap="2">
            <Heading size="5">{value.name}</Heading>
            <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
              {value.description}
            </Text>
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">
              {content.layer2.stancePrompt}
            </Text>
            {stances.map(stance => {
              const color = stance.color ?? 'var(--gray-6)'
              const isAnimSelected = stance.id === animStanceId
              const isCurrentSet = !isAnimating && stance.id === currentSetStanceId

              let opacity = 1
              let transform = 'scale(1)'

              if (animPhase === 'selecting' || animPhase === 'holding') {
                if (isAnimSelected) {
                  transform = 'scale(1.2)'
                } else {
                  opacity = 0.3
                }
              } else if (animPhase === 'exiting') {
                if (isAnimSelected) {
                  opacity = 0
                  transform = 'scale(1.2)'
                } else {
                  opacity = 0.3
                }
              }

              return (
                <button
                  key={stance.id}
                  onClick={() => handleStanceClick(value.id, stance.id)}
                  disabled={isAnimating}
                  aria-pressed={isCurrentSet}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: isCurrentSet ? `3px solid ${color}` : `2px solid ${color}`,
                    borderRadius: 'var(--radius-3)',
                    background: isCurrentSet
                      ? hexToRgba(color, 0.18)
                      : hexToRgba(color, 0.07),
                    padding: 'var(--space-3)',
                    cursor: isAnimating ? 'default' : 'pointer',
                    opacity,
                    transform,
                    transformOrigin: 'center',
                    transition: isAnimating ? 'opacity 0.3s ease, transform 0.3s ease' : 'none',
                  }}
                >
                  <Flex justify="between" align="center">
                    <Flex direction="column" gap="1" style={{ flex: 1 }}>
                      <Flex align="center" gap="2">
                        {stance.emoji && <Text>{stance.emoji}</Text>}
                        <Text weight="medium">{stance.name}</Text>
                      </Flex>
                      <Text size="2" color="gray">
                        {stance.short}
                      </Text>
                    </Flex>
                    {isCurrentSet && (
                      <Text style={{ color, fontSize: 16, flexShrink: 0, marginLeft: 8 }}>
                        ✓
                      </Text>
                    )}
                  </Flex>
                </button>
              )
            })}
          </Flex>

          <Box>
            <Button size="2" variant="soft" color="gray" onClick={onSkip} disabled={isAnimating}>
              {content.layer2.skipLabel}
            </Button>
          </Box>
        </Flex>
      </div>
    </Flex>
  )
}

// ─── Layer 2b: multi-stance + relative weighting; notes via modal ─────────────

function Layer2b({
  stances,
  value,
  existing,
  content,
  onToggle,
  onSetWeight,
  onSetStory,
  onDone,
}: {
  stances: StanceContent[]
  value: ValueContent
  existing: ValueDetail | undefined
  content: SurveyContent
  onToggle: (stanceId: string) => void
  onSetWeight: (stanceId: string, weight: number) => void
  onSetStory: (stanceId: string, story: string) => void
  onDone: () => void
}) {
  // Local weight state drives smooth slider display; committed to position on release.
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {}
    for (const e of existing?.stances ?? []) {
      w[e.stance] = e.weight
    }
    return w
  })

  // Sync any newly toggled-on stances into local weights.
  useEffect(() => {
    setWeights(prev => {
      const next = { ...prev }
      let changed = false
      for (const e of existing?.stances ?? []) {
        if (!(e.stance in next)) {
          next[e.stance] = e.weight
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [existing])

  // Modal state: which stance is being clarified.
  const [clarifyingId, setClarifyingId] = useState<string | null>(null)
  const [modalStory, setModalStory] = useState('')

  const selectedIds = new Set((existing?.stances ?? []).map(e => e.stance))
  const clarifyingStance = clarifyingId ? stances.find(s => s.id === clarifyingId) : null

  function openClarify(stanceId: string) {
    const currentStory = existing?.stances.find(e => e.stance === stanceId)?.story ?? ''
    setClarifyingId(stanceId)
    setModalStory(currentStory)
  }

  function saveModal() {
    if (clarifyingId) onSetStory(clarifyingId, modalStory)
    setClarifyingId(null)
    setModalStory('')
  }

  function closeModal() {
    setClarifyingId(null)
    setModalStory('')
  }

  return (
    <>
      <Flex direction="column" gap="6">
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">
            {content.layer2b.heading}
          </Text>
          <Heading size="5">{value.name}</Heading>
        </Flex>

        <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
          {content.layer2b.instruction}
        </Text>

        <Flex direction="column" gap="4">
          {stances.map(stance => {
            const color = stance.color ?? 'var(--gray-6)'
            const isOn = selectedIds.has(stance.id)
            const weight = weights[stance.id] ?? 50
            const hasNotes = !!(existing?.stances.find(e => e.stance === stance.id)?.story)

            return (
              <Flex key={stance.id} direction="column" gap="2">
                {/* Toggle: off = inactive (0.6 opacity), on = layer2-selected style */}
                <button
                  onClick={() => onToggle(stance.id)}
                  aria-pressed={isOn}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: isOn ? `3px solid ${color}` : '1px solid var(--gray-4)',
                    borderRadius: 'var(--radius-3)',
                    background: isOn ? hexToRgba(color, 0.18) : 'transparent',
                    padding: 'var(--space-3)',
                    cursor: 'pointer',
                    opacity: isOn ? 1 : 0.6,
                  }}
                >
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                      {stance.emoji && <Text>{stance.emoji}</Text>}
                      <Text weight="medium">{stance.name}</Text>
                    </Flex>
                    {isOn && (
                      <Text style={{ color, fontSize: 16, flexShrink: 0, marginLeft: 8 }}>
                        ✓
                      </Text>
                    )}
                  </Flex>
                </button>

                {/* Weight slider + clarify button; only for on stances */}
                {isOn && (
                  <Flex direction="column" gap="1" px="1">
                    <Flex align="center" gap="3">
                      <Text size="1" color="gray" style={{ flexShrink: 0 }}>
                        {content.layer2b.weightLabel}
                      </Text>
                      <Slider
                        min={1}
                        max={100}
                        value={[weight]}
                        onValueChange={([val]) =>
                          setWeights(w => ({ ...w, [stance.id]: val }))
                        }
                        onValueCommit={([val]) => onSetWeight(stance.id, val)}
                      />
                      <Text
                        size="1"
                        color="gray"
                        style={{ flexShrink: 0, minWidth: 24, textAlign: 'right' }}
                      >
                        {weight}
                      </Text>
                    </Flex>
                    <Flex justify="end">
                      <button
                        onClick={() => openClarify(stance.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--accent-9)',
                          fontSize: 12,
                          fontWeight: 500,
                          padding: '2px 0',
                        }}
                      >
                        {hasNotes
                          ? content.layer2b.editNotesLabel
                          : content.layer2b.clarifyLabel}
                      </button>
                    </Flex>
                  </Flex>
                )}
              </Flex>
            )
          })}
        </Flex>

        <Box>
          <Button size="3" variant="ghost" onClick={onDone}>
            {content.layer2b.doneLabel}
          </Button>
        </Box>
      </Flex>

      {/* Notes modal */}
      <Dialog.Root
        open={clarifyingId !== null}
        onOpenChange={open => { if (!open) closeModal() }}
      >
        <Dialog.Content maxWidth="460px">
          {clarifyingStance && (
            <>
              <Dialog.Title>
                <Flex align="center" gap="2">
                  {clarifyingStance.emoji && <span>{clarifyingStance.emoji}</span>}
                  <span>{clarifyingStance.name}</span>
                </Flex>
              </Dialog.Title>
              <Dialog.Description size="2" color="gray" mb="4">
                {value.name}
              </Dialog.Description>
            </>
          )}
          <textarea
            autoFocus
            placeholder={content.layer2b.modalStoryPlaceholder}
            value={modalStory}
            onChange={e => setModalStory(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px',
              borderRadius: 'var(--radius-2)',
              border: `1px solid ${clarifyingStance?.color ?? 'var(--gray-6)'}`,
              fontFamily: 'inherit',
              fontSize: 13,
              background: clarifyingStance?.color
                ? hexToRgba(clarifyingStance.color, 0.04)
                : 'var(--gray-1)',
              color: 'var(--gray-12)',
              boxSizing: 'border-box',
            }}
          />
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="ghost" color="gray">
                {content.layer2b.modalCancelLabel}
              </Button>
            </Dialog.Close>
            <Button onClick={saveModal}>
              {content.layer2b.modalSaveLabel}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

// ─── Importance: relative importance per value ────────────────────────────────

function Importance({
  values,
  content,
  position,
  onSetImportance,
  onDone,
}: {
  values: ValueContent[]
  content: SurveyContent
  position: Position
  onSetImportance: (valueId: string, score: number | null, dontCare: boolean) => void
  onDone: () => void
}) {
  const importances = position.valueImportances ?? {}

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="2">
        <Heading size="5">{content.importance.heading}</Heading>
        <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
          {content.importance.instruction}
        </Text>
      </Flex>

      <Flex direction="column" gap="5">
        {values.map(v => {
          const current = importances[v.id] ?? { score: 50, dontCare: false }
          return (
            <Flex key={v.id} direction="column" gap="3">
              <Flex justify="between" align="center">
                <Text size="2" weight="medium">
                  {v.name}
                </Text>
                {!current.dontCare && (
                  <Text size="2" color="gray">
                    {current.score ?? 50}
                  </Text>
                )}
              </Flex>

              {!current.dontCare && (
                <Slider
                  min={1}
                  max={100}
                  value={[current.score ?? 50]}
                  onValueChange={([val]) => onSetImportance(v.id, val, false)}
                />
              )}

              <Flex align="center" gap="2">
                <Switch
                  size="1"
                  checked={current.dontCare}
                  onCheckedChange={checked =>
                    onSetImportance(v.id, checked ? null : 50, checked)
                  }
                />
                <Text size="2" color="gray">
                  {content.importance.dontCareLabel}
                </Text>
              </Flex>

              <Separator size="4" />
            </Flex>
          )
        })}
      </Flex>

      <Box>
        <Button size="3" onClick={onDone}>
          {content.importance.doneLabel}
        </Button>
      </Box>
    </Flex>
  )
}

// ─── Data loading ─────────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<Props> = async () => {
  const stances = loadStances()
  const values = loadValues()
  const content = loadConceptContent<SurveyContent>('survey')
  return { props: { stances, values, content } }
}
