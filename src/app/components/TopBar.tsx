'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ProfileManager } from '../../utils/profileManager'
import { ProfileListItem } from '../../types/profile'

interface TopBarProps {
  title: string
  subtitle?: string
  showFilterButton?: boolean
  filterButtonText?: string
  onFilterToggle?: () => void
  showSettingsButton?: boolean
  showNewSessionButton?: boolean
  onNewSession?: () => void
  showProfileSwitcher?: boolean
  children?: React.ReactNode
}

export default function TopBar({
  title,
  subtitle,
  showFilterButton = false,
  filterButtonText = 'フィルタを表示',
  onFilterToggle,
  showSettingsButton = true,
  showNewSessionButton = false,
  onNewSession,
  showProfileSwitcher = false,
  children
}: TopBarProps) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [currentProfile, setCurrentProfile] = useState<ProfileListItem | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)

  useEffect(() => {
    if (showProfileSwitcher) {
      loadProfiles()
      
      // Listen for URL changes (back/forward navigation)
      const handlePopState = () => {
        loadProfiles()
      }
      
      window.addEventListener('popstate', handlePopState)
      return () => {
        window.removeEventListener('popstate', handlePopState)
      }
    }
  }, [showProfileSwitcher])

  const loadProfiles = () => {
    ProfileManager.migrateExistingSettings()
    const profilesList = ProfileManager.getProfiles()
    setProfiles(profilesList)
    
    // Check URL parameters first, then fall back to default profile
    const currentProfileId = ProfileManager.getCurrentProfileId()
    if (currentProfileId) {
      const currentProfileItem = profilesList.find(p => p.id === currentProfileId)
      setCurrentProfile(currentProfileItem || null)
    } else if (profilesList.length > 0) {
      setCurrentProfile(profilesList[0])
    }
  }

  const handleProfileSwitch = (profileId: string) => {
    ProfileManager.setProfileInUrl(profileId)
    ProfileManager.setDefaultProfile(profileId)
    const selectedProfile = profiles.find(p => p.id === profileId)
    setCurrentProfile(selectedProfile || null)
    setShowProfileDropdown(false)
    
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }))
  }

  return (
    <div className="sticky top-0 z-40 bg-main-color shadow-sm border-b border-main-color-dark">
      <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4">
        {/* ヘッダーセクション */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-white/80 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* 右側のボタン群 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* プロファイル切り替え */}
            {showProfileSwitcher && (
              <div className="relative">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="inline-flex items-center px-3 py-2 text-sm bg-white/20 text-white hover:bg-white/30 rounded-md transition-colors backdrop-blur-sm"
                >
                  <span className="mr-2">{currentProfile?.icon || '⚙️'}</span>
                  <span className="hidden sm:inline mr-1">{currentProfile?.name || 'Profile'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50">
                    <div className="p-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">Switch Profile</div>
                      {profiles.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => handleProfileSwitch(profile.id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            currentProfile?.id === profile.id ? 'bg-main-color-bg text-main-color' : ''
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="mr-2">{profile.icon || '⚙️'}</span>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{profile.name}</div>
                              {profile.description && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{profile.description}</div>
                              )}
                            </div>
                            {profile.isDefault && (
                              <span className="ml-2 text-xs bg-main-color text-white px-1 rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      <hr className="my-2 border-gray-200 dark:border-gray-600" />
                      <button
                        onClick={() => {
                          router.push('/profiles')
                          setShowProfileDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                      >
                        Manage Profiles...
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* フィルタボタン */}
            {showFilterButton && onFilterToggle && (
              <button
                onClick={onFilterToggle}
                className="inline-flex items-center px-3 py-2 text-sm bg-white/20 text-white hover:bg-white/30 rounded-md transition-colors backdrop-blur-sm"
              >
                <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
                <span className="hidden sm:inline">{filterButtonText}</span>
              </button>
            )}

            {/* 新しいセッションボタン */}
            {showNewSessionButton && onNewSession && (
              <button
                onClick={onNewSession}
                className="inline-flex items-center px-4 py-2 bg-white text-main-color hover:bg-white/90 font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-main-color"
              >
                <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">新しいセッション</span>
                <span className="sm:hidden">新規</span>
              </button>
            )}

            {/* 設定ボタン */}
            {showSettingsButton && (
              <button
                onClick={() => router.push('/settings')}
                className="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition-colors"
                title="設定"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 追加コンテンツ */}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}