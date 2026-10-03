import { Box, Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import Link from 'next/link'

export default function ProfileIntro() {
  return (
    <Container size="2" px="4" py="8">
      <Flex direction="column" gap="6">
        <Heading size="6">Position Profile Creator</Heading>

        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          The direct approach. Choose your overall stance first, then work
          through each value area to fill in the details.
        </Text>

        <Heading size="4">Background</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          This is sort of the "boring and straightforward" approach. It is more or less a fancied up survey.  Not that it's a bad thing, but just a little dry.  Take that for what it's worth and see what you think.
        </Text>

        <Heading size="4">Questions to Ponder</Heading>
        <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Does knowing the framework up front help or get in the way?</li>
          <li>Does
            going deeper one area at a time feel meaningful, or like you're just
            picking from a list?</li>
        </ul>

        <Heading size="4">Ideas for a full implementation</Heading>
        
        <Text as="p" size="3" style={{ lineHeight: '1.7' }}>
          <ul style={{ margin: 0, paddingLeft: '1.25em' }}>
          <li>Consider the "grouping" of values that are in use in other prototypes to keep it from initially feeling so intense and tedious.</li>
          <li>Smoother UX and better wording for cleaner collection</li>
          <li>Possibly explore the "result" page getting a treatment from the more "fun" prototypes like a character card or map.</li>
        </ul>
        </Text>

        <Box>
          <Button size="3" asChild>
            <Link href="/profile/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
