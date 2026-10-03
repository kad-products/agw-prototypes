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

        <Heading size="4">Background</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          This is an indirect approach, trying to get some real reactions and help map that to something concrete.  Often our brains respond differently to statements than what we know to be a survey/questionnaire.  
        </Text>

        <Heading size="4">Questions to Ponder</Heading>
        <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Does the suggest-and-correct loop feel right?  </li>
          <li>Is it easy to push
            back when the inference is off?</li>
            <li>Does the reasoning tell you
            something about yourself?</li>
        </ul>

        <Heading size="4">Ideas for a full implementation</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>More creative UX for collecting reactions</li>
          <li>Possibly explore the "result" page getting a treatment from the more "fun" prototypes like a character card or map.</li>
          <li>Consider the "grouping" of values that are in use in other prototypes to keep it from initially feeling so intense and tedious.</li>
        </ul>
        </Text>

        <Box>
          <Button size="3" asChild>
            <Link href="/statements/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
