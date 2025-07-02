'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ProfileManager } from '../../utils/profileManager';
import { Profile, UpdateProfileRequest } from '../../types/profile';
import { OrganizationHistory, OrganizationRepositoryHistory } from '../../utils/organizationHistory';
import { GitHubAuthSettings } from '../../components/profiles/GitHubAuthSettings';

const EMOJI_OPTIONS = ['⚙️', '🔧', '💼', '🏠', '🏢', '🚀', '💻', '🔬', '🎯', '⭐', '🌟', '💡'];

const COLOR_OPTIONS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
  '#6B7280', // gray
  '#374151', // dark gray
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  onProfileUpdated: () => void;
}

export default function EditProfileModal({ isOpen, onClose, profileId, onProfileUpdated }: EditProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState<UpdateProfileRequest>({});
  const [organizationHistories, setOrganizationHistories] = useState<OrganizationRepositoryHistory[]>([]);
  const [showOrganizationHistories, setShowOrganizationHistories] = useState(false);
  const envScrollRef = useRef<HTMLDivElement>(null);
  const orgScrollRef = useRef<HTMLDivElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const loadedProfile = await ProfileManager.getProfile(profileId);
      if (!loadedProfile) {
        onClose();
        return;
      }
      setProfile(loadedProfile);
      setFormData({
        name: loadedProfile.name,
        description: loadedProfile.description,
        icon: loadedProfile.icon,
        mainColor: loadedProfile.mainColor,
        systemPrompt: loadedProfile.systemPrompt,
        fixedOrganizations: loadedProfile.fixedOrganizations || [],
        agentApiProxy: { ...loadedProfile.agentApiProxy },
        environmentVariables: [...loadedProfile.environmentVariables],
        isDefault: loadedProfile.isDefault,
      });
      
      // プロファイル固有の組織履歴を読み込み
      const orgHistories = OrganizationHistory.getAllOrganizationHistories(loadedProfile.id);
      // このプロファイルの固定組織に関連する履歴のみをフィルタ
      const relevantHistories = orgHistories.filter(orgHistory =>
        loadedProfile.fixedOrganizations.includes(orgHistory.organization)
      );
      setOrganizationHistories(relevantHistories);
    } catch (error) {
      console.error('Failed to load profile:', error);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [profileId, onClose]);

  useEffect(() => {
    if (isOpen && profileId) {
      loadProfile();
    }
  }, [isOpen, profileId, loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Profile name is required');
      return;
    }

    setSaving(true);
    try {
      ProfileManager.updateProfile(profileId, formData);
      onProfileUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const addEnvironmentVariable = () => {
    setFormData(prev => ({
      ...prev,
      environmentVariables: [
        ...(prev.environmentVariables || []),
        { key: '', value: '', description: '' }
      ]
    }));
    // 新しい環境変数を追加した後、スクロールを最下部に
    setTimeout(() => {
      if (envScrollRef.current) {
        envScrollRef.current.scrollTop = envScrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const removeEnvironmentVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      environmentVariables: (prev.environmentVariables || []).filter((_, i) => i !== index)
    }));
  };

  const updateEnvironmentVariable = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      environmentVariables: (prev.environmentVariables || []).map((env, i) =>
        i === index ? { ...env, [field]: value } : env
      )
    }));
  };

  const addFixedOrganization = () => {
    setFormData(prev => ({
      ...prev,
      fixedOrganizations: [...(prev.fixedOrganizations || []), '']
    }));
    // 新しい組織を追加した後、スクロールを最下部に
    setTimeout(() => {
      if (orgScrollRef.current) {
        orgScrollRef.current.scrollTop = orgScrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const removeFixedOrganization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fixedOrganizations: (prev.fixedOrganizations || []).filter((_, i) => i !== index)
    }));
  };

  const updateFixedOrganization = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      fixedOrganizations: (prev.fixedOrganizations || []).map((org, i) =>
        i === index ? value : org
      )
    }));
  };

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 md:p-6" onClick={handleBackgroundClick}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto md:max-h-[85vh]">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 md:px-6 md:py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">プロファイルを編集</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl p-2 -m-2"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-lg text-gray-900 dark:text-white">プロファイルを読み込み中...</div>
            </div>
          ) : !profile ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-lg text-gray-900 dark:text-white">プロファイルが見つかりません</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">基本情報</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      プロファイル名 *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      placeholder="プロファイル名を入力"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      説明
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      placeholder="プロファイルの説明を入力"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      システムプロンプト
                    </label>
                    <textarea
                      value={formData.systemPrompt || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      placeholder="各セッションの開始時に送信されるシステムプロンプトを入力"
                      rows={4}
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      このプロンプトはこのプロファイルで新しいセッションを開始する際に自動的に送信されます。
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        固定組織
                      </label>
                      <button
                        type="button"
                        onClick={addFixedOrganization}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        組織を追加
                      </button>
                    </div>
                    <div ref={orgScrollRef} className="max-h-48 overflow-y-auto space-y-2 pr-2">
                      {(formData.fixedOrganizations || []).map((org, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={org}
                            onChange={(e) => updateFixedOrganization(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                            placeholder="例: owner"
                          />
                          <button
                            type="button"
                            onClick={() => removeFixedOrganization(index)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition-colors flex-shrink-0"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {(!formData.fixedOrganizations || formData.fixedOrganizations.length === 0) && (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">固定組織が設定されていません</div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      このプロファイルで使用できる組織を指定します。指定すると、セッション作成時にこれらの組織から選択し、リポジトリ名を自由に入力できます。
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      アイコン
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                          className={`text-2xl p-2 rounded-md border-2 transition-colors ${
                            formData.icon === emoji
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      メインカラー
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, mainColor: color }))}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            formData.mainColor === color
                              ? 'border-gray-800 dark:border-white scale-110'
                              : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      このプロファイルがアクティブな時にUIのアクセントカラーとして使用されます。
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={formData.isDefault || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                      className="mr-2"
                    />
                    <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
                      デフォルトプロファイルに設定
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">AgentAPI プロキシ設定</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      エンドポイント URL *
                    </label>
                    <input
                      type="url"
                      value={formData.agentApiProxy?.endpoint || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agentApiProxy: { ...prev.agentApiProxy, endpoint: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      placeholder="http://localhost:8080"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API キー
                    </label>
                    <input
                      type="password"
                      value={formData.agentApiProxy?.apiKey || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agentApiProxy: { ...prev.agentApiProxy, apiKey: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      placeholder="API キーを入力"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      タイムアウト (ms)
                    </label>
                    <input
                      type="number"
                      value={formData.agentApiProxy?.timeout || 30000}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agentApiProxy: { ...prev.agentApiProxy, timeout: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      min="1000"
                      max="300000"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.agentApiProxy?.enabled ?? true}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        agentApiProxy: { ...prev.agentApiProxy, enabled: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                      プロキシを有効にする
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">環境変数</h3>
                  <button
                    type="button"
                    onClick={addEnvironmentVariable}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                  >
                    変数を追加
                  </button>
                </div>
                
                <div ref={envScrollRef} className="max-h-64 overflow-y-auto space-y-3 pr-2">
                  {(formData.environmentVariables || []).map((env, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="text"
                        placeholder="キー"
                        value={env.key}
                        onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="値"
                        value={env.value}
                        onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      />
                      <input
                        type="text"
                        placeholder="説明 (オプション)"
                        value={env.description || ''}
                        onChange={(e) => updateEnvironmentVariable(index, 'description', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvironmentVariable(index)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition-colors flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(formData.environmentVariables || []).length === 0 && (
                    <div className="text-gray-500 dark:text-gray-400 text-sm">環境変数が設定されていません</div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">リポジトリ履歴</h3>
                <div className="space-y-2">
                  {profile.repositoryHistory.length === 0 ? (
                    <div className="text-gray-500 dark:text-gray-400 text-sm">履歴がありません</div>
                  ) : (
                    profile.repositoryHistory.map((repo, index) => (
                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-600 rounded">
                        <span className="font-mono text-sm text-gray-900 dark:text-white">{repo.repository}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(repo.lastUsed).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 組織ごとの履歴セクション */}
              {profile.fixedOrganizations.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">組織別リポジトリ履歴</h3>
                    <button
                      type="button"
                      onClick={() => setShowOrganizationHistories(!showOrganizationHistories)}
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                    >
                      {showOrganizationHistories ? '非表示' : '表示'}
                    </button>
                  </div>
                  
                  {showOrganizationHistories && (
                    <div className="space-y-4">
                      {organizationHistories.length === 0 ? (
                        <div className="text-gray-500 dark:text-gray-400 text-sm">
                          組織固有のリポジトリ履歴がありません
                        </div>
                      ) : (
                        organizationHistories.map((orgHistory, orgIndex) => (
                          <div key={orgIndex} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <h4 className="text-lg font-medium mb-3 text-gray-900 dark:text-white flex items-center">
                              <span className="mr-2">🏢</span>
                              {orgHistory.organization}
                              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                ({orgHistory.repositories.length} リポジトリ)
                              </span>
                            </h4>
                            <div className="space-y-2">
                              {orgHistory.repositories.map((repo, repoIndex) => (
                                <div key={repoIndex} className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-600 rounded">
                                  <span className="font-mono text-sm text-gray-900 dark:text-white">{repo.repository}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(repo.lastUsed).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  OrganizationHistory.clearOrganizationHistory(profile.id, orgHistory.organization);
                                  // 履歴を再読み込み
                                  const orgHistories = OrganizationHistory.getAllOrganizationHistories(profile.id);
                                  const relevantHistories = orgHistories.filter(orgHistory =>
                                    profile.fixedOrganizations.includes(orgHistory.organization)
                                  );
                                  setOrganizationHistories(relevantHistories);
                                }}
                                className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 text-sm"
                              >
                                {orgHistory.organization} の履歴をクリア
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <GitHubAuthSettings profile={profile} onProfileUpdated={loadProfile} />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors font-medium"
                >
                  {saving ? '保存中...' : '変更を保存'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white py-3 px-4 rounded-lg transition-colors font-medium"
                >
                  キャンセル
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}