/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingIncludes: {
      '/': ['./public/**/*'],
    },
  },
}

module.exports = nextConfig