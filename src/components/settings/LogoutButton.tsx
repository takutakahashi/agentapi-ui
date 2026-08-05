'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

interface LogoutButtonProps {
  variant?: 'icon' | 'full'
  className?: string
}

export function LogoutButton({ variant = 'full', className = '' }: LogoutButtonProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      if (response.ok) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setLoggingOut(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className={`p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 ${className}`}
        title="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loggingOut}
      className={`flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 ${className}`}
    >
      <LogOut className="w-4 h-4" />
      <span className="text-sm font-medium">{loggingOut ? 'Logging out...' : 'Logout'}</span>
    </button>
  )
}
