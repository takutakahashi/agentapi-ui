export interface CookieOptions {
  expires?: Date
  maxAge?: number
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
}

export class CookieStorage {
  private static defaultOptions: CookieOptions = {
    path: '/',
    secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  }

  static set(key: string, value: string, options: CookieOptions = {}): void {
    if (typeof window === 'undefined') return

    const cookieOptions = { ...this.defaultOptions, ...options }
    let cookieString = `${key}=${encodeURIComponent(value)}`

    if (cookieOptions.expires) {
      cookieString += `; expires=${cookieOptions.expires.toUTCString()}`
    }

    if (cookieOptions.maxAge) {
      cookieString += `; max-age=${cookieOptions.maxAge}`
    }

    if (cookieOptions.domain) {
      cookieString += `; domain=${cookieOptions.domain}`
    }

    if (cookieOptions.path) {
      cookieString += `; path=${cookieOptions.path}`
    }

    if (cookieOptions.secure) {
      cookieString += '; secure'
    }

    if (cookieOptions.httpOnly) {
      cookieString += '; httponly'
    }

    if (cookieOptions.sameSite) {
      cookieString += `; samesite=${cookieOptions.sameSite}`
    }

    document.cookie = cookieString
  }

  static get(key: string): string | null {
    if (typeof window === 'undefined') return null

    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [cookieKey, cookieValue] = cookie.trim().split('=')
      if (cookieKey === key) {
        return decodeURIComponent(cookieValue)
      }
    }
    return null
  }

  static delete(key: string, options: Partial<CookieOptions> = {}): void {
    if (typeof window === 'undefined') return

    const cookieOptions = { ...this.defaultOptions, ...options }
    let cookieString = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`

    if (cookieOptions.domain) {
      cookieString += `; domain=${cookieOptions.domain}`
    }

    if (cookieOptions.path) {
      cookieString += `; path=${cookieOptions.path}`
    }

    document.cookie = cookieString
  }

  static setApiKey(profileId: string, apiKey: string): void {
    this.set(`agentapi-apikey-${profileId}`, apiKey)
  }

  static getApiKey(profileId: string): string | null {
    return this.get(`agentapi-apikey-${profileId}`)
  }

  static deleteApiKey(profileId: string): void {
    this.delete(`agentapi-apikey-${profileId}`)
  }

  static setEnvironmentVariables(profileId: string, envVars: Record<string, string>): void {
    const encoded = btoa(JSON.stringify(envVars))
    this.set(`agentapi-env-${profileId}`, encoded)
  }

  static getEnvironmentVariables(profileId: string): Record<string, string> | null {
    const encoded = this.get(`agentapi-env-${profileId}`)
    if (!encoded) return null
    
    try {
      const decoded = atob(encoded)
      return JSON.parse(decoded)
    } catch (error) {
      console.error('Failed to decode environment variables:', error)
      return null
    }
  }

  static deleteEnvironmentVariables(profileId: string): void {
    this.delete(`agentapi-env-${profileId}`)
  }

  static setGlobalEnvironmentVariables(envVars: Record<string, string>): void {
    const encoded = btoa(JSON.stringify(envVars))
    this.set('agentapi-global-env', encoded)
  }

  static getGlobalEnvironmentVariables(): Record<string, string> | null {
    const encoded = this.get('agentapi-global-env')
    if (!encoded) return null
    
    try {
      const decoded = atob(encoded)
      return JSON.parse(decoded)
    } catch (error) {
      console.error('Failed to decode global environment variables:', error)
      return null
    }
  }

  static deleteGlobalEnvironmentVariables(): void {
    this.delete('agentapi-global-env')
  }
}