import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

export default function AdventureIntro() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="6">
        <Heading size="6">Choose Your Own Adventure</Heading>

        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          Start with a gut reaction, then steer through &ldquo;what would you
          do&rdquo; scenarios. Your choices build a picture without you ever
          naming a stance directly.
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
            Does starting from a hot take feel grounding or limiting? Does
            choosing your own path make the result feel more like yours?
          </Text>
        </Box>

        <Box>
          <Button size="3" asChild>
            <Link href="/adventure/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
