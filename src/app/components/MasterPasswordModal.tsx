'use client';

import React, { useState, useEffect } from 'react';
import { MasterPasswordManager } from '../../utils/masterPasswordManager';
import { CryptoStorage } from '../../utils/cryptoStorage';

interface MasterPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: () => void;
  mode: 'setup' | 'unlock';
}

export function MasterPasswordModal({ 
  isOpen, 
  onClose, 
  onUnlock, 
  mode 
}: MasterPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'setup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        const validation = CryptoStorage.validatePasswordStrength(password);
        if (!validation.isValid) {
          setError(validation.errors[0]);
          return;
        }

        // 暗号化を有効化
        await CryptoStorage.enableEncryption();
        await MasterPasswordManager.setMasterPassword(password);
        onUnlock();
        onClose();
      } else {
        const success = await MasterPasswordManager.unlockWithPassword(password);
        if (success) {
          onUnlock();
          onClose();
        } else {
          setError('Invalid password');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (mode === 'setup') {
      // Setup時はキャンセルで暗号化を無効にする
      await CryptoStorage.disableEncryption();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          {mode === 'setup' ? 'セキュア暗号化の設定' : 'マスターパスワード入力'}
        </h2>
        
        {mode === 'setup' && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              セキュリティ強化機能
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              プロファイルのAPIキーをブラウザ内で安全に暗号化保存します。
              マスターパスワードを設定することで、データが暗号化されて保護されます。
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {mode === 'setup' ? 'マスターパスワード' : 'パスワード'}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder={mode === 'setup' ? '最低8文字、大小英数字と記号を含む' : 'マスターパスワードを入力'}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                disabled={isLoading}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {mode === 'setup' && (
            <div className="mb-4">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                パスワード確認
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="パスワードを再入力"
                required
                disabled={isLoading}
              />
            </div>
          )}

          {mode === 'setup' && (
            <div className="mb-4 text-xs text-gray-600 dark:text-gray-400">
              <p className="mb-1">パスワード要件:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>最低8文字</li>
                <li>大文字・小文字を含む</li>
                <li>数字を含む</li>
                <li>特殊記号を含む</li>
              </ul>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              disabled={isLoading}
            >
              {mode === 'setup' ? 'スキップ' : 'キャンセル'}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:bg-blue-400"
              disabled={isLoading || !password || (mode === 'setup' && !confirmPassword)}
            >
              {isLoading ? '処理中...' : mode === 'setup' ? '暗号化を有効にする' : 'アンロック'}
            </button>
          </div>
        </form>

        {mode === 'setup' && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              <strong>重要:</strong> マスターパスワードを忘れると、暗号化されたデータは復元できません。
              安全な場所に保管してください。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface EncryptionPromptProps {
  onEnableEncryption: () => void;
  onSkip: () => void;
}

export function EncryptionPrompt({ onEnableEncryption, onSkip }: EncryptionPromptProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          セキュリティ強化のお知らせ
        </h2>
        
        <div className="mb-6">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mr-3">
              <span className="text-green-600 dark:text-green-400">🔒</span>
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white">
              暗号化ストレージ機能が利用可能です
            </h3>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            プロファイルのAPIキーとセンシティブな情報を、ブラウザ内で安全に暗号化して保存できます。
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">メリット:</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• APIキーの安全な保護</li>
              <li>• 不正アクセスからの防御</li>
              <li>• Web Crypto API による強固な暗号化</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            後で設定
          </button>
          <button
            onClick={onEnableEncryption}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            今すぐ設定
          </button>
        </div>
        
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          設定はいつでもプロファイル管理から変更できます
        </p>
      </div>
    </div>
  );
}