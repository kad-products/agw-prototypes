import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

export default function MapIntro() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="6">
        <Heading size="6">Map</Heading>

        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          A spatial experience. Pick an overall stance, then explore value areas
          as points on a map. Each choice lands visibly as you go — the
          reflection isn&rsquo;t saved for the end.
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
            Does the map make your position feel more concrete? Does continuous
            reflection work, or is it too much to track while you&rsquo;re still
            deciding?
          </Text>
        </Box>

        <Box>
          <Button size="3" asChild>
            <Link href="/map/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
