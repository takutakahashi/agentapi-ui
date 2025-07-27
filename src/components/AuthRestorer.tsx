'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthPersistence } from '@/hooks/useAuthPersistence'

export function AuthRestorer({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { restoreAuth } = useAuthPersistence()
  const [isRestoring, setIsRestoring] = useState(true)

  useEffect(() => {
    const handleAuthRestore = async () => {
      // Skip restoration on login and OAuth callback pages
      if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
        setIsRestoring(false)
        return
      }

      try {
        const restored = await restoreAuth()
        if (!restored && pathname !== '/login') {
          // No persisted auth found and not on login page, might need to redirect
          // But we'll let the middleware handle the redirect based on cookie
        }
      } catch (error) {
        console.error('Auth restoration failed:', error)
      } finally {
        setIsRestoring(false)
      }
    }

    handleAuthRestore()
  }, [pathname, router, restoreAuth])

  // Show loading state while restoring auth
  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Restoring session...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}