import type { MetadataRoute } from 'next'

/**
 * PWA マニフェストを動的に生成
 * 環境変数 PWA_APP_NAME または NEXT_PUBLIC_PWA_APP_NAME でアプリ名を設定可能
 */
export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.PWA_APP_NAME
    || process.env.NEXT_PUBLIC_PWA_APP_NAME
    || 'AgentAPI UI'

  const shortName = process.env.PWA_SHORT_NAME
    || process.env.NEXT_PUBLIC_PWA_SHORT_NAME
    || 'AgentAPI'

  const description = process.env.PWA_DESCRIPTION
    || process.env.NEXT_PUBLIC_PWA_DESCRIPTION
    || 'User interface for AgentAPI - AI agent conversation management'

  return {
    name: appName,
    short_name: shortName,
    description: description,
    theme_color: '#000000',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-256x256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/icon-384x384.png',
        sizes: '384x384',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
