import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Theme, Box, Flex, Text } from '@radix-ui/themes'
import '@/styles/globals.css'

const CONCEPT_NAMES: Record<string, string> = {
  '/profile': 'Position Profile Creator',
  '/statements': 'Statement Reactions',
  '/adventure': 'Choose Your Own Adventure',
  '/character': 'Character Builder',
  '/map': 'Map',
}

function TopNav() {
  const router = useRouter()
  const conceptKey = '/' + router.pathname.split('/')[1]
  const conceptName = CONCEPT_NAMES[conceptKey]

  return (
    <Box
      px="4"
      py="2"
      style={{
        background: 'var(--gray-3)',
        borderBottom: '1px solid var(--gray-5)',
      }}
    >
      <Flex align="center" gap="2">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Text size="1" color="gray">
            Prototypes
          </Text>
        </Link>
        {conceptName && (
          <>
            <Text size="1" color="gray">
              /
            </Text>
            <Text size="1" color="gray" weight="medium">
              {conceptName}
            </Text>
          </>
        )}
      </Flex>
    </Box>
  )
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Theme accentColor="indigo" grayColor="slate" radius="medium" scaling="100%">
      <TopNav />
      <Component {...pageProps} />
    </Theme>
  )
}
