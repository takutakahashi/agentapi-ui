'use client';

import React, { useState, useEffect } from 'react';
import { CryptoUtils } from '../../utils/crypto';

interface PasswordModalProps {
  isOpen: boolean;
  onSuccess: ((password: string) => void) | ((currentPassword: string, newPassword: string) => void);
  onCancel: () => void;
  mode: 'setup' | 'login' | 'change';
  title?: string;
}

export default function PasswordModal({ 
  isOpen, 
  onSuccess, 
  onCancel, 
  mode, 
  title 
}: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{
    valid: boolean;
    message: string;
  }>({ valid: false, message: '' });

  useEffect(() => {
    if (password) {
      const strength = CryptoUtils.validatePassword(password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ valid: false, message: '' });
    }
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'setup' || mode === 'change') {
        if (password !== confirmPassword) {
          setError('パスワードが一致しません');
          return;
        }
        
        if (!passwordStrength.valid) {
          setError(passwordStrength.message);
          return;
        }
      }

      if (mode === 'change') {
        (onSuccess as (currentPassword: string, newPassword: string) => void)(currentPassword, password);
      } else {
        (onSuccess as (password: string) => void)(password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
    setError('');
    setPasswordStrength({ valid: false, message: '' });
    onCancel();
  };

  const getTitle = () => {
    if (title) return title;
    switch (mode) {
      case 'setup':
        return 'マスターパスワードの設定';
      case 'login':
        return 'マスターパスワードの入力';
      case 'change':
        return 'パスワードの変更';
      default:
        return 'パスワード';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'setup':
        return 'プロファイルデータを暗号化するためのマスターパスワードを設定してください。';
      case 'login':
        return 'プロファイルデータにアクセスするためのマスターパスワードを入力してください。';
      case 'change':
        return '現在のパスワードと新しいパスワードを入力してください。';
      default:
        return '';
    }
  };

  const getPasswordStrengthColor = () => {
    if (!password) return 'text-gray-400';
    if (passwordStrength.valid) return 'text-green-600';
    return 'text-red-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {getTitle()}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {getDescription()}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'change' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                現在のパスワード
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {mode === 'change' ? '新しいパスワード' : 'パスワード'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {(mode === 'setup' || mode === 'change') && password && (
              <p className={`text-xs mt-1 ${getPasswordStrengthColor()}`}>
                {passwordStrength.message}
              </p>
            )}
          </div>

          {(mode === 'setup' || mode === 'change') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                パスワードの確認
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? '処理中...' : '確認'}
            </button>
          </div>
        </form>

        {mode === 'setup' && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p>パスワードの要件:</p>
            <ul className="list-disc ml-4 mt-1">
              <li>8文字以上</li>
              <li>大文字、小文字、数字を含む</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}