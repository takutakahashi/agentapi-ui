'use client'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  showText?: boolean
  fullScreen?: boolean
  overlay?: boolean
  className?: string
}

export default function LoadingSpinner({
  size = 'md',
  text = '読み込み中...',
  showText = true,
  fullScreen = false,
  overlay = false,
  className = ''
}: LoadingSpinnerProps) {
  const sizeConfig = {
    sm: { spinner: 'h-4 w-4', text: 'text-xs', padding: 'py-4' },
    md: { spinner: 'h-8 w-8', text: 'text-sm', padding: 'py-12' },
    lg: { spinner: 'h-12 w-12', text: 'text-base', padding: 'py-16' },
    xl: { spinner: 'h-16 w-16', text: 'text-lg', padding: 'py-20' }
  }

  const config = sizeConfig[size]

  const spinnerContent = (
    <div className={`flex flex-col items-center justify-center gap-3 animate-fade-in ${className}`}>
      <div className={`${config.spinner} relative`}>
        {/* Background ring */}
        <div className={`${config.spinner} rounded-full border-2 border-blue-100 dark:border-blue-900 absolute inset-0`}></div>
        {/* Spinning ring */}
        <div className={`${config.spinner} rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent animate-spin absolute inset-0`}></div>
      </div>
      {showText && text && (
        <span className={`${config.text} text-gray-600 dark:text-gray-400 font-medium`}>
          {text}
        </span>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center z-50 ${
        overlay ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm' : ''
      }`}>
        {spinnerContent}
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center ${config.padding}`}>
      {spinnerContent}
    </div>
  )
}

// Inline spinner for buttons and small spaces
export function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 text-current ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// Dots loading animation
export function DotsSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  )
}

// Pulse loading for content areas
export function PulseLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 animate-pulse flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 animate-pulse"></div>
      </div>
    </div>
  )
}
