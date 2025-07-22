'use client';

import { useState } from 'react';

interface SubscriptionInfo {
  endpoint: string;
  userId?: string;
  userType?: string;
  createdAt?: string;
  lastValidated?: string;
  failureCount: number;
}

interface CleanupResult {
  beforeCount: number;
  afterCount: number;
  duplicatesRemoved: number;
  invalidRemoved: number;
  totalRemoved: number;
}

export default function SubscriptionManager() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/subscriptions/cleanup');
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
        setTotalCount(data.count || 0);
      }
    } catch (error) {
      console.error('Subscription取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const runCleanup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/subscriptions/cleanup', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setCleanupResult(data.cleanup);
        // クリーンアップ後に再取得
        await fetchSubscriptions();
      }
    } catch (error) {
      console.error('クリーンアップエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Subscription管理</h3>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={fetchSubscriptions}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '読み込み中...' : 'Subscription一覧取得'}
        </button>
        <button
          onClick={runCleanup}
          disabled={loading}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          {loading ? '実行中...' : 'クリーンアップ実行'}
        </button>
      </div>

      {cleanupResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <h4 className="font-semibold text-green-800">クリーンアップ結果</h4>
          <ul className="text-sm text-green-700">
            <li>実行前: {cleanupResult.beforeCount}件</li>
            <li>実行後: {cleanupResult.afterCount}件</li>
            <li>重複削除: {cleanupResult.duplicatesRemoved}件</li>
            <li>無効削除: {cleanupResult.invalidRemoved}件</li>
            <li>合計削除: {cleanupResult.totalRemoved}件</li>
          </ul>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          現在のSubscription数: <span className="font-semibold">{totalCount}件</span>
        </p>
      </div>

      {subscriptions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-2 py-1 text-xs">Endpoint</th>
                <th className="border border-gray-300 px-2 py-1 text-xs">User ID</th>
                <th className="border border-gray-300 px-2 py-1 text-xs">Type</th>
                <th className="border border-gray-300 px-2 py-1 text-xs">作成日</th>
                <th className="border border-gray-300 px-2 py-1 text-xs">最終確認</th>
                <th className="border border-gray-300 px-2 py-1 text-xs">失敗回数</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub, index) => (
                <tr key={index} className={sub.failureCount > 0 ? 'bg-red-50' : ''}>
                  <td className="border border-gray-300 px-2 py-1 text-xs font-mono">
                    {sub.endpoint}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs">
                    {sub.userId || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs">
                    {sub.userType || '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs">
                    {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs">
                    {sub.lastValidated ? new Date(sub.lastValidated).toLocaleDateString() : '-'}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-xs">
                    <span className={sub.failureCount > 0 ? 'text-red-600 font-semibold' : ''}>
                      {sub.failureCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}