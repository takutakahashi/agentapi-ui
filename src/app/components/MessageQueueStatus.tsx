'use client';

import { useState, useEffect } from 'react';
import { messageQueue, QueuedMessage, QueueStats, MessageStatus } from '@/lib/messageQueue';

interface MessageQueueStatusProps {
  className?: string;
}

const statusColors: Record<MessageStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sending: 'bg-blue-100 text-blue-800 border-blue-200',
  sent: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
};

const statusIcons: Record<MessageStatus, string> = {
  pending: '⏳',
  sending: '📤',
  sent: '✅',
  failed: '❌',
  cancelled: '🚫'
};

const statusLabels: Record<MessageStatus, string> = {
  pending: '待機中',
  sending: '送信中',
  sent: '送信完了',
  failed: '送信失敗',
  cancelled: 'キャンセル'
};

export default function MessageQueueStatus({ className = '' }: MessageQueueStatusProps) {
  const [messages, setMessages] = useState<QueuedMessage[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, sending: 0, sent: 0, failed: 0, total: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const updateMessages = () => setMessages(messageQueue.getAllMessages());
    const updateStats = (newStats: QueueStats) => setStats(newStats);

    updateMessages();
    setStats(messageQueue.getStats());

    const unsubscribeMessage = messageQueue.onMessageUpdate(updateMessages);
    const unsubscribeStats = messageQueue.onStatsUpdate(updateStats);

    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        updateMessages();
        setStats(messageQueue.getStats());
      }, 1000);
    }

    return () => {
      unsubscribeMessage();
      unsubscribeStats();
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleRetry = (messageId: string) => {
    messageQueue.retryMessage(messageId);
  };

  const handleRetryAll = () => {
    messageQueue.retryAllFailed();
  };

  const handleCancel = (messageId: string) => {
    messageQueue.cancelMessage(messageId);
  };

  const handleClearCompleted = () => {
    messageQueue.clearCompleted();
  };

  const handleClearAll = () => {
    if (confirm('すべてのメッセージキューをクリアしますか？')) {
      messageQueue.clearAll();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP');
  };

  const truncateContent = (content: string, maxLength = 50) => {
    return content.length > maxLength ? `${content.substring(0, maxLength)}...` : content;
  };

  if (stats.total === 0) {
    return null;
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* ヘッダー */}
      <div 
        className="p-4 border-b border-gray-200 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <h3 className="text-sm font-medium text-gray-900">メッセージキュー</h3>
          <div className="flex items-center space-x-2">
            {stats.sending > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                送信中 {stats.sending}
              </span>
            )}
            {stats.pending > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                待機中 {stats.pending}
              </span>
            )}
            {stats.failed > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                失敗 {stats.failed}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAutoRefresh(!autoRefresh);
            }}
            className={`p-1 rounded ${autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
            title={autoRefresh ? '自動更新ON' : '自動更新OFF'}
          >
            🔄
          </button>
          <span className="text-gray-400">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* 展開コンテンツ */}
      {isExpanded && (
        <div className="p-4">
          {/* アクションボタン */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex space-x-2">
              {stats.failed > 0 && (
                <button
                  onClick={handleRetryAll}
                  className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded hover:bg-red-200"
                >
                  すべて再試行
                </button>
              )}
              {stats.sent > 0 && (
                <button
                  onClick={handleClearCompleted}
                  className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded hover:bg-green-200"
                >
                  完了済みをクリア
                </button>
              )}
            </div>
            
            <button
              onClick={handleClearAll}
              className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded hover:bg-gray-200"
            >
              すべてクリア
            </button>
          </div>

          {/* 統計情報 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="text-center p-2 bg-gray-50 rounded">
              <div className="text-lg font-semibold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">合計</div>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded">
              <div className="text-lg font-semibold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-600">待機中</div>
            </div>
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="text-lg font-semibold text-blue-700">{stats.sending}</div>
              <div className="text-xs text-blue-600">送信中</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="text-lg font-semibold text-green-700">{stats.sent}</div>
              <div className="text-xs text-green-600">送信完了</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded">
              <div className="text-lg font-semibold text-red-700">{stats.failed}</div>
              <div className="text-xs text-red-600">送信失敗</div>
            </div>
          </div>

          {/* メッセージリスト */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                メッセージがありません
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 border rounded-lg ${statusColors[message.status]}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium">
                          {statusIcons[message.status]} {statusLabels[message.status]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(message.timestamp)}
                        </span>
                        {message.retryCount > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">
                            再試行 {message.retryCount}/{message.maxRetries}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 mb-1">
                        {truncateContent(message.content)}
                      </div>
                      {message.error && (
                        <div className="text-xs text-red-600 bg-red-50 p-1 rounded mt-1">
                          エラー: {message.error}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-1 ml-2">
                      {message.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(message.id)}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                          title="再試行"
                        >
                          🔄
                        </button>
                      )}
                      {(message.status === 'pending' || message.status === 'sending') && (
                        <button
                          onClick={() => handleCancel(message.id)}
                          className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100"
                          title="キャンセル"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}