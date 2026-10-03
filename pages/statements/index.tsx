import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

export default function StatementsIntro() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="6">
        <Heading size="6">Statement Reactions</Heading>

        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          You never pick a stance directly. React to short real-world
          statements, and the tool suggests a position from your reactions —
          then shows its reasoning so you can correct it.
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
            Does the suggest-and-correct loop feel right? Is it easy to push
            back when the inference is off? Does the reasoning tell you
            something about yourself?
          </Text>
        </Box>

        <Box>
          <Button size="3" asChild>
            <Link href="/statements/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
