'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ProfileManager } from '../../utils/profileManager'
import { ProfileListItem } from '../../types/profile'
import { useTheme } from '../../hooks/useTheme'
import { isSingleProfileModeEnabled } from '../../types/settings'
import EditProfileModal from './EditProfileModal'

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
  const { updateThemeFromProfile } = useTheme()
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [currentProfile, setCurrentProfile] = useState<ProfileListItem | null>(null)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [singleProfileMode, setSingleProfileMode] = useState(false)
  const [userInfo, setUserInfo] = useState<{
    type: 'github' | 'api_key'
    user: {
      id?: number
      login?: string
      name?: string
      email?: string
      avatar_url?: string
      authenticated?: boolean
    }
  } | null>(null)

  const loadProfiles = useCallback(() => {
    ProfileManager.migrateExistingSettings()
    const profilesList = ProfileManager.getProfiles()
    setProfiles(profilesList)
    
    // Check URL parameters first, then fall back to default profile
    const currentProfileId = ProfileManager.getCurrentProfileId()
    let selectedProfile: ProfileListItem | null = null
    
    if (currentProfileId) {
      selectedProfile = profilesList.find(p => p.id === currentProfileId) || null
    } else if (profilesList.length > 0) {
      selectedProfile = profilesList[0]
    }
    
    setCurrentProfile(selectedProfile)
    
    // Update theme when profile is loaded
    if (selectedProfile) {
      updateThemeFromProfile(selectedProfile.id)
    }
  }, [updateThemeFromProfile])

  useEffect(() => {
    // Check Single Profile Mode status
    setSingleProfileMode(isSingleProfileModeEnabled())
    
    if (showProfileSwitcher) {
      loadProfiles()
      
      // Listen for URL changes (back/forward navigation)
      const handlePopState = () => {
        loadProfiles()
      }
      
      // Listen for Single Profile Mode changes
      const handleSingleProfileModeChange = () => {
        setSingleProfileMode(isSingleProfileModeEnabled())
      }
      
      // Load user info if in single profile mode
      const loadUserInfo = async () => {
        if (singleProfileMode) {
          try {
            const response = await fetch('/api/user/info')
            if (response.ok) {
              const data = await response.json()
              setUserInfo(data)
            }
          } catch (error) {
            console.error('Failed to load user info:', error)
          }
        }
      }
      
      loadUserInfo()
      
      window.addEventListener('popstate', handlePopState)
      window.addEventListener('storage', handleSingleProfileModeChange)
      
      return () => {
        window.removeEventListener('popstate', handlePopState)
        window.removeEventListener('storage', handleSingleProfileModeChange)
      }
    }
  }, [showProfileSwitcher, loadProfiles, singleProfileMode])

  const handleProfileSwitch = (profileId: string) => {
    ProfileManager.setProfileInUrl(profileId)
    ProfileManager.setDefaultProfile(profileId)
    const selectedProfile = profiles.find(p => p.id === profileId)
    setCurrentProfile(selectedProfile || null)
    setShowProfileDropdown(false)
    
    // Update theme when profile switches
    updateThemeFromProfile(profileId)
    
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profileId } }))
  }

  const handleEditProfile = (profileId: string) => {
    setSelectedProfileId(profileId)
    setEditModalOpen(true)
    setShowProfileDropdown(false)
  }

  const handleCloseEditModal = () => {
    setEditModalOpen(false)
    setSelectedProfileId('')
  }

  const handleProfileUpdated = () => {
    loadProfiles()
  }

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 relative">
      <div className="relative px-4 md:px-6 lg:px-8 py-3 md:py-4">
        {/* ヘッダーセクション */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          
          {/* 右側のボタン群 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* プロファイル切り替え */}
            {showProfileSwitcher && !singleProfileMode && (
              <div className="relative" data-testid="profile-switcher">
                <button
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="inline-flex items-center px-3 py-2 text-sm bg-main-color-bg text-main-color hover:bg-main-color hover:text-white rounded-md transition-colors border border-main-color"
                >
                  <span className="mr-2">{currentProfile?.icon || '⚙️'}</span>
                  <span className="hidden sm:inline mr-1">{currentProfile?.name || 'Profile'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showProfileDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50">
                    <div className="p-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">Switch Profile</div>
                      {profiles.map((profile) => (
                        <button
                          key={profile.id}
                          onClick={() => handleProfileSwitch(profile.id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            currentProfile?.id === profile.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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
                              <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1 rounded">
                                Default
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                      <hr className="my-2 border-gray-200 dark:border-gray-600" />
                      {currentProfile && (
                        <button
                          onClick={() => {
                            handleEditProfile(currentProfile.id)
                            setShowProfileDropdown(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                        >
                          Edit Current Profile
                        </button>
                      )}
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
                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
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
                className="inline-flex items-center px-4 py-2 bg-main-color-dark hover:bg-main-color text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-main-color focus:ring-offset-2 shadow-sm"
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
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="設定"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}

            {/* User info for single profile mode */}
            {singleProfileMode && userInfo && userInfo.type === 'github' && userInfo.user.avatar_url && (
              <div className="flex items-center space-x-2 px-2">
                <Image
                  src={userInfo.user.avatar_url}
                  alt={userInfo.user.login || 'User'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">
                  {userInfo.user.name || userInfo.user.login}
                </span>
              </div>
            )}

            {/* Logout button for single profile mode */}
            {singleProfileMode && (
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout', { method: 'POST' })
                    router.push('/login')
                  } catch (error) {
                    console.error('Logout failed:', error)
                    // Fallback to direct redirect if router fails
                    window.location.href = '/login'
                  }
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 追加コンテンツ */}
        {children && <div className="mt-3">{children}</div>}
      </div>

      <EditProfileModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        profileId={selectedProfileId}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  )
}