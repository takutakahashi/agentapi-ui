'use client';

import { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

const AUTH_TOAST_SHOWN_KEY = 'agentapi-auth-toast-shown';

export const AuthNotificationToast: React.FC = () => {
  const { showToast } = useToast();

  useEffect(() => {
    // セッションストレージから表示済みフラグをチェック
    const hasShownToast = sessionStorage.getItem(AUTH_TOAST_SHOWN_KEY);
    
    if (!hasShownToast) {
      // 初回アクセス時にトーストを表示
      showToast(
        '初めてご利用の場合は認証が必要です。新規セッション起動時に認証方法の案内が表示されます。',
        'info',
        8000 // 8秒間表示
      );
      
      // 表示済みフラグをセッションストレージに保存
      sessionStorage.setItem(AUTH_TOAST_SHOWN_KEY, 'true');
    }
  }, [showToast]);

  return null;
};