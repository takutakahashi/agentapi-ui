'use client';

import { useState, useEffect } from 'react';
import { ProfileManager } from '../../utils/profileManager';
import { ProfileListItem } from '../../types/profile';
import { isSingleProfileModeEnabled } from '../../types/settings';
import Link from 'next/link';
import { useTheme } from '../../hooks/useTheme';
import EditProfileModal from '../components/EditProfileModal';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [singleProfileMode, setSingleProfileMode] = useState(false);
  const { updateThemeFromProfile } = useTheme();

  useEffect(() => {
    loadProfiles();
    ProfileManager.migrateExistingSettings();
    setSingleProfileMode(isSingleProfileModeEnabled());

    // Listen for Single Profile Mode changes
    const handleSingleProfileModeChange = () => {
      setSingleProfileMode(isSingleProfileModeEnabled());
    };
    
    window.addEventListener('storage', handleSingleProfileModeChange);
    
    return () => {
      window.removeEventListener('storage', handleSingleProfileModeChange);
    };
  }, []);

  const loadProfiles = () => {
    try {
      const profilesList = ProfileManager.getProfiles();
      setProfiles(profilesList);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (confirm('Are you sure you want to delete this profile?')) {
      try {
        ProfileManager.deleteProfile(profileId);
        loadProfiles();
      } catch (error) {
        console.error('Failed to delete profile:', error);
        alert('Failed to delete profile');
      }
    }
  };

  const handleSetDefault = (profileId: string) => {
    try {
      ProfileManager.setDefaultProfile(profileId);
      loadProfiles();
      // Update theme to new default profile
      updateThemeFromProfile(profileId);
    } catch (error) {
      console.error('Failed to set default profile:', error);
      alert('Failed to set default profile');
    }
  };

  const handleExportProfile = (profileId: string) => {
    try {
      const exportData = ProfileManager.exportProfile(profileId);
      if (!exportData) {
        alert('Failed to export profile');
        return;
      }

      const profile = ProfileManager.getProfile(profileId);
      const fileName = `profile-${profile?.name || 'unknown'}.json`;
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export profile:', error);
      alert('Failed to export profile');
    }
  };

  const handleImportProfile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = e.target?.result as string;
          const importedProfile = ProfileManager.importProfile(jsonData);
          if (importedProfile) {
            loadProfiles();
            alert(`Profile "${importedProfile.name}" imported successfully!`);
          } else {
            alert('Failed to import profile. Please check the file format.');
          }
        } catch (error) {
          console.error('Failed to import profile:', error);
          alert('Failed to import profile. Please check the file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleEditProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setSelectedProfileId('');
  };

  const handleProfileUpdated = () => {
    loadProfiles();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-lg text-gray-900 dark:text-white">Loading profiles...</div>
      </div>
    );
  }

  // If Single Profile Mode is enabled, show restricted message
  if (singleProfileMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m10-5a9 9 0 10-18 0 9 9 0 0018 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Single Profile Mode が有効です
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Single Profile Mode が有効な場合、プロファイルの作成・編集・削除機能は利用できません。
              グローバル設定でAPIキーと環境変数を管理します。
            </p>
            <div className="space-y-3">
              <Link
                href="/settings"
                className="inline-block bg-main-color hover:bg-main-color-dark text-white px-6 py-3 rounded-lg transition-colors focus:ring-2 focus:ring-main-color"
              >
                設定画面へ
              </Link>
              <div>
                <Link
                  href="/"
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
                >
                  ホームに戻る
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profiles</h1>
        <div className="flex space-x-2">
          <button
            onClick={handleImportProfile}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-green-500"
          >
            Import Profile
          </button>
          <Link
            href="/profiles/new"
            className="bg-main-color hover:bg-main-color-dark text-white px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-main-color"
          >
            New Profile
          </Link>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400 mb-4">No profiles found</div>
          <Link
            href="/profiles/new"
            className="bg-main-color hover:bg-main-color-dark text-white px-6 py-3 rounded-lg transition-colors focus:ring-2 focus:ring-main-color"
          >
            Create Your First Profile
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-2 ${
                profile.isDefault ? 'border-main-color' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{profile.icon || '⚙️'}</span>
                    {profile.mainColor && (
                      <div 
                        className="profile-color-indicator"
                        style={{ backgroundColor: profile.mainColor }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{profile.name}</h3>
                    {profile.description && (
                      <p className="text-gray-600 dark:text-gray-300 text-sm">{profile.description}</p>
                    )}
                  </div>
                </div>
                {profile.isDefault && (
                  <span className="bg-main-color-bg text-main-color text-xs px-2 py-1 rounded-full font-medium">
                    Default
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                <div>Repositories: {profile.repositoryCount}</div>
                {profile.lastUsed && (
                  <div>Last used: {new Date(profile.lastUsed).toLocaleDateString()}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleEditProfile(profile.id)}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded text-center text-sm transition-colors"
                >
                  編集
                </button>
                <Link
                  href={`/profiles/templates?profileId=${profile.id}`}
                  className="bg-main-color-bg hover:bg-main-color text-main-color hover:text-white px-3 py-2 rounded text-center text-sm transition-colors"
                >
                  Templates
                </Link>
                <button
                  onClick={() => handleExportProfile(profile.id)}
                  className="bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-700 dark:text-purple-200 px-3 py-2 rounded text-sm transition-colors"
                >
                  Export
                </button>
                {!profile.isDefault && (
                  <button
                    onClick={() => handleSetDefault(profile.id)}
                    className="bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800 text-green-700 dark:text-green-200 px-3 py-2 rounded text-sm transition-colors focus:ring-2 focus:ring-green-500"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDeleteProfile(profile.id)}
                  className="bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-200 px-3 py-2 rounded text-sm transition-colors"
                  disabled={profile.isDefault}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EditProfileModal
        isOpen={editModalOpen}
        onClose={handleCloseEditModal}
        profileId={selectedProfileId}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}