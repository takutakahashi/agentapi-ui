'use client';

import { useEffect, useState } from 'react';
import { X, Info } from 'lucide-react';

const AUTH_BANNER_DISMISSED_KEY = 'agentapi-auth-banner-dismissed';

export const AuthNotificationBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // ローカルストレージから非表示設定をチェック
    const hasDismissed = localStorage.getItem(AUTH_BANNER_DISMISSED_KEY);
    
    if (!hasDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // 非表示設定をローカルストレージに保存
    localStorage.setItem(AUTH_BANNER_DISMISSED_KEY, 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-4 py-3">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
            認証について
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p>初めてご利用の場合は認証が必要です：</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Claude Max サブスクリプション</strong>: 初回のセッション起動時に認証を行います
              </li>
              <li>
                <strong>Amazon Bedrock</strong>: 設定画面から使用する推論プロファイルを入力する必要があります
              </li>
            </ul>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors p-1 flex-shrink-0"
          aria-label="お知らせを閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};