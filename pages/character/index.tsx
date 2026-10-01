import React, { useReducer, useState } from 'react'
import type { GetStaticProps } from 'next'
import {
  Button,
  Container,
  Flex,
  Heading,
  Text,
} from '@radix-ui/themes'
import { Share1Icon } from '@radix-ui/react-icons'
import { loadStances, loadConceptContent } from '@/lib/content'
import { useStepHistory } from '@/lib/useStepHistory'
import type { StanceContent, Position, ValueStance } from '@/lib/types'

// ─── Content types ────────────────────────────────────────────────────────────

interface Persona {
  id: string
  stanceId: string
  name: string
  tagline: string
  description: string
}

interface AttributeGroup {
  id: string
  name: string
  valueIds: string[]
  snippets: Record<string, string>
}

interface CharacterContent {
  personasEnabled: boolean
  intro: { heading: string; body: string }
  gallery: { heading: string }
  personas: Persona[]
  attributeGroups: AttributeGroup[]
  attributes: {
    headingTemplate: string
    intro: string
    confirmLabel: string
  }
  sheet: {
    classLabel: string
    gapIntro: string
    gapSuggestedLabel: string
    keepPersonaLabel: string
    swapPersonaLabel: string
    shareLabel: string
    shareCopiedLabel: string
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  stances: StanceContent[]
  content: CharacterContent
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function dominantStance(attributeChoices: Record<string, string | null>): string | null {
  const counts: Record<string, number> = {}
  for (const stanceId of Object.values(attributeChoices)) {
    if (!stanceId) continue
    counts[stanceId] = (counts[stanceId] ?? 0) + 1
  }
  let bestId: string | null = null
  let bestCount = 0
  for (const [id, count] of Object.entries(counts)) {
    if (count > bestCount) { bestId = id; bestCount = count }
  }
  return bestId
}

// ─── State ────────────────────────────────────────────────────────────────────

type Step = 'gallery' | 'attributes'

interface CharacterState {
  step: Step
  selectedPersonaId: string | null
  attributeChoices: Record<string, string | null>  // groupId → stanceId | null
  position: Position
}

type CharacterAction =
  | { type: 'SELECT_PERSONA'; personaId: string; stanceId: string; initialChoices: Record<string, string | null> }
  | { type: 'TOGGLE_GROUP'; groupId: string; stanceId: string }
  | { type: 'SWAP_PERSONA'; personaId: string; stanceId: string }
  | { type: 'RESTORE_STATE'; step: Step }

function reducer(state: CharacterState, action: CharacterAction): CharacterState {
  switch (action.type) {
    case 'SELECT_PERSONA':
      return {
        ...state,
        step: 'attributes',
        selectedPersonaId: action.personaId,
        attributeChoices: action.initialChoices,
        position: { ...state.position, overallStance: action.stanceId },
      }

    case 'TOGGLE_GROUP': {
      const current = state.attributeChoices[action.groupId]
      const next = current === action.stanceId ? null : action.stanceId
      return { ...state, attributeChoices: { ...state.attributeChoices, [action.groupId]: next } }
    }

    case 'SWAP_PERSONA':
      return {
        ...state,
        selectedPersonaId: action.personaId,
        position: { ...state.position, overallStance: action.stanceId },
      }

    case 'RESTORE_STATE':
      return { ...state, step: action.step }

    default:
      return state
  }
}

function initialState(): CharacterState {
  return {
    step: 'gallery',
    selectedPersonaId: null,
    attributeChoices: {},
    position: { takenAt: new Date() },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CharacterPage({ stances, content }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useStepHistory('/character', { step: state.step }, q =>
    dispatch({ type: 'RESTORE_STATE', step: (q.step as Step) ?? 'gallery' }),
  )

  const selectedPersona = content.personas.find(p => p.id === state.selectedPersonaId) ?? null
  const selectedStance = selectedPersona
    ? stances.find(s => s.id === selectedPersona.stanceId) ?? null
    : null

  return (
    <Container size="3" px="4" py="8">
      {state.step === 'gallery' && (
        <PersonaGallery
          stances={stances}
          content={content}
          onSelect={persona => {
            const initialChoices: Record<string, string | null> = {}
            for (const g of content.attributeGroups) initialChoices[g.id] = persona.stanceId
            dispatch({
              type: 'SELECT_PERSONA',
              personaId: persona.id,
              stanceId: persona.stanceId,
              initialChoices,
            })
          }}
        />
      )}

      {state.step === 'attributes' && selectedPersona && selectedStance && (
        <AttributeScreen
          stances={stances}
          content={content}
          persona={selectedPersona}
          personaStance={selectedStance}
          attributeChoices={state.attributeChoices}
          onToggle={(groupId, stanceId) =>
            dispatch({ type: 'TOGGLE_GROUP', groupId, stanceId })
          }
          onSwapPersona={(personaId, stanceId) =>
            dispatch({ type: 'SWAP_PERSONA', personaId, stanceId })
          }
        />
      )}
    </Container>
  )
}

// ─── Persona gallery ──────────────────────────────────────────────────────────

function PersonaGallery({
  stances,
  content,
  onSelect,
}: {
  stances: StanceContent[]
  content: CharacterContent
  onSelect: (persona: Persona) => void
}) {
  return (
    <Flex direction="column" gap="6">
      <Flex direction="column" gap="2">
        <Heading size="6">{content.intro.heading}</Heading>
        <Text size="3" color="gray" style={{ lineHeight: '1.7' }}>
          {content.intro.body}
        </Text>
      </Flex>

      <Text size="2" weight="medium">{content.gallery.heading}</Text>

      {/* Brick layout: row of 3 centered over row of 4, same card size */}
      <Flex direction="column" gap="2" align="center">
        {[content.personas.slice(0, 3), content.personas.slice(3, 7)].map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: 10 }}>
            {row.map(persona => {
              const stance = stances.find(s => s.id === persona.stanceId)
              const color = stance?.color ?? 'var(--gray-6)'
              return (
                <button
                  key={persona.id}
                  onClick={() => onSelect(persona)}
                  style={{
                    width: 190,
                    height: 280,
                    flex: '0 0 190px',
                    display: 'flex',
                    flexDirection: 'column',
                    textAlign: 'left',
                    padding: 0,
                    border: `1.5px solid ${color}`,
                    borderRadius: 'var(--radius-3)',
                    background: 'white',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      background: hexToRgba(color, 0.15),
                      padding: '10px 12px',
                      borderBottom: `1px solid ${hexToRgba(color, 0.3)}`,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gray-12)', lineHeight: 1.2 }}>
                      {persona.name}
                    </div>
                    <div style={{ color, fontStyle: 'italic', fontSize: 11, lineHeight: 1.3, marginTop: 3 }}>
                      {persona.tagline}
                    </div>
                  </div>
                  <div style={{ padding: '8px 12px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--gray-10)', lineHeight: 1.5, overflow: 'hidden' }}>
                      {persona.description}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '5px 12px',
                      borderTop: `1px solid ${hexToRgba(color, 0.2)}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      flexShrink: 0,
                    }}
                  >
                    {stance?.emoji && <span style={{ fontSize: 11 }}>{stance.emoji}</span>}
                    <span style={{ color, fontWeight: 600, fontSize: 11 }}>{stance?.name}</span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </Flex>
    </Flex>
  )
}

// ─── Persona compact header ───────────────────────────────────────────────────

function PersonaHeader({
  persona,
  personaStance,
}: {
  persona: Persona
  personaStance: StanceContent
}) {
  const color = personaStance.color ?? '#888'
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        outline: `1px solid ${hexToRgba(color, 0.35)}`,
        outlineOffset: '-6px',
        borderRadius: 'var(--radius-3)',
        background: '#faf7f2',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: hexToRgba(color, 0.12),
          padding: '12px 20px',
          borderBottom: `1px solid ${hexToRgba(color, 0.25)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 20,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--gray-12)',
              lineHeight: 1.1,
            }}
          >
            {persona.name}
          </div>
          <div style={{ fontStyle: 'italic', color: 'var(--gray-11)', fontSize: 13, marginTop: 2 }}>
            {persona.tagline}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{personaStance.emoji}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color,
              border: `1px solid ${color}`,
              borderRadius: 4,
              padding: '2px 7px',
            }}
          >
            {personaStance.name}
          </span>
        </div>
      </div>
      <div style={{ padding: '10px 20px' }}>
        <Text size="2" color="gray" style={{ lineHeight: '1.6', fontStyle: 'italic' }}>
          {persona.description}
        </Text>
      </div>
    </div>
  )
}

// ─── Silhouette SVG ───────────────────────────────────────────────────────────

function SilhouetteSVG() {
  const fill = 'rgba(28, 28, 48, 0.10)'
  return (
    <svg
      width={130}
      height={480}
      viewBox="0 0 130 480"
      style={{ position: 'absolute', left: 335, top: 20, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <circle cx={65} cy={50} r={38} fill={fill} />
      <rect x={53} y={86} width={24} height={24} rx={5} fill={fill} />
      <path
        fill={fill}
        d={[
          'M 14 110', 'L 116 110',
          'L 110 195', 'L 83 215',
          'L 88 278', 'L 98 278',
          'L 98 435', 'L 72 435',
          'L 65 325', 'L 58 435',
          'L 32 435', 'L 32 278',
          'L 42 278', 'L 47 215',
          'L 20 195', 'Z',
        ].join(' ')}
      />
      <path fill={fill} d="M 14 110 L -2 218 L 12 224 L 28 120 Z" />
      <path fill={fill} d="M 116 110 L 132 218 L 118 224 L 102 120 Z" />
      <ellipse cx={45} cy={444} rx={24} ry={11} fill={fill} />
      <ellipse cx={85} cy={444} rx={24} ry={11} fill={fill} />
    </svg>
  )
}

// ─── Value group node ─────────────────────────────────────────────────────────

// Node: 160×160px centered at (cx, cy).
// 7 stance chips on a ring at radius 60px; inner display circle 80px diameter.
// Group label floats horizontally beside the node in the space between it and
// the silhouette (labelSide='right' for left-column nodes, 'left' for right-column).

function ValueGroupNode({
  group,
  stances,
  selectedStanceId,
  cx,
  cy,
  labelSide,
  onToggle,
}: {
  group: AttributeGroup
  stances: StanceContent[]
  selectedStanceId: string | null
  cx: number
  cy: number
  labelSide: 'left' | 'right'
  onToggle: (stanceId: string) => void
}) {
  const [hoveredStanceId, setHoveredStanceId] = useState<string | null>(null)

  const nodeR = 80
  const chipR = 60
  const chipSize = 26
  const innerD = 80

  const selectedStance = selectedStanceId
    ? stances.find(s => s.id === selectedStanceId) ?? null
    : null
  const hoveredStance = hoveredStanceId
    ? stances.find(s => s.id === hoveredStanceId) ?? null
    : null

  // Inner circle: hovered snippet takes priority, then selected snippet, then empty
  const displayStanceId = hoveredStanceId ?? selectedStanceId
  const displayStance = displayStanceId
    ? stances.find(s => s.id === displayStanceId) ?? null
    : null
  const snippet = displayStanceId ? (group.snippets[displayStanceId] ?? null) : null

  const ringColor = selectedStance?.color ?? null

  return (
    // Wrapper anchors to node center; label floats outside in the silhouette gap
    <div
      style={{
        position: 'absolute',
        left: cx - nodeR,
        top: cy - nodeR,
        width: nodeR * 2,
        height: nodeR * 2,
      }}
    >
      {/* Outer ring */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${ringColor ? hexToRgba(ringColor, 0.45) : 'var(--gray-4)'}`,
          background: ringColor ? hexToRgba(ringColor, 0.04) : 'rgba(255,255,255,0.8)',
        }}
      />

      {/* 7 stance chips arranged radially — solid color fill, no emoji */}
      {stances.map((stance, i) => {
        const angle = (2 * Math.PI * i / stances.length) - Math.PI / 2
        const chipCx = nodeR + chipR * Math.cos(angle)
        const chipCy = nodeR + chipR * Math.sin(angle)
        const isSelected = selectedStanceId === stance.id
        const isHovered = hoveredStanceId === stance.id
        const color = stance.color ?? '#888'

        return (
          <button
            key={stance.id}
            title={stance.name}
            onMouseEnter={() => setHoveredStanceId(stance.id)}
            onMouseLeave={() => setHoveredStanceId(null)}
            onClick={() => onToggle(stance.id)}
            style={{
              position: 'absolute',
              left: chipCx - chipSize / 2,
              top: chipCy - chipSize / 2,
              width: chipSize,
              height: chipSize,
              borderRadius: '50%',
              border: isSelected || isHovered
                ? `2px solid ${color}`
                : `1px solid ${hexToRgba(color, 0.4)}`,
              background: isSelected
                ? color
                : isHovered
                ? hexToRgba(color, 0.45)
                : hexToRgba(color, 0.18),
              cursor: 'pointer',
              zIndex: 2,
              padding: 0,
              transform: isSelected ? 'scale(1.2)' : 'scale(1)',
              transition: 'transform 0.1s ease, background 0.1s ease',
            }}
          />
        )
      })}

      {/* Inner circle — centered with CSS transform, shows stance snippet */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: innerD,
          height: innerD,
          borderRadius: '50%',
          border: `1.5px solid ${ringColor ? hexToRgba(ringColor, 0.35) : 'var(--gray-4)'}`,
          background: ringColor ? hexToRgba(ringColor, 0.08) : 'var(--gray-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 8px',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {snippet && (
          <span
            style={{
              fontSize: 9,
              lineHeight: 1.35,
              color: displayStance?.color ?? 'var(--gray-11)',
              fontStyle: 'italic',
            }}
          >
            {snippet}
          </span>
        )}
      </div>

      {/* Group label — floats in the gap between node and silhouette */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          ...(labelSide === 'right'
            ? { left: '100%', paddingLeft: 12, textAlign: 'left' }
            : { right: '100%', paddingRight: 12, textAlign: 'right' }),
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: ringColor ?? 'var(--gray-8)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {group.name}
      </div>
    </div>
  )
}

// ─── Attribute screen (final shareable view) ──────────────────────────────────

// Groups: [left-top, right-top, left-mid, right-mid, left-bot, right-bot]
const NODE_POSITIONS: Array<{ cx: number; cy: number; labelSide: 'left' | 'right' }> = [
  { cx: 85,  cy: 100, labelSide: 'right' },
  { cx: 715, cy: 100, labelSide: 'left'  },
  { cx: 85,  cy: 260, labelSide: 'right' },
  { cx: 715, cy: 260, labelSide: 'left'  },
  { cx: 85,  cy: 420, labelSide: 'right' },
  { cx: 715, cy: 420, labelSide: 'left'  },
]

function AttributeScreen({
  stances,
  content,
  persona,
  personaStance,
  attributeChoices,
  onToggle,
  onSwapPersona,
}: {
  stances: StanceContent[]
  content: CharacterContent
  persona: Persona
  personaStance: StanceContent
  attributeChoices: Record<string, string | null>
  onToggle: (groupId: string, stanceId: string) => void
  onSwapPersona: (personaId: string, stanceId: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const dominant = dominantStance(attributeChoices)
  const hasGap = !!dominant && dominant !== persona.stanceId
  const dominantStanceObj = dominant ? stances.find(s => s.id === dominant) : null
  const swapPersona = dominant
    ? content.personas.find(p => p.stanceId === dominant)
    : null

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Expand group choices to individual values for the position record
  function buildStancesPerValue(): Record<string, ValueStance> {
    const spv: Record<string, ValueStance> = {}
    for (const g of content.attributeGroups) {
      const sid = attributeChoices[g.id]
      if (sid) {
        for (const vid of g.valueIds) spv[vid] = sid as ValueStance
      }
    }
    return spv
  }
  void buildStancesPerValue  // available if needed later

  return (
    <Flex direction="column" gap="5">
      <PersonaHeader persona={persona} personaStance={personaStance} />

      <Text size="2" color="gray">
        {content.attributes.intro}
      </Text>

      {/* Builder area */}
      <div style={{ position: 'relative', width: 800, height: 520, margin: '0 auto' }}>
        <SilhouetteSVG />
        {content.attributeGroups.map((group, i) => {
          const pos = NODE_POSITIONS[i]
          return (
            <ValueGroupNode
              key={group.id}
              group={group}
              stances={stances}
              selectedStanceId={attributeChoices[group.id] ?? null}
              cx={pos.cx}
              cy={pos.cy}
              labelSide={pos.labelSide}
              onToggle={stanceId => onToggle(group.id, stanceId)}
            />
          )
        })}
      </div>

      {/* Gap callout — shown when attribute pattern diverges from chosen persona */}
      {hasGap && dominantStanceObj && swapPersona && (
        <div
          style={{
            padding: '14px 16px',
            background: hexToRgba(dominantStanceObj.color ?? '#888', 0.08),
            border: `1px solid ${hexToRgba(dominantStanceObj.color ?? '#888', 0.3)}`,
            borderRadius: 'var(--radius-2)',
          }}
        >
          <Text size="2" weight="medium" style={{ display: 'block', marginBottom: 4 }}>
            {content.sheet.gapIntro}
          </Text>
          <Flex align="center" gap="2" style={{ marginBottom: 12 }}>
            <Text size="2" color="gray">{content.sheet.gapSuggestedLabel}</Text>
            <Flex align="center" gap="1">
              <span style={{ fontSize: 14 }}>{dominantStanceObj.emoji}</span>
              <Text size="2" weight="medium" style={{ color: dominantStanceObj.color ?? 'inherit' }}>
                {dominantStanceObj.name}
              </Text>
            </Flex>
          </Flex>
          <Flex gap="2">
            <Button size="2" variant="outline" color="gray" onClick={() => {}}>
              {content.sheet.keepPersonaLabel}
            </Button>
            <Button
              size="2"
              variant="solid"
              onClick={() => onSwapPersona(swapPersona.id, swapPersona.stanceId)}
              style={{ background: dominantStanceObj.color ?? undefined }}
            >
              {content.sheet.swapPersonaLabel.replace('{name}', swapPersona.name)}
            </Button>
          </Flex>
        </div>
      )}

      <Flex justify="center">
        <Button size="2" variant="soft" onClick={handleShare}>
          <Share1Icon />
          {copied ? content.sheet.shareCopiedLabel : content.sheet.shareLabel}
        </Button>
      </Flex>
    </Flex>
  )
}

// ─── Data loading ─────────────────────────────────────────────────────────────

export const getStaticProps: GetStaticProps<Props> = async () => {
  const stances = loadStances()
  const content = loadConceptContent<CharacterContent>('character-builder')
  return { props: { stances, content } }
}
