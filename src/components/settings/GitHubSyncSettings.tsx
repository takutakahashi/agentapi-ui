'use client';

import React, { useState } from 'react';
import { GitSyncConfig, GitSyncEncryptionConfig } from '@/types/settings';

interface GitHubSyncSettingsProps {
  config?: GitSyncConfig;
  settingsName: string;
  onChange: (config: GitSyncConfig | undefined) => void;
  onPush?: () => Promise<void>;
  onPull?: () => Promise<void>;
}

const defaultConfig = (): GitSyncConfig => ({
  enabled: false,
  repo_full_name: '',
  branch: 'main',
  root_path: 'agentapi-config/',
  auto_push: false,
  github_token: '',
  encryption: {
    kms_key_arn: '',
    aws_region: 'ap-northeast-1',
  },
});

export function GitHubSyncSettings({
  config,
  onChange,
  onPush,
  onPull,
}: GitHubSyncSettingsProps) {
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushResult, setPushResult] = useState<'success' | 'error' | null>(null);
  const [pullResult, setPullResult] = useState<'success' | 'error' | null>(null);

  const current = config ?? defaultConfig();

  const handleChange = <K extends keyof GitSyncConfig>(field: K, value: GitSyncConfig[K]) => {
    onChange({ ...current, [field]: value });
  };

  const handleEncryptionChange = <K extends keyof GitSyncEncryptionConfig>(
    field: K,
    value: GitSyncEncryptionConfig[K]
  ) => {
    onChange({
      ...current,
      encryption: { ...(current.encryption ?? {}), [field]: value },
    });
  };

  const handleEnabledToggle = () => {
    if (!current.enabled && !config) {
      onChange(defaultConfig());
    } else {
      handleChange('enabled', !current.enabled);
    }
  };

  const handlePush = async () => {
    if (!onPush) return;
    setPushing(true);
    setPushResult(null);
    try {
      await onPush();
      setPushResult('success');
    } catch {
      setPushResult('error');
    } finally {
      setPushing(false);
      setTimeout(() => setPushResult(null), 3000);
    }
  };

  const handlePull = async () => {
    if (!onPull) return;
    setPulling(true);
    setPullResult(null);
    try {
      await onPull();
      setPullResult('success');
    } catch {
      setPullResult('error');
    } finally {
      setPulling(false);
      setTimeout(() => setPullResult(null), 3000);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        設定・スケジュール・Webhook・Slackbot・ファイルを GitHub リポジトリに双方向同期します。
        秘匿情報は AWS KMS で暗号化されてからリポジトリに保存されます。
      </p>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={current.enabled}
          onClick={handleEnabledToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            current.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              current.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          GitHub Sync を有効にする
        </span>
      </label>

      {current.enabled && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Repository */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              リポジトリ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={current.repo_full_name}
              onChange={(e) => handleChange('repo_full_name', e.target.value)}
              placeholder="owner/repo"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Branch */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              ブランチ
            </label>
            <input
              type="text"
              value={current.branch}
              onChange={(e) => handleChange('branch', e.target.value)}
              placeholder="main"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Root path */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              ルートパス
            </label>
            <input
              type="text"
              value={current.root_path}
              onChange={(e) => handleChange('root_path', e.target.value)}
              placeholder="agentapi-config/"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              リポジトリ内でファイルを配置するパス（末尾の / を含む）
            </p>
          </div>

          {/* GitHub Token */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={current.github_token ?? ''}
              onChange={(e) => handleChange('github_token', e.target.value)}
              placeholder="github_pat_..."
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              リポジトリへの read/write 権限が必要です。空欄の場合は変更しません。
            </p>
          </div>

          {/* Auto push */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={current.auto_push}
              onChange={(e) => handleChange('auto_push', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">自動プッシュ</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">変更時に自動でリポジトリへ同期します</p>
            </div>
          </label>

          {/* Encryption section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3 space-y-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              暗号化設定 (AWS KMS)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              秘匿情報は AES-256-GCM で暗号化されます。KMS キーが未設定の場合は暗号化が無効になります。
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                KMS Key ARN
              </label>
              <input
                type="text"
                value={current.encryption?.kms_key_arn ?? ''}
                onChange={(e) => handleEncryptionChange('kms_key_arn', e.target.value)}
                placeholder="arn:aws:kms:ap-northeast-1:123456789012:key/..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                AWS リージョン
              </label>
              <input
                type="text"
                value={current.encryption?.aws_region ?? ''}
                onChange={(e) => handleEncryptionChange('aws_region', e.target.value)}
                placeholder="ap-northeast-1"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Push / Pull actions */}
          {(onPush || onPull) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                手動同期
              </p>
              <div className="flex gap-3">
                {onPush && (
                  <button
                    type="button"
                    onClick={handlePush}
                    disabled={pushing || !current.repo_full_name}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                  >
                    {pushing ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    Push
                  </button>
                )}
                {onPull && (
                  <button
                    type="button"
                    onClick={handlePull}
                    disabled={pulling || !current.repo_full_name}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                  >
                    {pulling ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0l4 4m-4-4H20" />
                      </svg>
                    )}
                    Pull
                  </button>
                )}
              </div>
              <div className="mt-2 h-5">
                {pushResult === 'success' && (
                  <p className="text-xs text-green-600 dark:text-green-400">Push が完了しました</p>
                )}
                {pushResult === 'error' && (
                  <p className="text-xs text-red-600 dark:text-red-400">Push に失敗しました</p>
                )}
                {pullResult === 'success' && (
                  <p className="text-xs text-green-600 dark:text-green-400">Pull が完了しました</p>
                )}
                {pullResult === 'error' && (
                  <p className="text-xs text-red-600 dark:text-red-400">Pull に失敗しました</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
