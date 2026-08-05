'use client';

import React, { useState } from 'react';
import { GitSyncConfig } from '@/types/settings';

interface GitHubSyncSettingsProps {
  config?: GitSyncConfig;
  onSave: (config: GitSyncConfig) => Promise<void>;
  onDelete?: () => Promise<void>;
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
});

export function GitHubSyncSettings({
  config,
  onSave,
  onDelete,
  onPush,
  onPull,
}: GitHubSyncSettingsProps) {
  const [local, setLocal] = useState<GitSyncConfig>(() => config ?? defaultConfig());
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  const [pushResult, setPushResult] = useState<'success' | 'error' | null>(null);
  const [pullResult, setPullResult] = useState<'success' | 'error' | null>(null);
  const [tokenChanged, setTokenChanged] = useState(false);

  const handleChange = <K extends keyof GitSyncConfig>(field: K, value: GitSyncConfig[K]) => {
    setLocal((prev) => ({ ...prev, [field]: value }));
  };

  const handleTokenChange = (value: string) => {
    setLocal((prev) => ({ ...prev, github_token: value }));
    setTokenChanged(true);
  };

  const handleEnabledToggle = () => {
    setLocal((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      // トークンが変更されていない場合は送信しない（サーバー側で既存トークンが保持される）
      const payload: GitSyncConfig = { ...local };
      if (!tokenChanged) {
        delete payload.github_token;
      }
      await onSave(payload);
      setSaveResult('success');
      setTokenChanged(false);
      // トークン送信後はフィールドをクリア（次回読み込み時は has_github_token で表示）
      if (tokenChanged && payload.github_token) {
        setLocal((prev) => ({ ...prev, github_token: '', has_github_token: true }));
      }
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3000);
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

  const isConfigured = !!config;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        設定・スケジュール・Webhook・Slackbot・ファイルを GitHub リポジトリに双方向同期します。
        秘匿情報はプロキシで設定された AWS KMS キーで暗号化されてから保存されます。
      </p>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={local.enabled}
          onClick={handleEnabledToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            local.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              local.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          GitHub Sync を有効にする
        </span>
      </label>

      {local.enabled && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Repository */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              リポジトリ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={local.repo_full_name}
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
              value={local.branch}
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
              value={local.root_path}
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
            {/* トークン設定済み表示 */}
            {(local.has_github_token && !tokenChanged) && (
              <div className="flex items-center gap-2 mb-2 text-xs text-green-600 dark:text-green-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                トークンが設定されています。変更する場合のみ入力してください。
              </div>
            )}
            <input
              type="password"
              value={local.github_token ?? ''}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder={local.has_github_token && !tokenChanged ? '（変更しない場合は空欄）' : 'github_pat_...'}
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
              checked={local.auto_push}
              onChange={(e) => handleChange('auto_push', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">自動プッシュ</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">変更時に自動でリポジトリへ同期します</p>
            </div>
          </label>

          {/* DEK status (read-only) */}
          {config?.encryption && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {config.encryption.dek_ready
                ? `暗号化キー (DEK) が設定されています (v${config.encryption.dek_version})`
                : '初回 Push 時に暗号化キーが自動生成されます'}
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !local.repo_full_name}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              {saving ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Sync 設定を保存
            </button>
            {saveResult === 'success' && (
              <span className="text-xs text-green-600 dark:text-green-400">保存しました</span>
            )}
            {saveResult === 'error' && (
              <span className="text-xs text-red-600 dark:text-red-400">保存に失敗しました</span>
            )}
          </div>

          {/* Push / Pull actions */}
          {isConfigured && (onPush || onPull) && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                手動同期
              </p>
              <div className="flex gap-3 items-center flex-wrap">
                {onPush && (
                  <button
                    type="button"
                    onClick={handlePush}
                    disabled={pushing}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
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
                    disabled={pulling}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                  >
                    {pulling ? (
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8v8m-4-4H4" />
                      </svg>
                    )}
                    Pull
                  </button>
                )}
                <div className="text-xs">
                  {pushResult === 'success' && <span className="text-green-600 dark:text-green-400">Push 完了</span>}
                  {pushResult === 'error' && <span className="text-red-600 dark:text-red-400">Push 失敗</span>}
                  {pullResult === 'success' && <span className="text-green-600 dark:text-green-400">Pull 完了</span>}
                  {pullResult === 'error' && <span className="text-red-600 dark:text-red-400">Pull 失敗</span>}
                </div>
              </div>
            </div>
          )}

          {/* Delete config */}
          {isConfigured && onDelete && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
              >
                Sync 設定を削除
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
