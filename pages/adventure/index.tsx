import React, { useReducer, useState, useEffect } from 'react'
import type { GetStaticProps } from 'next'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes'
import { loadStances, loadValues, loadScenarios, loadConceptContent } from '@/lib/content'
import { useStepHistory } from '@/lib/useStepHistory'
import type {
  StanceContent,
  ValueContent,
  ScenarioContent,
  Position,
  ValueStance,
} from '@/lib/types'

// ─── Content type ─────────────────────────────────────────────────────────────

interface HotTakeOption {
  id: string
  text: string
  stanceId: string
}

interface AdventureContent {
  specialists: string[]
  intro: { heading: string; body: string }
  checkin: {
    heading: string
    hottake: { question: string; options: HotTakeOption[] }
    scenarios: { progressLabel: string; chooseLabel: string; nextLabel: string; doneLabel: string }
    reflect: { heading: string; intro: string; ctaLabel: string; overallLabel: string }
  }
  examroom: {
    heading: string
    unexploredLabel: string
    overallLabel: string
    suggestionLabel: string
    surpriseIntro: string
  }
  specialist: {
    backLabel: string
    progressLabel: string
    chooseLabel: string
    nextLabel: string
    finishLabel: string
    reflect: {
      heading: string
      suggestedLabel: string
      looksRightLabel: string
      changeLabel: string
      skipLabel: string
      changeHeading: string
    }
  }
}

// ─── Page props ───────────────────────────────────────────────────────────────

interface Props {
  stances: StanceContent[]
  values: ValueContent[]
  scenarios: ScenarioContent[]
  content: AdventureContent
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

// Return the stanceId with the most choices in a set of scenarios.
// Tie-break: first scenario with a choice wins.
function topStanceFromChoices(
  choices: Record<string, string>,
  scenarios: ScenarioContent[],
): string | null {
  const counts: Record<string, number> = {}
  let firstStance: string | null = null
  for (const sc of scenarios) {
    const choiceId = choices[sc.id]
    if (!choiceId) continue
    const choice = sc.choices.find(c => c.id === choiceId)
    if (!choice) continue
    if (firstStance === null) firstStance = choice.stanceId
    counts[choice.stanceId] = (counts[choice.stanceId] ?? 0) + 1
  }
  let bestId: string | null = null
  let bestCount = 0
  for (const [id, count] of Object.entries(counts)) {
    if (count > bestCount) { bestId = id; bestCount = count }
  }
  return bestId ?? firstStance
}

// Hot-take contributes 2 points; each check-in scenario choice contributes 1.
function computeOverallStance(
  hotTakeStanceId: string | null,
  choices: Record<string, string>,
  checkinScenarios: ScenarioContent[],
): string | null {
  const counts: Record<string, number> = {}
  if (hotTakeStanceId) counts[hotTakeStanceId] = 2
  for (const sc of checkinScenarios) {
    const choiceId = choices[sc.id]
    if (!choiceId) continue
    const choice = sc.choices.find(c => c.id === choiceId)
    if (!choice) continue
    counts[choice.stanceId] = (counts[choice.stanceId] ?? 0) + 1
  }
  let bestId: string | null = hotTakeStanceId
  let bestCount = hotTakeStanceId ? (counts[hotTakeStanceId] ?? 0) : 0
  for (const [id, count] of Object.entries(counts)) {
    if (count > bestCount) { bestId = id; bestCount = count }
  }
  return bestId
}

// ─── State ────────────────────────────────────────────────────────────────────

type Step = 'checkin' | 'examroom' | 'specialist'
type CheckinPhase = 'hottake' | 'scenarios' | 'reflect'

interface AdventureState {
  step: Step
  checkinPhase: CheckinPhase
  checkinScenarioIndex: number
  hotTakeStanceId: string | null
  choices: Record<string, string>  // scenarioId → choiceId
  currentSpecialistValueId: string | null
  specialistScenarioIndex: number
  specialistReflecting: boolean
  position: Position
}

type AdventureAction =
  | { type: 'SELECT_HOT_TAKE'; stanceId: string }
  | { type: 'SET_CHOICE'; scenarioId: string; choiceId: string }
  | { type: 'NEXT_CHECKIN_SCENARIO' }
  | { type: 'FINISH_CHECKIN_SCENARIOS' }
  | { type: 'CONFIRM_CHECKIN'; overallStanceId: string | null }
  | { type: 'ENTER_SPECIALIST'; valueId: string }
  | { type: 'NEXT_SPECIALIST_SCENARIO' }
  | { type: 'FINISH_SPECIALIST_SCENARIOS' }
  | { type: 'CONFIRM_VALUE_STANCE'; valueId: string; stanceId: string }
  | { type: 'SKIP_SPECIALIST' }
  | { type: 'GO_TO_EXAMROOM' }
  | {
      type: 'RESTORE_STATE'
      step: Step
      checkinPhase: CheckinPhase
      checkinScenarioIndex: number
      currentSpecialistValueId: string | null
      specialistScenarioIndex: number
      specialistReflecting: boolean
    }

function reducer(state: AdventureState, action: AdventureAction): AdventureState {
  switch (action.type) {
    case 'SELECT_HOT_TAKE':
      return {
        ...state,
        hotTakeStanceId: action.stanceId,
        checkinPhase: 'scenarios',
        checkinScenarioIndex: 0,
      }

    case 'SET_CHOICE':
      return { ...state, choices: { ...state.choices, [action.scenarioId]: action.choiceId } }

    case 'NEXT_CHECKIN_SCENARIO':
      return { ...state, checkinScenarioIndex: state.checkinScenarioIndex + 1 }

    case 'FINISH_CHECKIN_SCENARIOS':
      return { ...state, checkinPhase: 'reflect' }

    case 'CONFIRM_CHECKIN':
      return {
        ...state,
        step: 'examroom',
        position: {
          ...state.position,
          overallStance: action.overallStanceId ?? undefined,
          takenAt: new Date(),
        },
      }

    case 'ENTER_SPECIALIST':
      return {
        ...state,
        step: 'specialist',
        currentSpecialistValueId: action.valueId,
        specialistScenarioIndex: 0,
        specialistReflecting: false,
      }

    case 'NEXT_SPECIALIST_SCENARIO':
      return { ...state, specialistScenarioIndex: state.specialistScenarioIndex + 1 }

    case 'FINISH_SPECIALIST_SCENARIOS':
      return { ...state, specialistReflecting: true }

    case 'CONFIRM_VALUE_STANCE': {
      const stancesPerValue = {
        ...(state.position.stancesPerValue ?? {}),
        [action.valueId]: action.stanceId as ValueStance,
      }
      return {
        ...state,
        step: 'examroom',
        currentSpecialistValueId: null,
        specialistReflecting: false,
        position: { ...state.position, stancesPerValue },
      }
    }

    case 'SKIP_SPECIALIST':
      return { ...state, step: 'examroom', currentSpecialistValueId: null, specialistReflecting: false }

    case 'GO_TO_EXAMROOM':
      return { ...state, step: 'examroom', currentSpecialistValueId: null, specialistReflecting: false }

    case 'RESTORE_STATE':
      return {
        ...state,
        step: action.step,
        checkinPhase: action.checkinPhase,
        checkinScenarioIndex: action.checkinScenarioIndex,
        currentSpecialistValueId: action.currentSpecialistValueId,
        specialistScenarioIndex: action.specialistScenarioIndex,
        specialistReflecting: action.specialistReflecting,
      }

    default:
      return state
  }
}

function initialState(): AdventureState {
  return {
    step: 'checkin',
    checkinPhase: 'hottake',
    checkinScenarioIndex: 0,
    hotTakeStanceId: null,
    choices: {},
    currentSpecialistValueId: null,
    specialistScenarioIndex: 0,
    specialistReflecting: false,
    position: { takenAt: new Date() },
  }
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

function buildQuery(state: AdventureState): Record<string, string> {
  const q: Record<string, string> = { step: state.step }
  if (state.step === 'checkin') {
    q.cp = state.checkinPhase
    if (state.checkinPhase === 'scenarios') q.csi = String(state.checkinScenarioIndex)
  }
  if (state.step === 'specialist' && state.currentSpecialistValueId) {
    q.sv = state.currentSpecialistValueId
    if (state.specialistReflecting) q.sr = '1'
    else q.ssi = String(state.specialistScenarioIndex)
  }
  return q
}

function fmt(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total))
}

// ─── Utility components ───────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex
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

function StanceCard({ stance }: { stance: StanceContent }) {
  const color = stance.color ?? 'var(--gray-6)'
  return (
    <div
      style={{
        border: `1.5px solid ${color}`,
        borderRadius: 'var(--radius-3)',
        padding: 'var(--space-3)',
        background: stance.color ? hexToRgba(stance.color, 0.06) : 'var(--gray-1)',
      }}
    >
      <Flex align="center" gap="2" mb="1">
        {stance.emoji && <Text style={{ fontSize: 18 }}>{stance.emoji}</Text>}
        <Text weight="medium">{stance.name}</Text>
      </Flex>
      <Text size="2" color="gray" style={{ lineHeight: '1.5' }}>
        {stance.short}
      </Text>
    </div>
  )
}

const choiceButtonStyle = (selected: boolean): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '12px 16px',
  border: selected ? '2px solid var(--accent-9)' : '1px solid var(--gray-5)',
  borderRadius: 'var(--radius-3)',
  background: selected ? 'var(--accent-3)' : 'transparent',
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: '1.5',
  color: selected ? 'var(--accent-11)' : 'var(--gray-12)',
  fontWeight: selected ? 500 : 400,
})

const backLinkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--gray-11)',
  fontSize: 13,
  padding: 0,
  fontFamily: 'inherit',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdventurePage({ stances, values, scenarios, content }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  const checkinScenarios = scenarios.filter(sc => !sc.valueId)

  // Derive overall stance from choices even before CONFIRM_CHECKIN stamps it.
  const derivedOverallStanceId =
    state.position.overallStance ??
    computeOverallStance(state.hotTakeStanceId, state.choices, checkinScenarios)

  useStepHistory('/adventure', buildQuery(state), q =>
    dispatch({
      type: 'RESTORE_STATE',
      step: (q.step as Step) ?? 'checkin',
      checkinPhase: (q.cp as CheckinPhase) ?? 'hottake',
      checkinScenarioIndex: parseInt((q.csi as string) ?? '0'),
      currentSpecialistValueId: (q.sv as string) || null,
      specialistScenarioIndex: parseInt((q.ssi as string) ?? '0'),
      specialistReflecting: q.sr === '1',
    }),
  )

  return (
    <Container size="3" px="4" py="8">
      {state.step === 'checkin' && (
        <CheckIn
          stances={stances}
          scenarios={checkinScenarios}
          content={content}
          hotTakeStanceId={state.hotTakeStanceId}
          phase={state.checkinPhase}
          scenarioIndex={state.checkinScenarioIndex}
          choices={state.choices}
          overallStanceId={derivedOverallStanceId}
          onSelectHotTake={stanceId => dispatch({ type: 'SELECT_HOT_TAKE', stanceId })}
          onSetChoice={(scenarioId, choiceId) => dispatch({ type: 'SET_CHOICE', scenarioId, choiceId })}
          onNextScenario={() => dispatch({ type: 'NEXT_CHECKIN_SCENARIO' })}
          onFinishScenarios={() => dispatch({ type: 'FINISH_CHECKIN_SCENARIOS' })}
          onConfirm={() => dispatch({ type: 'CONFIRM_CHECKIN', overallStanceId: derivedOverallStanceId })}
        />
      )}

      {state.step === 'examroom' && (
        <ExamRoom
          stances={stances}
          values={values}
          specialistValueIds={content.specialists}
          position={state.position}
          content={content}
          onEnterSpecialist={valueId => dispatch({ type: 'ENTER_SPECIALIST', valueId })}
        />
      )}

      {state.step === 'specialist' && (() => {
        const vid = state.currentSpecialistValueId
        if (!vid) return null
        const value = values.find(v => v.id === vid)
        if (!value) return null
        const specialistScenarios = scenarios.filter(sc => sc.valueId === vid)
        return (
          <Specialist
            stances={stances}
            value={value}
            scenarios={specialistScenarios}
            choices={state.choices}
            scenarioIndex={state.specialistScenarioIndex}
            reflecting={state.specialistReflecting}
            content={content}
            onSetChoice={(scenarioId, choiceId) => dispatch({ type: 'SET_CHOICE', scenarioId, choiceId })}
            onNextScenario={() => dispatch({ type: 'NEXT_SPECIALIST_SCENARIO' })}
            onFinishScenarios={() => dispatch({ type: 'FINISH_SPECIALIST_SCENARIOS' })}
            onConfirm={stanceId => dispatch({ type: 'CONFIRM_VALUE_STANCE', valueId: vid, stanceId })}
            onSkip={() => dispatch({ type: 'SKIP_SPECIALIST' })}
            onBack={() => dispatch({ type: 'GO_TO_EXAMROOM' })}
          />
        )
      })()}
    </Container>
  )
}

// ─── CheckIn ──────────────────────────────────────────────────────────────────

function CheckIn({
  stances,
  scenarios,
  content,
  hotTakeStanceId,
  phase,
  scenarioIndex,
  choices,
  overallStanceId,
  onSelectHotTake,
  onSetChoice,
  onNextScenario,
  onFinishScenarios,
  onConfirm,
}: {
  stances: StanceContent[]
  scenarios: ScenarioContent[]
  content: AdventureContent
  hotTakeStanceId: string | null
  phase: CheckinPhase
  scenarioIndex: number
  choices: Record<string, string>
  overallStanceId: string | null
  onSelectHotTake: (stanceId: string) => void
  onSetChoice: (scenarioId: string, choiceId: string) => void
  onNextScenario: () => void
  onFinishScenarios: () => void
  onConfirm: () => void
}) {
  // ── Hot-take ──
  if (phase === 'hottake') {
    return (
      <Flex direction="column" gap="6">
        <Flex direction="column" gap="2">
          <Heading size="6">{content.intro.heading}</Heading>
          <Text size="3" color="gray" style={{ lineHeight: '1.7' }}>
            {content.intro.body}
          </Text>
        </Flex>
        <Flex direction="column" gap="3">
          <Text size="2" weight="medium" style={{ lineHeight: '1.5' }}>
            {content.checkin.hottake.question}
          </Text>
          <Flex direction="column" gap="2">
            {content.checkin.hottake.options.map(opt => (
              <button
                key={opt.id}
                onClick={() => onSelectHotTake(opt.stanceId)}
                style={choiceButtonStyle(hotTakeStanceId === opt.stanceId)}
                aria-pressed={hotTakeStanceId === opt.stanceId}
              >
                {opt.text}
              </button>
            ))}
          </Flex>
        </Flex>
      </Flex>
    )
  }

  // ── Scenarios ──
  if (phase === 'scenarios' && scenarios.length > 0) {
    const scenario = scenarios[scenarioIndex]
    if (!scenario) return null
    const isLast = scenarioIndex === scenarios.length - 1
    const currentChoiceId = choices[scenario.id]

    return (
      <Flex direction="column" gap="6">
        <Text size="2" color="gray">
          {fmt(content.checkin.scenarios.progressLabel, scenarioIndex + 1, scenarios.length)}
        </Text>

        <Flex direction="column" gap="4" key={scenario.id} style={{ animation: 'fadeIn 0.25s ease' }}>
          <Text size="3" style={{ lineHeight: '1.7' }}>
            {scenario.situation}
          </Text>
          <Text size="2" weight="medium" color="gray">
            {content.checkin.scenarios.chooseLabel}
          </Text>
          <Flex direction="column" gap="2">
            {scenario.choices.map(choice => (
              <button
                key={choice.id}
                aria-pressed={currentChoiceId === choice.id}
                onClick={() => onSetChoice(scenario.id, choice.id)}
                style={choiceButtonStyle(currentChoiceId === choice.id)}
              >
                {choice.text}
              </button>
            ))}
          </Flex>
        </Flex>

        <Box>
          <Button
            size="3"
            disabled={!currentChoiceId}
            onClick={isLast ? onFinishScenarios : onNextScenario}
          >
            {isLast ? content.checkin.scenarios.doneLabel : content.checkin.scenarios.nextLabel}
          </Button>
        </Box>
      </Flex>
    )
  }

  // ── Reflect ──
  const overallStance = stances.find(s => s.id === overallStanceId)

  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="2">
        <Heading size="6">{content.checkin.reflect.heading}</Heading>
        <Text size="3" color="gray" style={{ lineHeight: '1.7' }}>
          {content.checkin.reflect.intro}
        </Text>
      </Flex>

      <Flex direction="column" gap="2">
        <Text size="2" color="gray">{content.checkin.reflect.overallLabel}</Text>
        {overallStance ? (
          <StanceCard stance={overallStance} />
        ) : (
          <Text size="2" color="gray">No clear stance from your choices yet.</Text>
        )}
      </Flex>

      <Box>
        <Button size="3" onClick={onConfirm}>
          {content.checkin.reflect.ctaLabel}
        </Button>
      </Box>
    </Flex>
  )
}

// ─── ExamRoom ─────────────────────────────────────────────────────────────────

function ExamRoom({
  stances,
  values,
  specialistValueIds,
  position,
  content,
  onEnterSpecialist,
}: {
  stances: StanceContent[]
  values: ValueContent[]
  specialistValueIds: string[]
  position: Position
  content: AdventureContent
  onEnterSpecialist: (valueId: string) => void
}) {
  const spv = position.stancesPerValue ?? {}
  const overallStance = stances.find(s => s.id === position.overallStance)

  const specialists = specialistValueIds
    .map(id => values.find(v => v.id === id))
    .filter((v): v is ValueContent => !!v)

  // First unvisited specialist (for "Start here" suggestion).
  const firstUnvisited = specialists.find(v => !spv[v.id])

  // Surprise: find a specialist whose stance diverges from the overall stance.
  const surpriseValue = position.overallStance
    ? specialists.find(v => {
        const s = spv[v.id]
        return s && s !== 'unexplored' && s !== position.overallStance
      })
    : null
  const surpriseStance = surpriseValue ? stances.find(s => s.id === spv[surpriseValue.id]) : null

  return (
    <Flex direction="column" gap="6">
      <Heading size="6">{content.examroom.heading}</Heading>

      {/* Overall stance chip */}
      {overallStance && (
        <Flex align="center" gap="3">
          <Text size="2" color="gray" style={{ flexShrink: 0 }}>
            {content.examroom.overallLabel}
          </Text>
          <StanceChip stance={overallStance} />
        </Flex>
      )}

      {/* Surprise callout */}
      {surpriseValue && surpriseStance && overallStance && (
        <div
          style={{
            background: 'var(--amber-2)',
            border: '1px solid var(--amber-5)',
            borderRadius: 'var(--radius-3)',
            padding: '12px 14px',
          }}
        >
          <Text size="2" weight="medium" style={{ display: 'block', marginBottom: 4 }}>
            {content.examroom.surpriseIntro}
          </Text>
          <Text size="2" color="gray" style={{ lineHeight: '1.5' }}>
            You lean <strong>{overallStance.name}</strong> overall, but on{' '}
            <strong>{surpriseValue.name}</strong> you chose{' '}
            <strong>{surpriseStance.name}</strong>.
          </Text>
        </div>
      )}

      {/* Specialists list */}
      <Flex direction="column">
        {specialists.map(v => {
          const stanceId = spv[v.id]
          const stance = stanceId && stanceId !== 'unexplored'
            ? stances.find(s => s.id === stanceId)
            : undefined
          const isSuggested = !stanceId && v.id === firstUnvisited?.id

          return (
            <div key={v.id} style={{ borderBottom: '1px solid var(--gray-4)' }}>
              <button
                onClick={() => onEnterSpecialist(v.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: 12,
                  width: '100%',
                }}
              >
                <Flex direction="column" gap="1" style={{ flex: 1 }}>
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text size="2" weight="medium">{v.name}</Text>
                    {isSuggested && (
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--accent-9)',
                          fontWeight: 500,
                          border: '1px solid var(--accent-6)',
                          borderRadius: 99,
                          padding: '1px 7px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {content.examroom.suggestionLabel}
                      </span>
                    )}
                  </Flex>
                </Flex>
                <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                  {stance ? (
                    <StanceChip stance={stance} />
                  ) : (
                    <Text size="2" color="gray">{content.examroom.unexploredLabel}</Text>
                  )}
                  <Text color="gray" size="2">→</Text>
                </Flex>
              </button>
            </div>
          )
        })}
      </Flex>
    </Flex>
  )
}

// ─── Specialist ───────────────────────────────────────────────────────────────

function Specialist({
  stances,
  value,
  scenarios,
  choices,
  scenarioIndex,
  reflecting,
  content,
  onSetChoice,
  onNextScenario,
  onFinishScenarios,
  onConfirm,
  onSkip,
  onBack,
}: {
  stances: StanceContent[]
  value: ValueContent
  scenarios: ScenarioContent[]
  choices: Record<string, string>
  scenarioIndex: number
  reflecting: boolean
  content: AdventureContent
  onSetChoice: (scenarioId: string, choiceId: string) => void
  onNextScenario: () => void
  onFinishScenarios: () => void
  onConfirm: (stanceId: string) => void
  onSkip: () => void
  onBack: () => void
}) {
  const [changingStance, setChangingStance] = useState(false)

  // Reset the change-stance UI when the reflecting prop changes (e.g. browser back).
  useEffect(() => {
    setChangingStance(false)
  }, [reflecting])

  const suggestedStanceId = topStanceFromChoices(choices, scenarios)
  const suggestedStance = stances.find(s => s.id === suggestedStanceId)

  // ── Reflect phase ──
  if (reflecting) {
    return (
      <Flex direction="column" gap="6">
        <button onClick={onBack} style={backLinkStyle} aria-label="Back to overview">
          {content.specialist.backLabel}
        </button>

        <Flex direction="column" gap="1">
          <Heading size="5">{value.name}</Heading>
        </Flex>

        <Heading size="4">{content.specialist.reflect.heading}</Heading>

        {changingStance ? (
          <Flex direction="column" gap="3">
            <Text size="2" weight="medium">{content.specialist.reflect.changeHeading}</Text>
            <Flex direction="column" gap="2">
              {stances.map(stance => {
                const color = stance.color ?? 'var(--gray-6)'
                return (
                  <button
                    key={stance.id}
                    onClick={() => onConfirm(stance.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      border: `1.5px solid ${color}`,
                      borderRadius: 'var(--radius-3)',
                      background: stance.color ? hexToRgba(stance.color, 0.04) : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <Flex align="center" gap="2" mb="1">
                      {stance.emoji && <Text style={{ fontSize: 16 }}>{stance.emoji}</Text>}
                      <Text size="2" weight="medium">{stance.name}</Text>
                    </Flex>
                    <Text size="2" color="gray" style={{ lineHeight: '1.4' }}>
                      {stance.short}
                    </Text>
                  </button>
                )
              })}
            </Flex>
          </Flex>
        ) : (
          <>
            <Flex direction="column" gap="3">
              <Text size="2" color="gray">{content.specialist.reflect.suggestedLabel}</Text>
              {suggestedStance ? (
                <StanceCard stance={suggestedStance} />
              ) : (
                <Text size="2" color="gray">
                  No clear suggestion — you can pick one or skip for now.
                </Text>
              )}
            </Flex>

            <Flex gap="2">
              <Button
                size="2"
                variant="outline"
                disabled={!suggestedStanceId}
                onClick={() => suggestedStanceId && onConfirm(suggestedStanceId)}
                style={{ flex: 1 }}
              >
                {content.specialist.reflect.looksRightLabel}
              </Button>
              <Button
                size="2"
                variant="outline"
                onClick={() => setChangingStance(true)}
                style={{ flex: 1 }}
              >
                {content.specialist.reflect.changeLabel}
              </Button>
              <Button
                size="2"
                variant="outline"
                color="gray"
                onClick={onSkip}
                style={{ flex: 1 }}
              >
                {content.specialist.reflect.skipLabel}
              </Button>
            </Flex>
          </>
        )}
      </Flex>
    )
  }

  // ── Scenarios phase ──
  const scenario = scenarios[scenarioIndex]
  if (!scenario) return null
  const isLast = scenarioIndex === scenarios.length - 1
  const currentChoiceId = choices[scenario.id]

  return (
    <Flex direction="column" gap="6">
      {/* Back + progress */}
      <Flex justify="between" align="center">
        <button onClick={onBack} style={backLinkStyle} aria-label="Back to overview">
          {content.specialist.backLabel}
        </button>
        <Text size="2" color="gray">
          {fmt(content.specialist.progressLabel, scenarioIndex + 1, scenarios.length)}
        </Text>
      </Flex>

      {/* Value context — only on first scenario */}
      {scenarioIndex === 0 && (
        <Flex direction="column" gap="1">
          <Heading size="5">{value.name}</Heading>
          <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
            {value.description}
          </Text>
        </Flex>
      )}

      {/* Scenario */}
      <Flex direction="column" gap="4" key={scenario.id} style={{ animation: 'fadeIn 0.25s ease' }}>
        <Text size="3" style={{ lineHeight: '1.7' }}>
          {scenario.situation}
        </Text>
        <Text size="2" weight="medium" color="gray">
          {content.specialist.chooseLabel}
        </Text>
        <Flex direction="column" gap="2">
          {scenario.choices.map(choice => (
            <button
              key={choice.id}
              aria-pressed={currentChoiceId === choice.id}
              onClick={() => onSetChoice(scenario.id, choice.id)}
              style={choiceButtonStyle(currentChoiceId === choice.id)}
            >
              {choice.text}
            </button>
          ))}
        </Flex>
      </Flex>

      {/* Navigation */}
      <Box>
        <Button
          size="3"
          disabled={!currentChoiceId}
          onClick={isLast ? onFinishScenarios : onNextScenario}
        >
          {isLast ? content.specialist.finishLabel : content.specialist.nextLabel}
        </Button>
      </Box>
    </Flex>
  )
}

// ─── Data loading ─────────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<Props> = async () => {
  const stances = loadStances()
  const values = loadValues()
  const scenarios = loadScenarios()
  const content = loadConceptContent<AdventureContent>('adventure')
  return { props: { stances, values, scenarios, content } }
}
