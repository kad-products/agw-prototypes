import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

export default function Home() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="6">
        <Flex direction="column" gap="3">
          <Heading size="7">AI Positions Map</Heading>
          <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
            Most people have a hot take on AI. This is a tool to get past that
            — to help someone figure out where they actually stand across the
            things that actually matter to them: privacy, job security, accuracy,
            creativity, trust. The output is a position with some shape to it,
            not a score.
          </Text>
          <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
            It&rsquo;s built on a published framework of stances and values —
            seven positions people actually take on AI, and thirteen values where
            those positions play out. No stance is right.
          </Text>
        </Flex>

        <Box
          style={{
            borderLeft: '3px solid var(--gray-5)',
            paddingLeft: 'var(--space-4)',
          }}
        >
          <Text size="2" color="gray" style={{ lineHeight: '1.7' }}>
            <strong style={{ color: 'var(--gray-12)' }}>
              The content here is invented.
            </strong>{' '}
            Placeholder stances and values with the right shape, not real
            framework behind them. Real content comes later, once the UX is
            worth filling in.
          </Text>
        </Box>

        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          These are five different approaches to the same thing. Try one or two.
          I want to know: does the approach make sense? Does the reflect-back at
          the end tell you something? Where does it fall apart?
        </Text>

        <Box>
          <Button size="3" asChild>
            <Link href="/prototypes">See the prototypes</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
