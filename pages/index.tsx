import { Box, Container, Flex, Heading, Text, Card, Badge } from '@radix-ui/themes'
import Link from 'next/link'

const concepts = [
  {
    slug: 'profile',
    name: 'Position Profile Creator',
    status: 'ready',
    description:
      'Pick a stance directly and build out your position across specific areas.',
  },
  {
    slug: 'statements',
    name: 'Statement Reactions',
    status: 'planned',
    description:
      'React to short real-world statements. The tool infers your stance and shows its reasoning.',
  },
  {
    slug: 'adventure',
    name: 'Choose Your Own Adventure',
    status: 'planned',
    description:
      'Steer through scenarios. Layer-by-layer reflection that you control.',
  },
  {
    slug: 'character',
    name: 'Character Builder',
    status: 'planned',
    description:
      'Build a character that represents your position. Choose a persona, set attributes, add backstory.',
  },
  {
    slug: 'map',
    name: 'Map',
    status: 'planned',
    description:
      'A spatial experience that reveals as you go. Reflection happens continuously, not at the end.',
  },
]

export default function Home() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="2" mb="7">
        <Heading size="7">AI Positions Map — Prototypes</Heading>
        <Text color="gray" size="2">
          Phase 1 · Running on fake content · Private
        </Text>
      </Flex>

      <Flex direction="column" gap="3">
        {concepts.map(c => (
          <Card key={c.slug} asChild={c.status === 'ready'}>
            {c.status === 'ready' ? (
              <Link href={`/${c.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ConceptCard {...c} />
              </Link>
            ) : (
              <ConceptCard {...c} />
            )}
          </Card>
        ))}
      </Flex>
    </Container>
  )
}

function ConceptCard({
  name,
  status,
  description,
}: {
  name: string
  status: string
  description: string
}) {
  return (
    <Flex justify="between" align="start" gap="4">
      <Box>
        <Flex align="center" gap="2" mb="1">
          <Text weight="medium">{name}</Text>
          {status === 'planned' && (
            <Badge color="gray" variant="soft" size="1">
              planned
            </Badge>
          )}
        </Flex>
        <Text color="gray" size="2">
          {description}
        </Text>
      </Box>
    </Flex>
  )
}
