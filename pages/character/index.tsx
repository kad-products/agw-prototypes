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

        <Heading size="4">Background</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          Making the whole "define your stance" thing fun and shareable was important to me.  The analogy to building an RPG characater
          seemed to fit nicely and make it more playful.  Worried it might lose the point of the profile or cause some tension between 
          the fun of it and accurately reflecting stances, but it was worth building a prototype to make that determination.
        </Text>


        <Heading size="4">Questions to Ponder</Heading>
        <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Does the character metaphor make it easier to be honest?</li>
          <li>Does a gap
            between your persona and your choices mean anything to you?</li>
            <li>Does the "fun" of the builder make this something you would share or post on a social media platform?</li>
        </ul>

        <Heading size="4">Ideas for a full implementation</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Allow for the deeper level of exploration and definition of stances.  The groupings are useful but they leave things a bit fuzzier than other prototypes.</li>
          <li>Make the character page a little more "fun" with a real designer behind it.</li>
          <li>Consider a "zoom in" UX for defining each group of values in a easier UX and allow for more detailed exploration.</li>
        </ul>
        </Text>

        <Box>
          <Button size="3" asChild>
            <Link href="/character/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
