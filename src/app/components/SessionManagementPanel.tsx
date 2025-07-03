'use client';

import React, { useState } from 'react';
import { useSession } from '../../contexts/SessionContext';

export default function SessionManagementPanel() {
  const { 
    sessions, 
    currentSession, 
    selectSession, 
    deleteSession, 
    refreshSessions,
    sessionStats,
    isLoading,
    error 
  } = useSession();
  
  const [showPanel, setShowPanel] = useState(false);

  const handleSelectSession = async (sessionId: string) => {
    try {
      await selectSession(sessionId);
    } catch (error) {
      console.error('Failed to select session:', error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('このセッションを削除してもよろしいですか？')) {
      return;
    }
    
    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: 'active' | 'inactive' | 'error') => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg z-40 transition-colors"
        title="セッション管理パネル"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        {sessions.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {sessions.length}
          </span>
        )}
      </button>

      {/* Session management panel */}
      {showPanel && (
        <div className="fixed bottom-20 right-4 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-xl z-40 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">セッション管理</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Session stats */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="font-semibold text-gray-900 dark:text-white">{sessionStats.total}</div>
                <div className="text-gray-500 dark:text-gray-400">合計</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600 dark:text-green-400">{sessionStats.active}</div>
                <div className="text-gray-500 dark:text-gray-400">アクティブ</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-gray-600 dark:text-gray-400">{sessionStats.inactive}</div>
                <div className="text-gray-500 dark:text-gray-400">非アクティブ</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-600 dark:text-red-400">{sessionStats.error}</div>
                <div className="text-gray-500 dark:text-gray-400">エラー</div>
              </div>
            </div>
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
            </div>
          )}

          {/* Session list */}
          <div className="overflow-y-auto max-h-[400px]">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">読み込み中...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p>アクティブなセッションがありません</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      currentSession?.session_id === session.session_id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleSelectSession(session.session_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(session.status)}`}>
                            {session.status}
                          </span>
                          {currentSession?.session_id === session.session_id && (
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">現在のセッション</span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono truncate">
                          {session.session_id}
                        </p>
                        {session.metadata && 'description' in session.metadata && typeof session.metadata.description === 'string' && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {session.metadata.description}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          作成: {formatDate(session.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.session_id);
                        }}
                        className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex-shrink-0"
                        title="削除"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refresh button */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={refreshSessions}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors flex items-center justify-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              セッションを更新
            </button>
          </div>
        </div>
      )}
    </>
  );
}