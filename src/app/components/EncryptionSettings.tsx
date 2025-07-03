'use client';

import React, { useState, useEffect } from 'react';
import { ProfileManager } from '../../utils/profileManager';
import { EncryptionSettings as IEncryptionSettings, PasswordChangeResult } from '../../utils/encryptedProfileManager';
import { EncryptionUtil } from '../../utils/encryption';

/**
 * 暗号化設定コンポーネント
 */
export default function EncryptionSettings() {
  const [settings, setSettings] = useState<IEncryptionSettings>({
    enabled: false,
    encryptedDataTypes: []
  });
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{ strength: string; errors: string[] }>({ strength: 'weak', errors: [] });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (newPassword) {
      const validation = EncryptionUtil.validatePassword(newPassword);
      setPasswordStrength({
        strength: validation.strength,
        errors: validation.errors
      });
    } else {
      setPasswordStrength({ strength: 'weak', errors: [] });
    }
  }, [newPassword]);

  const loadSettings = async () => {
    try {
      const encryptionSettings = await ProfileManager.getEncryptionSettings();
      setSettings(encryptionSettings);
      setIsUnlocked(ProfileManager.isUnlocked());
      setPasswordHint(encryptionSettings.passwordHint || '');
    } catch {
      setMessage({ type: 'error', text: '暗号化設定の読み込みに失敗しました。' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password) {
      setMessage({ type: 'error', text: 'パスワードを入力してください。' });
      return;
    }

    setLoading(true);
    try {
      const success = await ProfileManager.unlock(password);
      if (success) {
        setIsUnlocked(true);
        setPassword('');
        setMessage({ type: 'success', text: '暗号化がアンロックされました。' });
      } else {
        setMessage({ type: 'error', text: 'パスワードが正しくありません。' });
      }
    } catch {
      setMessage({ type: 'error', text: 'アンロックに失敗しました。' });
    } finally {
      setLoading(false);
    }
  };

  const handleLock = () => {
    ProfileManager.lock();
    setIsUnlocked(false);
    setPassword('');
    setMessage({ type: 'info', text: '暗号化がロックされました。' });
  };

  const handleEnableEncryption = async () => {
    if (!newPassword) {
      setMessage({ type: 'error', text: 'パスワードを入力してください。' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません。' });
      return;
    }

    const validation = EncryptionUtil.validatePassword(newPassword);
    if (!validation.valid) {
      setMessage({ type: 'error', text: validation.errors.join('\n') });
      return;
    }

    setLoading(true);
    try {
      // 既存データがある場合は移行を実行
      const profiles = await ProfileManager.getProfiles();
      let result: PasswordChangeResult | undefined;

      if (profiles.length > 0) {
        result = await ProfileManager.migrateToEncryption(newPassword);
        if (!result.success) {
          throw result.error;
        }
      } else {
        await ProfileManager.enableEncryption(newPassword, {
          encryptedDataTypes: ['profiles'],
          passwordHint
        });
      }

      await loadSettings();
      setIsUnlocked(true);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordHint('');

      const migrationMessage = result 
        ? `暗号化が有効になりました。${result.migrated}個のプロファイルが移行されました。`
        : '暗号化が有効になりました。';
      
      setMessage({ type: 'success', text: migrationMessage });
    } catch {
      setMessage({ type: 'error', text: '暗号化の有効化に失敗しました。' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableEncryption = async () => {
    if (!window.confirm('暗号化を無効にしますか？データは暗号化されなくなります。')) {
      return;
    }

    setLoading(true);
    try {
      await ProfileManager.disableEncryption();
      await loadSettings();
      setIsUnlocked(false);
      setMessage({ type: 'info', text: '暗号化が無効になりました。' });
    } catch {
      setMessage({ type: 'error', text: '暗号化の無効化に失敗しました。' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!password || !newPassword) {
      setMessage({ type: 'error', text: '現在のパスワードと新しいパスワードを入力してください。' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'パスワードが一致しません。' });
      return;
    }

    const validation = EncryptionUtil.validatePassword(newPassword);
    if (!validation.valid) {
      setMessage({ type: 'error', text: validation.errors.join('\n') });
      return;
    }

    setLoading(true);
    try {
      const result = await ProfileManager.changePassword(password, newPassword);
      if (result.success) {
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMessage({ 
          type: 'success', 
          text: `パスワードが変更されました。${result.migrated}個のプロファイルが更新されました。` 
        });
      } else {
        throw result.error;
      }
    } catch {
      setMessage({ type: 'error', text: 'パスワードの変更に失敗しました。現在のパスワードを確認してください。' });
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const generated = EncryptionUtil.generateSecurePassword(16);
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPasswordGenerator(false);
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'weak': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'strong': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStrengthText = (strength: string) => {
    switch (strength) {
      case 'weak': return '弱い';
      case 'medium': return '普通';
      case 'strong': return '強い';
      default: return '不明';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3">読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">暗号化設定</h2>

      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
          'bg-blue-50 text-blue-800 border border-blue-200'
        }`}>
          {message.text.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {/* 暗号化状態 */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">現在の状態</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="w-24">暗号化:</span>
              <span className={`font-medium ${settings.enabled ? 'text-green-600' : 'text-gray-600'}`}>
                {settings.enabled ? '有効' : '無効'}
              </span>
            </div>
            {settings.enabled && (
              <div className="flex items-center">
                <span className="w-24">ロック状態:</span>
                <span className={`font-medium ${isUnlocked ? 'text-green-600' : 'text-red-600'}`}>
                  {isUnlocked ? 'アンロック済み' : 'ロック中'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 暗号化が無効の場合 */}
        {!settings.enabled && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">暗号化を有効にする</h3>
            <p className="text-gray-600 mb-4">
              プロファイルデータを暗号化して保存します。パスワードを忘れると、データにアクセスできなくなりますのでご注意ください。
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">新しいパスワード</label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="8文字以上のパスワード"
                  />
                  <button
                    onClick={() => setShowPasswordGenerator(!showPasswordGenerator)}
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    生成
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className={`text-sm ${getStrengthColor(passwordStrength.strength)}`}>
                      強度: {getStrengthText(passwordStrength.strength)}
                    </div>
                    {passwordStrength.errors.length > 0 && (
                      <div className="text-sm text-red-600 mt-1">
                        {passwordStrength.errors.map((error, i) => (
                          <div key={i}>• {error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">パスワード確認</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="パスワードを再入力"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">パスワードヒント（オプション）</label>
                <input
                  type="text"
                  value={passwordHint}
                  onChange={(e) => setPasswordHint(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="パスワードを思い出すためのヒント"
                />
              </div>

              {showPasswordGenerator && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800 mb-3">
                    セキュアなパスワードを自動生成します
                  </p>
                  <button
                    onClick={generatePassword}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    パスワードを生成
                  </button>
                </div>
              )}

              <button
                onClick={handleEnableEncryption}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                暗号化を有効にする
              </button>
            </div>
          </div>
        )}

        {/* 暗号化が有効でロック中の場合 */}
        {settings.enabled && !isUnlocked && (
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold mb-4">アンロック</h3>
            <p className="text-gray-600 mb-4">
              暗号化されたデータにアクセスするには、パスワードを入力してください。
            </p>
            
            {settings.passwordHint && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-sm text-yellow-800">
                  <strong>ヒント:</strong> {settings.passwordHint}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">パスワード</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="パスワードを入力"
                />
              </div>

              <button
                onClick={handleUnlock}
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                アンロック
              </button>
            </div>
          </div>
        )}

        {/* 暗号化が有効でアンロック済みの場合 */}
        {settings.enabled && isUnlocked && (
          <div className="space-y-6">
            {/* ロック */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4">ロック</h3>
              <p className="text-gray-600 mb-4">
                暗号化をロックして、データへのアクセスを制限します。
              </p>
              <button
                onClick={handleLock}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                ロック
              </button>
            </div>

            {/* パスワード変更 */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4">パスワード変更</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">現在のパスワード</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">新しいパスワード</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {newPassword && (
                    <div className="mt-2">
                      <div className={`text-sm ${getStrengthColor(passwordStrength.strength)}`}>
                        強度: {getStrengthText(passwordStrength.strength)}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">新しいパスワード確認</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  パスワードを変更
                </button>
              </div>
            </div>

            {/* 暗号化を無効にする */}
            <div className="border border-red-200 rounded-lg p-6">
              <h3 className="font-semibold mb-4 text-red-800">暗号化を無効にする</h3>
              <p className="text-red-600 mb-4">
                ⚠️ 暗号化を無効にすると、データは暗号化されなくなります。この操作は慎重に行ってください。
              </p>
              <button
                onClick={handleDisableEncryption}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                暗号化を無効にする
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}