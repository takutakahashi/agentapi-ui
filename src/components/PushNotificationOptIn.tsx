'use client';

import { useState, useEffect } from 'react';
import { pushNotificationSettings } from '@/lib/pushNotificationSettings';
import { PushNotificationManager } from '@/utils/pushNotification';

export default function PushNotificationOptIn() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manager] = useState(() => new PushNotificationManager());

  useEffect(() => {
    // ブラウザサポート確認
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    // 現在の設定状態
    setIsEnabled(pushNotificationSettings.isEnabled());
    
    // 通知許可状態確認
    if (supported && 'Notification' in window) {
      setHasPermission(Notification.permission === 'granted');
    }
  }, []);

  const handleOptIn = async () => {
    setLoading(true);
    try {
      const result = await manager.enableOneClick();
      if (result.success) {
        setIsEnabled(true);
        setHasPermission(true);
        pushNotificationSettings.setAutoSubscribe(true); // 明示的な有効化時のみ自動購読を有効に
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('プッシュ通知有効化エラー:', error);
      alert('プッシュ通知の有効化に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleOptOut = async () => {
    setLoading(true);
    try {
      const result = await manager.disableOneClick();
      if (result.success) {
        setIsEnabled(false);
        pushNotificationSettings.setAutoSubscribe(false); // 無効化時は自動購読も無効に
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('プッシュ通知無効化エラー:', error);
      alert('プッシュ通知の無効化に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">
          お使いのブラウザはプッシュ通知をサポートしていません
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-2">プッシュ通知設定</h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {isEnabled ? '✅ 有効' : '🔕 無効'}
            </p>
            <p className="text-sm text-gray-600">
              AgentAPIからの通知を受け取る
            </p>
          </div>
          
          {!isEnabled ? (
            <button
              onClick={handleOptIn}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? '設定中...' : '有効にする'}
            </button>
          ) : (
            <button
              onClick={handleOptOut}
              disabled={loading}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? '設定中...' : '無効にする'}
            </button>
          )}
        </div>

        {isEnabled && (
          <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
            ✅ プッシュ通知が有効です。AgentAPIの処理完了時に通知を受け取れます。
          </div>
        )}

        {!hasPermission && !isEnabled && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ 通知を受け取るには、ブラウザの通知許可が必要です。
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <details>
          <summary className="cursor-pointer">技術的な詳細</summary>
          <ul className="mt-2 space-y-1">
            <li>• Service Workerを使用してバックグラウンド通知を実現</li>
            <li>• サーバーとの重複subscription自動検出</li>
            <li>• 無効なsubscriptionの自動クリーンアップ</li>
            <li>• ログアウト時の自動削除</li>
          </ul>
        </details>
      </div>
    </div>
  );
}