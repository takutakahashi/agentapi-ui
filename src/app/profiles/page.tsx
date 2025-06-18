'use client';

import { useState, useEffect } from 'react';
import { ProfileManager } from '../../utils/profileManager';
import { ProfileListItem } from '../../types/profile';
import Link from 'next/link';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
    ProfileManager.migrateExistingSettings();
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
    } catch (error) {
      console.error('Failed to set default profile:', error);
      alert('Failed to set default profile');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading profiles...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Profiles</h1>
        <Link
          href="/profiles/new"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          New Profile
        </Link>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No profiles found</div>
          <Link
            href="/profiles/new"
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Create Your First Profile
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`bg-white rounded-lg shadow-md p-6 border-2 ${
                profile.isDefault ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{profile.icon || '⚙️'}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{profile.name}</h3>
                    {profile.description && (
                      <p className="text-gray-600 text-sm">{profile.description}</p>
                    )}
                  </div>
                </div>
                {profile.isDefault && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    Default
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-500 mb-4">
                <div>Repositories: {profile.repositoryCount}</div>
                {profile.lastUsed && (
                  <div>Last used: {new Date(profile.lastUsed).toLocaleDateString()}</div>
                )}
              </div>

              <div className="flex space-x-2">
                <Link
                  href={`/profiles/${profile.id}/edit`}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-center text-sm transition-colors"
                >
                  Edit
                </Link>
                {!profile.isDefault && (
                  <button
                    onClick={() => handleSetDefault(profile.id)}
                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-2 rounded text-sm transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDeleteProfile(profile.id)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded text-sm transition-colors"
                  disabled={profile.isDefault}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}