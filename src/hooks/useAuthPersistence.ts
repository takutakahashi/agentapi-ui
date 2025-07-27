'use client'

import { useEffect } from 'react'
import { authPersistence } from '@/lib/client-auth-persistence'

export function useAuthPersistence() {
  // Initialize auth persistence on mount
  useEffect(() => {
    authPersistence.init().catch(console.error)
  }, [])

  const persistApiKey = async (apiKey: string) => {
    try {
      await authPersistence.saveToken(apiKey)
    } catch (error) {
      console.error('Failed to persist API key:', error)
    }
  }

  const clearPersistedAuth = async () => {
    try {
      await authPersistence.clearToken()
    } catch (error) {
      console.error('Failed to clear persisted auth:', error)
    }
  }

  const restoreAuth = async () => {
    try {
      const token = await authPersistence.getToken()
      if (token) {
        // Send the token to the server to restore the session
        const response = await fetch('/api/auth/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: token }),
        })

        if (!response.ok) {
          // If restoration fails, clear the persisted token
          await authPersistence.clearToken()
          return false
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to restore auth:', error)
      return false
    }
  }

  return {
    persistApiKey,
    clearPersistedAuth,
    restoreAuth,
  }
}