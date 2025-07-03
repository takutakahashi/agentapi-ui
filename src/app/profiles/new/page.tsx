'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileManager } from '../../../utils/profileManager';
import { CreateProfileRequest } from '../../../types/profile';
import { getDefaultSettings, getDefaultProxySettings } from '../../../types/settings';
import EncryptedField from '../../../components/EncryptedField';

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

export default function NewProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateProfileRequest>(() => {
    const defaultSettings = getDefaultSettings();
    const defaultProxySettings = getDefaultProxySettings();
    return {
      name: '',
      description: '',
      icon: '⚙️',
      mainColor: COLOR_OPTIONS[0],
      fixedOrganizations: [],
      agentApiProxy: defaultProxySettings,
      environmentVariables: defaultSettings.environmentVariables,
      isDefault: false,
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Profile name is required');
      return;
    }

    setLoading(true);
    try {
      ProfileManager.createProfile(formData);
      router.push('/profiles');
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/profiles');
  };

  const addEnvironmentVariable = () => {
    setFormData(prev => ({
      ...prev,
      environmentVariables: [
        ...prev.environmentVariables,
        { key: '', value: '', description: '' }
      ]
    }));
  };

  const removeEnvironmentVariable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      environmentVariables: prev.environmentVariables.filter((_, i) => i !== index)
    }));
  };

  const updateEnvironmentVariable = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      environmentVariables: prev.environmentVariables.map((env, i) =>
        i === index ? { ...env, [field]: value } : env
      )
    }));
  };

  const addFixedOrganization = () => {
    setFormData(prev => ({
      ...prev,
      fixedOrganizations: [...prev.fixedOrganizations, '']
    }));
  };

  const removeFixedOrganization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fixedOrganizations: prev.fixedOrganizations.filter((_, i) => i !== index)
    }));
  };

  const updateFixedOrganization = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      fixedOrganizations: prev.fixedOrganizations.map((org, i) =>
        i === index ? value : org
      )
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Create New Profile</h1>
        <p className="text-gray-600 dark:text-gray-300">Configure a new profile for your agentapi connections</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Profile Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter profile name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter profile description"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                System Prompt
              </label>
              <textarea
                value={formData.systemPrompt || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter system prompt that will be sent at the beginning of each session"
                rows={4}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                This prompt will be sent automatically when starting a new session with this profile.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Fixed Organizations
                </label>
                <button
                  type="button"
                  onClick={addFixedOrganization}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  Add Organization
                </button>
              </div>
              <div className="space-y-2">
                {formData.fixedOrganizations.map((org, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={org}
                      onChange={(e) => updateFixedOrganization(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="例: owner"
                    />
                    <button
                      type="button"
                      onClick={() => removeFixedOrganization(index)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {formData.fixedOrganizations.length === 0 && (
                  <div className="text-gray-500 dark:text-gray-400 text-sm">No fixed organizations configured</div>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                このプロファイルで使用できる組織を指定します。指定すると、セッション作成時にこれらの組織から選択し、リポジトリ名を自由に入力できます。
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon
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
                Main Color
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
                This color will be used as an accent throughout the UI when this profile is active.
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700 dark:text-gray-300">
                Set as default profile
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">AgentAPI Proxy Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Endpoint URL *
              </label>
              <input
                type="url"
                value={formData.agentApiProxy.endpoint}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  agentApiProxy: { ...prev.agentApiProxy, endpoint: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="http://localhost:8080"
                required
              />
            </div>

            <EncryptedField
              label="API Key"
              value={formData.agentApiProxy.apiKey}
              onChange={(value) => setFormData(prev => ({
                ...prev,
                agentApiProxy: { ...prev.agentApiProxy, apiKey: value }
              }))}
              placeholder="Enter API key"
              description="API key for authenticating with the AgentAPI proxy"
              proxyEndpoint={formData.agentApiProxy.endpoint}
              autoEncrypt={true}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={formData.agentApiProxy.timeout}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  agentApiProxy: { ...prev.agentApiProxy, timeout: parseInt(e.target.value) }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                min="1000"
                max="300000"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.agentApiProxy.enabled}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  agentApiProxy: { ...prev.agentApiProxy, enabled: e.target.checked }
                }))}
                className="mr-2"
              />
              <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                Enable proxy
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Environment Variables</h2>
            <button
              type="button"
              onClick={addEnvironmentVariable}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              Add Variable
            </button>
          </div>
          
          <div className="space-y-3">
            {formData.environmentVariables.map((env, index) => (
              <div key={index} className="flex gap-2 items-start">
                <input
                  type="text"
                  placeholder="Key"
                  value={env.key}
                  onChange={(e) => updateEnvironmentVariable(index, 'key', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={env.value}
                  onChange={(e) => updateEnvironmentVariable(index, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={env.description || ''}
                  onChange={(e) => updateEnvironmentVariable(index, 'description', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeEnvironmentVariable(index)}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            {formData.environmentVariables.length === 0 && (
              <div className="text-gray-500 dark:text-gray-400 text-sm">No environment variables configured</div>
            )}
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}