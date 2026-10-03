import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

export default function CharacterIntro() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="6">
        <Heading size="6">Character Builder</Heading>

        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          Build a character that represents your position on AI. Pick a persona,
          then shape it attribute by attribute. The tool flags when your choices
          don&rsquo;t match your starting persona.
        </Text>

        <Box
          style={{
            background: 'var(--gray-2)',
            borderRadius: 'var(--radius-3)',
            padding: 'var(--space-4)',
          }}
        >
          <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--gray-12)' }}>What to notice:</strong>{' '}
            Does the character metaphor make it easier to be honest? Does a gap
            between your persona and your choices mean anything to you?
          </Text>
        </Box>

        <Box>
          <Button size="3" asChild>
            <Link href="/character/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
