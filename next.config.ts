import type { NextConfig } from 'next'

// In CI (GitHub Pages), NEXT_PUBLIC_BASE_PATH is set to the repo subpath (e.g. /agw-prototypes).
// Locally it is unset, so the app runs at the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

const nextConfig: NextConfig = {
  output: 'export',
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath,
}

export default nextConfig
