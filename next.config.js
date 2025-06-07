/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/': ['./public/**/*'],
  },
}

module.exports = nextConfig