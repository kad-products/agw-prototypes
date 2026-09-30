import React, { useReducer, useEffect, useState } from 'react'
import type { GetStaticProps } from 'next'
import {
  Box,
  Button,
  Container,
  Dialog,
  Flex,
  Heading,
  Separator,
  Slider,
  Text,
} from '@radix-ui/themes'
import { Pencil2Icon } from '@radix-ui/react-icons'
import { loadStances, loadValues, loadStatements, loadConceptContent } from '@/lib/content'
import { useStepHistory } from '@/lib/useStepHistory'
import type {
  StanceContent,
  ValueContent,
  StatementContent,
  Reaction,
  Position,
  ValueStance,
  ValueDetail,
} from '@/lib/types'

// ─── Content type ─────────────────────────────────────────────────────────────

interface StatementsContent {
  intro: { heading: string; body: string }
  reactions: {
    agreeLabel: string
    neutralLabel: string
    disagreeLabel: string
    nextLabel: string
    doneLabel: string
    skipNote: string
  }
  reflect: {
    heading: string
    intro: string
    tabStanceLabel: string
    tabValueLabel: string
    editReactionLabel: string
    noAnswerLabel: string
    layer2Cta: string
    revisitLayer2Cta: string
    unexploredLabel: string
  }
  layer2: {
    suggestedLabel: string
    looksRightLabel: string
    changeLabel: string
    skipLabel: string
    doneLabel: string
    reactModeIntro: string
    reactModeChangeIntro: string
    reactModeSuggestion: string
    reactModeConfirmLabel: string
  }
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
  statements: StatementContent[]
  pages: StatementContent[][]
  content: StatementsContent
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreStances(
  reactions: Record<string, Reaction>,
  statements: StatementContent[],
): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const stmt of statements) {
    const r = reactions[stmt.id]
    if (!r || r === 'neutral') continue
    scores[stmt.stanceId] = (scores[stmt.stanceId] ?? 0) + (r === 'agree' ? 1 : -1)
  }
  return scores
}

function topStance(scores: Record<string, number>): string | null {
  let best: string | null = null
  let bestScore = 0
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = id
      bestScore = score
    }
  }
  return best
}

function computeValueSuggestions(
  reactions: Record<string, Reaction>,
  statements: StatementContent[],
): Record<string, string> {
  const byValue: Record<string, StatementContent[]> = {}
  for (const stmt of statements) {
    if (!byValue[stmt.valueId]) byValue[stmt.valueId] = []
    byValue[stmt.valueId].push(stmt)
  }
  const result: Record<string, string> = {}
  for (const [vid, stmts] of Object.entries(byValue)) {
    const top = topStance(scoreStances(reactions, stmts))
    if (top) result[vid] = top
  }
  return result
}

function getReactedValueIds(
  reactions: Record<string, Reaction>,
  statements: StatementContent[],
  values: ValueContent[],
): string[] {
  const reacted = new Set<string>()
  for (const stmt of statements) {
    const r = reactions[stmt.id]
    if (r && r !== 'neutral') reacted.add(stmt.valueId)
  }
  return values.filter(v => reacted.has(v.id)).map(v => v.id)
}

// ─── State ────────────────────────────────────────────────────────────────────

type Step = 'reactions' | 'reflect' | 'layer2' | 'layer2b'

interface StatementsState {
  step: Step
  reactions: Record<string, Reaction>
  position: Position
  currentPage: number
  currentValueIndex: number
  revisiting: boolean
  detailValueId: string | null
}

type StatementsAction =
  | { type: 'SET_REACTION'; statementId: string; reaction: Reaction }
  | { type: 'NEXT_PAGE' }
  | { type: 'FINISH_REACTIONS'; suggestedStanceId: string | null }
  | { type: 'CLEAR_REACTION'; statementId: string }
  | { type: 'GO_TO_LAYER2' }
  | { type: 'CONFIRM_VALUE_STANCE'; valueId: string; stanceId: string }
  | { type: 'SKIP_VALUE' }
  | { type: 'JUMP_TO_VALUE'; valueIndex: number }
  | { type: 'FINISH_LAYER2' }
  | { type: 'ENTER_LAYER2B'; valueId: string }
  | { type: 'TOGGLE_VALUE_DETAIL_STANCE'; valueId: string; stanceId: string }
  | { type: 'SET_VALUE_DETAIL_WEIGHT'; valueId: string; stanceId: string; weight: number }
  | { type: 'SET_VALUE_DETAIL_STORY'; valueId: string; stanceId: string; story: string }
  | { type: 'EXIT_LAYER2B' }
  | { type: 'RESTORE_STATE'; step: Step; currentPage: number; currentValueIndex: number; detailValueId: string | null }

function reducer(state: StatementsState, action: StatementsAction): StatementsState {
  switch (action.type) {
    case 'SET_REACTION':
      return { ...state, reactions: { ...state.reactions, [action.statementId]: action.reaction } }

    case 'NEXT_PAGE':
      return { ...state, currentPage: state.currentPage + 1 }

    case 'FINISH_REACTIONS':
      return {
        ...state,
        step: 'reflect',
        position: {
          ...state.position,
          overallStance: action.suggestedStanceId ?? undefined,
          takenAt: new Date(),
        },
      }

    case 'CLEAR_REACTION': {
      const { [action.statementId]: _, ...rest } = state.reactions
      return { ...state, reactions: rest }
    }

    case 'GO_TO_LAYER2':
      return { ...state, step: 'layer2', currentValueIndex: 0, revisiting: false }

    case 'CONFIRM_VALUE_STANCE': {
      const stancesPerValue = {
        ...(state.position.stancesPerValue ?? {}),
        [action.valueId]: action.stanceId as ValueStance,
      }
      if (state.revisiting) {
        return { ...state, step: 'reflect', revisiting: false, position: { ...state.position, stancesPerValue } }
      }
      return {
        ...state,
        position: { ...state.position, stancesPerValue },
        currentValueIndex: state.currentValueIndex + 1,
      }
    }

    case 'SKIP_VALUE':
      if (state.revisiting) return { ...state, step: 'reflect', revisiting: false }
      return { ...state, currentValueIndex: state.currentValueIndex + 1 }

    case 'JUMP_TO_VALUE':
      return { ...state, step: 'layer2', currentValueIndex: action.valueIndex, revisiting: true }

    case 'FINISH_LAYER2':
      return { ...state, step: 'reflect' }

    case 'ENTER_LAYER2B': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid]
      let valueDetails = state.position.valueDetails ?? {}
      const layer2StanceId = state.position.stancesPerValue?.[vid]
      if (!existing?.stances.length && layer2StanceId && layer2StanceId !== 'unexplored') {
        valueDetails = {
          ...valueDetails,
          [vid]: { stances: [{ stance: layer2StanceId, weight: 50 }], relationships: [] },
        }
      }
      return { ...state, step: 'layer2b', detailValueId: vid, position: { ...state.position, valueDetails } }
    }

    case 'TOGGLE_VALUE_DETAIL_STANCE': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid] ?? { stances: [], relationships: [] }
      const hasStance = existing.stances.some(e => e.stance === action.stanceId)
      const updatedStances = hasStance
        ? existing.stances.filter(e => e.stance !== action.stanceId)
        : [...existing.stances, { stance: action.stanceId, weight: 50 }]
      const valueDetails = { ...(state.position.valueDetails ?? {}), [vid]: { ...existing, stances: updatedStances } }
      return { ...state, position: { ...state.position, valueDetails } }
    }

    case 'SET_VALUE_DETAIL_WEIGHT': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid] ?? { stances: [], relationships: [] }
      const updatedStances = existing.stances.map(e =>
        e.stance === action.stanceId ? { ...e, weight: action.weight } : e,
      )
      const valueDetails = { ...(state.position.valueDetails ?? {}), [vid]: { ...existing, stances: updatedStances } }
      return { ...state, position: { ...state.position, valueDetails } }
    }

    case 'SET_VALUE_DETAIL_STORY': {
      const vid = action.valueId
      const existing = state.position.valueDetails?.[vid] ?? { stances: [], relationships: [] }
      const updatedStances = existing.stances.map(e =>
        e.stance === action.stanceId ? { ...e, story: action.story } : e,
      )
      const valueDetails = { ...(state.position.valueDetails ?? {}), [vid]: { ...existing, stances: updatedStances } }
      return { ...state, position: { ...state.position, valueDetails } }
    }

    case 'EXIT_LAYER2B':
      return { ...state, step: 'reflect', detailValueId: null }

    case 'RESTORE_STATE':
      return {
        ...state,
        step: action.step,
        currentPage: action.currentPage,
        currentValueIndex: action.currentValueIndex,
        detailValueId: action.detailValueId,
        revisiting: false,
      }

    default:
      return state
  }
}

function initialState(): StatementsState {
  return {
    step: 'reactions',
    reactions: {},
    position: { takenAt: new Date() },
    currentPage: 0,
    currentValueIndex: 0,
    revisiting: false,
    detailValueId: null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQuery(state: StatementsState): Record<string, string> {
  const q: Record<string, string> = { step: state.step }
  if (state.step === 'reactions') q.p = String(state.currentPage)
  if (state.step === 'layer2') q.vi = String(state.currentValueIndex)
  if (state.step === 'layer2b' && state.detailValueId) q.vid = state.detailValueId
  return q
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function StanceChip({ stance }: { stance: StanceContent }) {
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StatementsPage({ stances, values, statements, pages, content }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const reactedValueIds = getReactedValueIds(state.reactions, statements, values)
  const valueSuggestions = computeValueSuggestions(state.reactions, statements)

  // Auto-advance layer2 when all reacted values are done.
  useEffect(() => {
    if (state.step === 'layer2' && !state.revisiting && state.currentValueIndex >= reactedValueIds.length) {
      dispatch({ type: 'FINISH_LAYER2' })
    }
  }, [state.step, state.currentValueIndex, state.revisiting, reactedValueIds.length])

  useStepHistory('/statements', buildQuery(state), q =>
    dispatch({
      type: 'RESTORE_STATE',
      step: (q.step as Step) ?? 'reactions',
      currentPage: parseInt((q.p as string) ?? '0'),
      currentValueIndex: parseInt((q.vi as string) ?? '0'),
      detailValueId: (q.vid as string) || null,
    }),
  )

  return (
    <Container size="3" px="4" py="8">
      {state.step === 'reactions' && (
        <Reactions
          pages={pages}
          currentPage={state.currentPage}
          reactions={state.reactions}
          content={content}
          onSetReaction={(statementId, reaction) =>
            dispatch({ type: 'SET_REACTION', statementId, reaction })
          }
          onNext={() => dispatch({ type: 'NEXT_PAGE' })}
          onFinish={() => {
            const scores = scoreStances(state.reactions, statements)
            dispatch({ type: 'FINISH_REACTIONS', suggestedStanceId: topStance(scores) })
          }}
        />
      )}

      {state.step === 'reflect' && (
        <Reflect
          stances={stances}
          values={values}
          statements={statements}
          position={state.position}
          reactions={state.reactions}
          reactedValueIds={reactedValueIds}
          content={content}
          onSetReaction={(statementId, reaction) =>
            dispatch({ type: 'SET_REACTION', statementId, reaction })
          }
          onClearReaction={statementId =>
            dispatch({ type: 'CLEAR_REACTION', statementId })
          }
          onGoToLayer2={() => dispatch({ type: 'GO_TO_LAYER2' })}
          onJumpToValue={valueIndex => dispatch({ type: 'JUMP_TO_VALUE', valueIndex })}
          onEnterLayer2b={valueId => dispatch({ type: 'ENTER_LAYER2B', valueId })}
        />
      )}

      {state.step === 'layer2' && (() => {
        const valueId = reactedValueIds[state.currentValueIndex]
        if (!valueId) return null
        const value = values.find(v => v.id === valueId)
        if (!value) return null
        const valueStatements = statements.filter(s => s.valueId === valueId)
        return (
          <Layer2
            stances={stances}
            value={value}
            valueStatements={valueStatements}
            reactions={state.reactions}
            suggestedStanceId={valueSuggestions[valueId] ?? null}
            existingStanceId={state.position.stancesPerValue?.[valueId] ?? null}
            content={content}
            currentIndex={state.currentValueIndex}
            totalCount={reactedValueIds.length}
            onSetReaction={(statementId, reaction) =>
              dispatch({ type: 'SET_REACTION', statementId, reaction })
            }
            onConfirm={stanceId => dispatch({ type: 'CONFIRM_VALUE_STANCE', valueId, stanceId })}
            onSkip={() => dispatch({ type: 'SKIP_VALUE' })}
            onFinish={() => dispatch({ type: 'FINISH_LAYER2' })}
          />
        )
      })()}

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
            onToggle={stanceId => dispatch({ type: 'TOGGLE_VALUE_DETAIL_STANCE', valueId: vid, stanceId })}
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
    </Container>
  )
}

// ─── Reactions ────────────────────────────────────────────────────────────────

function Reactions({
  pages,
  currentPage,
  reactions,
  content,
  onSetReaction,
  onNext,
  onFinish,
}: {
  pages: StatementContent[][]
  currentPage: number
  reactions: Record<string, Reaction>
  content: StatementsContent
  onSetReaction: (statementId: string, reaction: Reaction) => void
  onNext: () => void
  onFinish: () => void
}) {
  const page = pages[currentPage]
  const isLastPage = currentPage === pages.length - 1

  return (
    <Flex direction="column" gap="6">
      {/* Intro text — only on the first page */}
      {currentPage === 0 && (
        <Flex direction="column" gap="2">
          <Heading size="6">{content.intro.heading}</Heading>
          <Text size="3" color="gray" style={{ lineHeight: '1.7' }}>
            {content.intro.body}
          </Text>
        </Flex>
      )}

      {/* Page progress bar */}
      <Flex gap="1">
        {pages.map((_, i) => (
          <div
            key={i}
            style={{
              height: 3,
              flex: 1,
              borderRadius: 2,
              background: i <= currentPage ? 'var(--accent-9)' : 'var(--gray-4)',
            }}
          />
        ))}
      </Flex>

      <Text size="2" color="gray">{content.reactions.skipNote}</Text>

      {/* Statements */}
      <Flex direction="column" gap="5" key={currentPage} style={{ animation: 'fadeIn 0.25s ease' }}>
        {page.map(stmt => {
          const current = reactions[stmt.id]
          return (
            <Flex key={stmt.id} direction="column" gap="3">
              <Text size="3" style={{ lineHeight: '1.6' }}>
                &ldquo;{stmt.text}&rdquo;
              </Text>
              <Flex gap="2">
                {(['agree', 'neutral', 'disagree'] as Reaction[]).map(r => {
                  const isSelected = current === r
                  const labels: Record<Reaction, string> = {
                    agree: content.reactions.agreeLabel,
                    neutral: content.reactions.neutralLabel,
                    disagree: content.reactions.disagreeLabel,
                  }
                  return (
                    <button
                      key={r}
                      aria-pressed={isSelected}
                      onClick={() => onSetReaction(stmt.id, r)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        border: isSelected ? '2px solid var(--accent-9)' : '1px solid var(--gray-5)',
                        borderRadius: 'var(--radius-2)',
                        background: isSelected ? 'var(--accent-3)' : 'transparent',
                        color: isSelected ? 'var(--accent-11)' : 'var(--gray-11)',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer',
                      }}
                    >
                      {labels[r]}
                    </button>
                  )
                })}
              </Flex>
            </Flex>
          )
        })}
      </Flex>

      {/* Navigation */}
      <Box>
        <Button size="3" onClick={isLastPage ? onFinish : onNext}>
          {isLastPage ? content.reactions.doneLabel : content.reactions.nextLabel}
        </Button>
      </Box>
    </Flex>
  )
}

// ─── Reflect ─────────────────────────────────────────────────────────────────

function Reflect({
  stances,
  values,
  statements,
  position,
  reactions,
  reactedValueIds,
  content,
  onSetReaction,
  onClearReaction,
  onGoToLayer2,
  onJumpToValue,
  onEnterLayer2b,
}: {
  stances: StanceContent[]
  values: ValueContent[]
  statements: StatementContent[]
  position: Position
  reactions: Record<string, Reaction>
  reactedValueIds: string[]
  content: StatementsContent
  onSetReaction: (statementId: string, reaction: Reaction) => void
  onClearReaction: (statementId: string) => void
  onGoToLayer2: () => void
  onJumpToValue: (valueIndex: number) => void
  onEnterLayer2b: (valueId: string) => void
}) {
  const [tab, setTab] = useState<'stance' | 'value'>('stance')
  const [editingStmt, setEditingStmt] = useState<StatementContent | null>(null)

  const stanceScores = scoreStances(reactions, statements)
  const positiveTotal = stances.reduce((sum, s) => sum + Math.max(0, stanceScores[s.id] ?? 0), 0)

  const spv = position.stancesPerValue ?? {}
  const vd = position.valueDetails ?? {}
  const hasAnyValues = Object.keys(spv).length > 0

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    padding: '8px 0',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--accent-9)' : 'var(--gray-11)',
    borderBottom: active ? '2px solid var(--accent-9)' : '2px solid transparent',
    marginBottom: -1,
  })

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="2">
        <Heading size="5">{content.reflect.heading}</Heading>
        <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>{content.reflect.intro}</Text>
      </Flex>

      {/* Tabs */}
      <Flex direction="column" gap="5">
        <Flex gap="5" style={{ borderBottom: '1px solid var(--gray-5)' }}>
          <button style={tabBtnStyle(tab === 'stance')} onClick={() => setTab('stance')}>
            {content.reflect.tabStanceLabel}
          </button>
          <button style={tabBtnStyle(tab === 'value')} onClick={() => setTab('value')}>
            {content.reflect.tabValueLabel}
          </button>
        </Flex>

        {tab === 'stance' && (
          <Flex direction="column" gap="6">
            {/* Summary bars */}
            {positiveTotal > 0 && (
              <Flex direction="column" gap="3">
                {stances.filter(stance => (stanceScores[stance.id] ?? 0) > 0).map(stance => {
                  const score = stanceScores[stance.id] ?? 0
                  const pct = Math.round((score / positiveTotal) * 100)
                  return (
                    <Flex key={stance.id} align="center" gap="3">
                      <Flex align="center" gap="2" style={{ minWidth: 160 }}>
                        {stance.emoji && <Text style={{ fontSize: 14 }}>{stance.emoji}</Text>}
                        <Text size="2" weight="medium">{stance.name}</Text>
                      </Flex>
                      <div style={{ flex: 1, height: 8, background: 'var(--gray-3)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: stance.color ?? 'var(--accent-9)',
                          borderRadius: 4,
                        }} />
                      </div>
                      <Text size="1" color="gray" style={{ minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {pct}%
                      </Text>
                    </Flex>
                  )
                })}
              </Flex>
            )}

            <Separator size="4" />

            {/* Per-stance detail sections */}
            {stances.map(stance => {
              const stmts = statements.filter(s => s.stanceId === stance.id)
              if (!stmts.length) return null
              return (
                <Flex key={stance.id} direction="column" gap="2">
                  <Flex align="center" gap="2">
                    {stance.emoji && <Text style={{ fontSize: 16 }}>{stance.emoji}</Text>}
                    <Text size="3" weight="medium">{stance.name}</Text>
                  </Flex>
                  <StatementsGrid
                    statements={stmts}
                    stances={stances}
                    values={values}
                    reactions={reactions}
                    omitColumn="stance"
                    editLabel={content.reflect.editReactionLabel}
                    onEdit={setEditingStmt}
                  />
                </Flex>
              )
            })}
          </Flex>
        )}

        {tab === 'value' && (
          <Flex direction="column" gap="6">
            {values.map(value => {
              const stmts = statements.filter(s => s.valueId === value.id)
              if (!stmts.length) return null
              return (
                <Flex key={value.id} direction="column" gap="2">
                  <Text size="3" weight="medium">{value.name}</Text>
                  <StatementsGrid
                    statements={stmts}
                    stances={stances}
                    values={values}
                    reactions={reactions}
                    omitColumn="value"
                    editLabel={content.reflect.editReactionLabel}
                    onEdit={setEditingStmt}
                  />
                </Flex>
              )
            })}
          </Flex>
        )}
      </Flex>

      {/* Layer 2 CTA */}
      {hasAnyValues ? (
        <Flex direction="column" gap="4">
          <Flex direction="column">
            {reactedValueIds.map((vid, i) => {
              const v = values.find(v => v.id === vid)
              if (!v) return null
              const stanceId = spv[vid]
              const stance = stanceId && stanceId !== 'unexplored'
                ? stances.find(s => s.id === stanceId)
                : undefined
              const detail = vd[vid]
              const detailStances = detail?.stances ?? []
              const hasDetail = detailStances.length > 0

              if (hasDetail) {
                const totalWeight = detailStances.reduce((sum, e) => sum + e.weight, 0) || 1
                const hasStories = detailStances.some(e => e.story)
                return (
                  <Flex
                    key={vid}
                    direction="column"
                    gap="2"
                    style={{ borderBottom: '1px solid var(--gray-4)', padding: '10px 0' }}
                  >
                    <Flex justify="between" align="center">
                      <button
                        onClick={() => onJumpToValue(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                      >
                        <Text size="2" weight="medium">{v.name}</Text>
                      </button>
                      <button
                        onClick={() => onEnterLayer2b(vid)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-9)', fontSize: 12, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}
                      >
                        Edit detail
                      </button>
                    </Flex>
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
                                borderRadius: isFirst && isLast ? 4 : isFirst ? '4px 0 0 4px' : isLast ? '0 4px 4px 0' : 0,
                              }}
                            />
                            <div style={{ paddingTop: 6, overflow: 'visible', whiteSpace: 'nowrap' }}>
                              <StanceChip stance={s!} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {hasStories && (
                      <Flex direction="column" gap="1">
                        {detailStances.filter(e => e.story).map(e => {
                          const s = stances.find(st => st.id === e.stance)
                          return (
                            <Text key={e.stance} size="1" color="gray" style={{ lineHeight: '1.5', fontStyle: 'italic' }}>
                              {s?.emoji} {s?.name}: &ldquo;{e.story}&rdquo;
                            </Text>
                          )
                        })}
                      </Flex>
                    )}
                  </Flex>
                )
              }

              return (
                <Flex key={vid} align="center" style={{ borderBottom: '1px solid var(--gray-4)' }}>
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
                    <Text size="2" weight="medium" style={{ flex: 1 }}>{v.name}</Text>
                    {stance ? (
                      <StanceChip stance={stance} />
                    ) : (
                      <Text size="2" color="gray">{content.reflect.unexploredLabel}</Text>
                    )}
                  </button>
                  {stance && (
                    <button
                      onClick={() => onEnterLayer2b(vid)}
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
          <Button size="2" variant="ghost" color="gray" onClick={onGoToLayer2}>
            {content.reflect.revisitLayer2Cta}
          </Button>
        </Flex>
      ) : (
        reactedValueIds.length > 0 && (
          <Button size="3" onClick={onGoToLayer2}>
            {content.reflect.layer2Cta}
          </Button>
        )
      )}

      {/* Edit reaction modal */}
      <Dialog.Root
        open={editingStmt !== null}
        onOpenChange={open => { if (!open) setEditingStmt(null) }}
      >
        <Dialog.Content maxWidth="480px">
          {editingStmt && (() => {
            const stance = stances.find(s => s.id === editingStmt.stanceId)
            const value = values.find(v => v.id === editingStmt.valueId)
            const r = reactions[editingStmt.id]
            return (
              <>
                <Dialog.Title>{content.reflect.editReactionLabel}</Dialog.Title>
                <Flex direction="column" gap="4" mt="2">
                  <Text
                    size="2"
                    style={{ lineHeight: '1.6', fontStyle: 'italic', borderLeft: '2px solid var(--gray-4)', paddingLeft: 12 }}
                  >
                    &ldquo;{editingStmt.text}&rdquo;
                  </Text>
                  <Flex align="center" gap="2" wrap="wrap">
                    {stance && <StanceChip stance={stance} />}
                    {value && <Text size="2" color="gray">{value.name}</Text>}
                  </Flex>
                  <Flex gap="2" wrap="wrap">
                    {(['agree', 'neutral', 'disagree'] as Reaction[]).map(reaction => (
                      <Button
                        key={reaction}
                        size="2"
                        variant={r === reaction ? 'solid' : 'outline'}
                        onClick={() => onSetReaction(editingStmt.id, reaction)}
                        style={{ flex: 1 }}
                      >
                        {reaction.charAt(0).toUpperCase() + reaction.slice(1)}
                      </Button>
                    ))}
                    <Button
                      size="2"
                      variant={!r ? 'solid' : 'outline'}
                      color="gray"
                      onClick={() => onClearReaction(editingStmt.id)}
                      style={{ flex: 1 }}
                    >
                      {content.reflect.noAnswerLabel}
                    </Button>
                  </Flex>
                  <Flex justify="end">
                    <Dialog.Close>
                      <Button variant="ghost" color="gray">Done</Button>
                    </Dialog.Close>
                  </Flex>
                </Flex>
              </>
            )
          })()}
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  )
}

// ─── Statements grid ──────────────────────────────────────────────────────────

function StatementsGrid({
  statements,
  stances,
  values,
  reactions,
  omitColumn,
  editLabel,
  onEdit,
}: {
  statements: StatementContent[]
  stances: StanceContent[]
  values: ValueContent[]
  reactions: Record<string, Reaction>
  omitColumn: 'stance' | 'value'
  editLabel: string
  onEdit: (stmt: StatementContent) => void
}) {
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '4px 8px 4px 0',
    fontWeight: 500,
    color: 'var(--gray-11)',
    fontSize: 11,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--gray-5)',
  }
  const td: React.CSSProperties = {
    padding: '6px 8px 6px 0',
    verticalAlign: 'top',
    borderBottom: '1px solid var(--gray-3)',
    fontSize: 13,
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Statement</th>
            {omitColumn === 'stance' && <th style={{ ...th, paddingLeft: 8 }}>Value</th>}
            {omitColumn === 'value' && <th style={{ ...th, paddingLeft: 8 }}>Stance</th>}
            <th style={{ ...th, paddingLeft: 8 }}>Response</th>
            <th style={{ ...th, paddingLeft: 8, width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {statements.map(stmt => {
            const stance = stances.find(s => s.id === stmt.stanceId)
            const value = values.find(v => v.id === stmt.valueId)
            const r = reactions[stmt.id]
            return (
              <tr key={stmt.id}>
                <td style={{ ...td, lineHeight: '1.4', color: 'var(--gray-12)' }}>
                  {stmt.text}
                </td>
                {omitColumn === 'stance' && (
                  <td style={{ ...td, paddingLeft: 8, whiteSpace: 'nowrap', color: 'var(--gray-11)' }}>
                    {value?.name ?? '—'}
                  </td>
                )}
                {omitColumn === 'value' && (
                  <td style={{ ...td, paddingLeft: 8, whiteSpace: 'nowrap' }}>
                    {stance && <StanceChip stance={stance} />}
                  </td>
                )}
                <td style={{
                  ...td,
                  paddingLeft: 8,
                  whiteSpace: 'nowrap',
                  color: r === 'agree' ? 'var(--green-9)' : r === 'disagree' ? 'var(--red-9)' : 'var(--gray-8)',
                  fontWeight: r && r !== 'neutral' ? 500 : 400,
                }}>
                  {r === 'agree' ? 'Agree' : r === 'disagree' ? 'Disagree' : r === 'neutral' ? 'Neutral' : '—'}
                </td>
                <td style={{ ...td, paddingLeft: 8, whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => onEdit(stmt)}
                    aria-label={`${editLabel}: ${stmt.text}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--gray-9)',
                      fontSize: 13,
                      padding: '1px 4px',
                      lineHeight: 1,
                    }}
                  >
                    <Pencil2Icon />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Layer 2 ──────────────────────────────────────────────────────────────────

function Layer2({
  stances,
  value,
  valueStatements,
  reactions,
  suggestedStanceId,
  existingStanceId,
  content,
  currentIndex,
  totalCount,
  onSetReaction,
  onConfirm,
  onSkip,
  onFinish,
}: {
  stances: StanceContent[]
  value: ValueContent
  valueStatements: StatementContent[]
  reactions: Record<string, Reaction>
  suggestedStanceId: string | null
  existingStanceId: string | null
  content: StatementsContent
  currentIndex: number
  totalCount: number
  onSetReaction: (statementId: string, reaction: Reaction) => void
  onConfirm: (stanceId: string) => void
  onSkip: () => void
  onFinish: () => void
}) {
  const suggestedStance = stances.find(s => s.id === suggestedStanceId)

  // 'confirm': show the suggestion card + three equal buttons.
  // 'react': show the value's statements so the user can react / adjust.
  const [mode, setMode] = useState<'confirm' | 'react'>(suggestedStance ? 'confirm' : 'react')
  const [reactedOnce, setReactedOnce] = useState(false) // tracks if "Change" was the entry

  // Reset mode when the value changes.
  useEffect(() => {
    setMode(suggestedStance ? 'confirm' : 'react')
    setReactedOnce(false)
  }, [value.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReaction(statementId: string, reaction: Reaction) {
    onSetReaction(statementId, reaction)
    setReactedOnce(true)
  }

  // Suggestion may update as user reacts in 'react' mode (derived from parent).
  const currentSuggestedStance = stances.find(s => s.id === suggestedStanceId)

  return (
    <Flex direction="column" gap="6">
      {/* Progress + done */}
      <Flex justify="between" align="center">
        <Text size="2" color="gray">
          {currentIndex + 1} / {totalCount}
        </Text>
        <Button size="2" variant="ghost" onClick={onFinish}>
          {content.layer2.doneLabel}
        </Button>
      </Flex>

      {/* Value */}
      <div key={value.id} style={{ animation: 'fadeIn 0.25s ease' }}>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="1">
            <Heading size="5">{value.name}</Heading>
            <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
              {value.description}
            </Text>
          </Flex>

          {mode === 'confirm' && suggestedStance && (
            <>
              <Text size="2" color="gray">{content.layer2.suggestedLabel}</Text>

              {/* Bordered stance card */}
              <div
                style={{
                  border: `1.5px solid ${suggestedStance.color ?? 'var(--gray-6)'}`,
                  borderRadius: 'var(--radius-3)',
                  padding: 'var(--space-3)',
                  background: suggestedStance.color
                    ? hexToRgba(suggestedStance.color, 0.06)
                    : 'var(--gray-1)',
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  {suggestedStance.emoji && <Text style={{ fontSize: 18 }}>{suggestedStance.emoji}</Text>}
                  <Text weight="medium">{suggestedStance.name}</Text>
                </Flex>
                <Text size="2" color="gray" style={{ lineHeight: '1.5' }}>
                  {suggestedStance.short}
                </Text>
              </div>

              {/* Three equal-weight options */}
              <Flex gap="2">
                <Button
                  size="2"
                  variant="outline"
                  onClick={() => onConfirm(suggestedStanceId!)}
                  style={{ flex: 1 }}
                >
                  {content.layer2.looksRightLabel}
                </Button>
                <Button
                  size="2"
                  variant="outline"
                  onClick={() => { setReactedOnce(true); setMode('react') }}
                  style={{ flex: 1 }}
                >
                  {content.layer2.changeLabel}
                </Button>
                <Button
                  size="2"
                  variant="outline"
                  color="gray"
                  onClick={onSkip}
                  style={{ flex: 1 }}
                >
                  {content.layer2.skipLabel}
                </Button>
              </Flex>
            </>
          )}

          {mode === 'react' && (
            <>
              <Text size="2" color="gray">
                {reactedOnce
                  ? content.layer2.reactModeChangeIntro
                  : content.layer2.reactModeIntro}
              </Text>

              {/* Value's statements with reaction buttons */}
              <Flex direction="column" gap="4">
                {valueStatements.map(stmt => {
                  const current = reactions[stmt.id]
                  return (
                    <Flex key={stmt.id} direction="column" gap="3">
                      <Text size="2" style={{ lineHeight: '1.6' }}>
                        &ldquo;{stmt.text}&rdquo;
                      </Text>
                      <Flex gap="2">
                        {(['agree', 'neutral', 'disagree'] as Reaction[]).map(r => {
                          const isSelected = current === r
                          const labels: Record<Reaction, string> = {
                            agree: 'Agree',
                            neutral: 'Neutral',
                            disagree: 'Disagree',
                          }
                          return (
                            <button
                              key={r}
                              aria-pressed={isSelected}
                              onClick={() => handleReaction(stmt.id, r)}
                              style={{
                                flex: 1,
                                padding: '8px 4px',
                                border: isSelected ? '2px solid var(--accent-9)' : '1px solid var(--gray-5)',
                                borderRadius: 'var(--radius-2)',
                                background: isSelected ? 'var(--accent-3)' : 'transparent',
                                color: isSelected ? 'var(--accent-11)' : 'var(--gray-11)',
                                fontSize: 13,
                                fontWeight: isSelected ? 600 : 400,
                                cursor: 'pointer',
                              }}
                            >
                              {labels[r]}
                            </button>
                          )
                        })}
                      </Flex>
                    </Flex>
                  )
                })}
              </Flex>

              {/* Live suggestion after reacting */}
              {currentSuggestedStance && (
                <Flex direction="column" gap="2">
                  <Text size="2" color="gray">{content.layer2.reactModeSuggestion}</Text>
                  <div
                    style={{
                      border: `1.5px solid ${currentSuggestedStance.color ?? 'var(--gray-6)'}`,
                      borderRadius: 'var(--radius-3)',
                      padding: 'var(--space-3)',
                      background: currentSuggestedStance.color
                        ? hexToRgba(currentSuggestedStance.color, 0.06)
                        : 'var(--gray-1)',
                    }}
                  >
                    <Flex align="center" gap="2" mb="1">
                      {currentSuggestedStance.emoji && <Text style={{ fontSize: 18 }}>{currentSuggestedStance.emoji}</Text>}
                      <Text weight="medium">{currentSuggestedStance.name}</Text>
                    </Flex>
                    <Text size="2" color="gray" style={{ lineHeight: '1.5' }}>
                      {currentSuggestedStance.short}
                    </Text>
                  </div>
                  <Button size="2" variant="outline" onClick={() => onConfirm(suggestedStanceId!)}>
                    {content.layer2.reactModeConfirmLabel}
                  </Button>
                </Flex>
              )}

              <Button size="2" variant="outline" color="gray" onClick={onSkip} style={{ justifyContent: 'flex-start' }}>
                {content.layer2.skipLabel}
              </Button>
            </>
          )}
        </Flex>
      </div>
    </Flex>
  )
}

// ─── Layer 2b ─────────────────────────────────────────────────────────────────

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
  content: StatementsContent
  onToggle: (stanceId: string) => void
  onSetWeight: (stanceId: string, weight: number) => void
  onSetStory: (stanceId: string, story: string) => void
  onDone: () => void
}) {
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {}
    for (const e of existing?.stances ?? []) w[e.stance] = e.weight
    return w
  })

  useEffect(() => {
    setWeights(prev => {
      const next = { ...prev }
      let changed = false
      for (const e of existing?.stances ?? []) {
        if (!(e.stance in next)) { next[e.stance] = e.weight; changed = true }
      }
      return changed ? next : prev
    })
  }, [existing])

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

  return (
    <>
      <Flex direction="column" gap="6">
        <Flex direction="column" gap="1">
          <Text size="2" color="gray">{content.layer2b.heading}</Text>
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
                <button
                  onClick={() => onToggle(stance.id)}
                  aria-pressed={isOn}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: isOn ? `2px solid ${color}` : '1px solid var(--gray-4)',
                    borderRadius: 'var(--radius-3)',
                    background: isOn ? hexToRgba(color, 0.1) : 'transparent',
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
                    {isOn && <Text style={{ color, fontSize: 16, flexShrink: 0, marginLeft: 8 }}>✓</Text>}
                  </Flex>
                </button>

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
                        onValueChange={([val]) => setWeights(w => ({ ...w, [stance.id]: val }))}
                        onValueCommit={([val]) => onSetWeight(stance.id, val)}
                      />
                      <Text size="1" color="gray" style={{ flexShrink: 0, minWidth: 24, textAlign: 'right' }}>
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
                        {hasNotes ? content.layer2b.editNotesLabel : content.layer2b.clarifyLabel}
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

      <Dialog.Root
        open={clarifyingId !== null}
        onOpenChange={open => { if (!open) { setClarifyingId(null); setModalStory('') } }}
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
              <Dialog.Description size="2" color="gray" mb="4">{value.name}</Dialog.Description>
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
              background: clarifyingStance?.color ? hexToRgba(clarifyingStance.color, 0.04) : 'var(--gray-1)',
              color: 'var(--gray-12)',
              boxSizing: 'border-box',
            }}
          />
          <Flex gap="3" mt="4" justify="end">
            <Dialog.Close>
              <Button variant="ghost" color="gray">{content.layer2b.modalCancelLabel}</Button>
            </Dialog.Close>
            <Button onClick={saveModal}>{content.layer2b.modalSaveLabel}</Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

// ─── Data loading ─────────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<Props> = async () => {
  const stances = loadStances()
  const values = loadValues()
  const statements = loadStatements()
  const content = loadConceptContent<StatementsContent>('statements')

  const pageMap: Record<number, StatementContent[]> = {}
  for (const stmt of statements) {
    if (!pageMap[stmt.page]) pageMap[stmt.page] = []
    pageMap[stmt.page].push(stmt)
  }
  const pageNums = Object.keys(pageMap).map(Number).sort((a, b) => a - b)
  const pages = pageNums.map(n => pageMap[n])

  return { props: { stances, values, statements, pages, content } }
}
