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

        <Box
          style={{
            background: 'var(--gray-2)',
            borderRadius: 'var(--radius-3)',
            padding: 'var(--space-4)',
          }}
        >
          <Text size="2" color="gray" style={{ lineHeight: '1.6' }}>
            <strong style={{ color: 'var(--gray-12)' }}>What to notice:</strong>{' '}
            Does knowing the framework up front help or get in the way? Does
            going deeper one area at a time feel meaningful, or like you're just
            picking from a list?
          </Text>
        </Box>

        <Box>
          <Button size="3" asChild>
            <Link href="/profile/play">Start</Link>
          </Button>
        </Box>
      </Flex>
    </Container>
  )
}
