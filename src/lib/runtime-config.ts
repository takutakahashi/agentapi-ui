let runtimeConfig: { singleProfileMode?: boolean } | null = null

export async function getRuntimeConfig() {
  if (runtimeConfig !== null) {
    return runtimeConfig
  }

  if (typeof window === 'undefined') {
    // Server-side
    runtimeConfig = {
      singleProfileMode: process.env.SINGLE_PROFILE_MODE === 'true' || process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true',
    }
    return runtimeConfig
  }

  // Client-side
  try {
    const response = await fetch('/api/config')
    if (response.ok) {
      runtimeConfig = await response.json()
    } else {
      throw new Error('Failed to fetch config')
    }
  } catch (error) {
    console.error('Failed to fetch runtime config:', error)
    // Fallback to build-time environment variables
    runtimeConfig = {
      singleProfileMode: process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true',
    }
  }

  return runtimeConfig
}

export function clearRuntimeConfigCache() {
  runtimeConfig = null
}