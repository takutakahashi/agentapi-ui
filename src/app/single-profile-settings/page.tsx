'use client';

import { useState, useEffect } from 'react';
import { isSingleProfileMode, getSingleProfileEnvironmentVariables } from '../../utils/singleProfileMode';
import { EnvironmentVariable } from '../../types/settings';
import { CookieStorage } from '../../utils/cookieStorage';

export default function SingleProfileSettingsPage() {
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSingleProfileMode()) {
      window.location.href = '/profiles';
      return;
    }
    
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      // Load environment variables from cookies
      const cookieEnvVars = CookieStorage.getGlobalEnvironmentVariables();
      const envVarsList: EnvironmentVariable[] = [];
      
      if (cookieEnvVars) {
        Object.entries(cookieEnvVars).forEach(([key, value]) => {
          envVarsList.push({ key, value, description: '' });
        });
      }
      
      // Add predefined environment variables from process.env
      const predefinedEnvVars = getSingleProfileEnvironmentVariables();
      Object.entries(predefinedEnvVars).forEach(([key, value]) => {
        const existingIndex = envVarsList.findIndex(env => env.key === key);
        if (existingIndex >= 0) {
          envVarsList[existingIndex].value = value;
        } else {
          envVarsList.push({ key, value, description: 'Predefined' });
        }
      });
      
      setEnvironmentVariables(envVarsList);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save environment variables to cookies
      const envVarsObj = environmentVariables.reduce((acc, env) => {
        if (env.key && env.value) {
          acc[env.key] = env.value;
        }
        return acc;
      }, {} as Record<string, string>);
      
      CookieStorage.setGlobalEnvironmentVariables(envVarsObj);
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEnvironmentVariable = () => {
    setEnvironmentVariables([...environmentVariables, { key: '', value: '', description: '' }]);
  };

  const handleRemoveEnvironmentVariable = (index: number) => {
    const newEnvVars = environmentVariables.filter((_, i) => i !== index);
    setEnvironmentVariables(newEnvVars);
  };

  const handleEnvironmentVariableChange = (index: number, field: keyof EnvironmentVariable, value: string) => {
    const newEnvVars = [...environmentVariables];
    newEnvVars[index] = { ...newEnvVars[index], [field]: value };
    setEnvironmentVariables(newEnvVars);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="text-lg text-gray-900 dark:text-white">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Environment Settings</h1>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-main-color hover:bg-main-color-dark disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-main-color"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Environment Variables</h2>
            <button
              onClick={handleAddEnvironmentVariable}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-green-500"
            >
              Add Variable
            </button>
          </div>

          <div className="space-y-4">
            {environmentVariables.map((envVar, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Key
                  </label>
                  <input
                    type="text"
                    value={envVar.key}
                    onChange={(e) => handleEnvironmentVariableChange(index, 'key', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-main-color bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="VARIABLE_NAME"
                    readOnly={envVar.description === 'Predefined'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    value={envVar.value}
                    onChange={(e) => handleEnvironmentVariableChange(index, 'value', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-main-color bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="variable_value"
                  />
                </div>
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={envVar.description || ''}
                      onChange={(e) => handleEnvironmentVariableChange(index, 'description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-main-color bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Description (optional)"
                      readOnly={envVar.description === 'Predefined'}
                    />
                  </div>
                  {envVar.description !== 'Predefined' && (
                    <button
                      onClick={() => handleRemoveEnvironmentVariable(index)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md transition-colors focus:ring-2 focus:ring-red-500"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}

            {environmentVariables.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-500 dark:text-gray-400 mb-4">
                  No environment variables configured
                </div>
                <button
                  onClick={handleAddEnvironmentVariable}
                  className="bg-main-color hover:bg-main-color-dark text-white px-4 py-2 rounded-lg transition-colors focus:ring-2 focus:ring-main-color"
                >
                  Add Your First Variable
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Note:</strong> Environment variables are stored securely in cookies and will be included in all agentapi-proxy sessions.
            </p>
            <p>
              Variables marked as &quot;Predefined&quot; are configured via server environment variables and cannot be removed from this interface.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}