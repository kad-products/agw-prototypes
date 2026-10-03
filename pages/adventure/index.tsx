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

        <Heading size="4">Background</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          My intent here was to model this after a choose your own adventure book.  Each decision aligns to a stance on a value so we're building the same values profile map but through individual "hot takes" decisions.
        </Text>

        <Heading size="4">Questions to Ponder</Heading>
        <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Does starting from a hot take feel grounding or limiting?</li>
          <li>Does
            choosing your own path make the result feel more like yours?</li>
        </ul>

        <Heading size="4">Ideas for a full implementation</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Make the "explore" page a little more engaging and consider the groupings from other prototypes for a better balance of detail and summarization.</li>
          <li>Possibly explore the "result" page getting a treatment from the more "fun" prototypes like a character card or map.</li>
        </ul>
        </Text>

        <Box>
          <Button size="3" asChild>
            <Link href="/adventure/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
