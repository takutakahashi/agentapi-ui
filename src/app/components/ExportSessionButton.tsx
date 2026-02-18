'use client';

import { useState, useCallback } from 'react';
import { AgentAPIProxyClient, AgentAPIProxyError } from '../../lib/agentapi-proxy-client';
import { Session } from '../../types/agentapi';
import {
  convertToMarkdown,
  convertToJSON,
  generateFilename,
  downloadFile,
  getMimeType,
  ExportFormat
} from '../../utils/exportUtils';

interface ExportSessionButtonProps {
  sessionId: string;
  agentAPI: AgentAPIProxyClient;
  session?: Session;
}

export default function ExportSessionButton({ sessionId, agentAPI, session }: ExportSessionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [error, setError] = useState<string | null>(null);

  // Export session data
  const handleExport = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get all session messages
      const messagesResponse = await agentAPI.getSessionMessages(sessionId);
      const messages = messagesResponse.messages || [];

      // Get session data if not provided
      let sessionData = session;
      if (!sessionData) {
        // Try to get session from messages or create a minimal session object
        sessionData = {
          session_id: sessionId,
          user_id: 'unknown',
          status: 'active' as const,
          started_at: new Date().toISOString(),
          description: `Session ${sessionId}`
        };
      }

      // Convert to selected format
      let content: string;

      switch (format) {
        case 'markdown':
          content = convertToMarkdown(sessionData, messages);
          break;
        case 'json':
          content = convertToJSON(sessionData, messages);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Generate filename and download
      const filename = generateFilename(sessionId, format);
      const mimeType = getMimeType(format);
      downloadFile(content, filename, mimeType);

      // Close modal on success
      setIsOpen(false);

    } catch (err) {
      console.error('Failed to export session:', err);
      if (err instanceof AgentAPIProxyError) {
        setError(`エクスポートに失敗しました: ${err.message}`);
      } else if (err instanceof Error) {
        setError(`エクスポートに失敗しました: ${err.message}`);
      } else {
        setError('エクスポートに失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, agentAPI, session, format]);

  return (
    <>
      {/* Export Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
        title="セッション履歴をエクスポート"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  セッション履歴をエクスポート
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  このセッションの会話履歴をファイルとしてダウンロードできます。
                </p>

                {/* Format Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                    エクスポート形式
                  </label>
                  <div className="space-y-2">
                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="markdown"
                          checked={format === 'markdown'}
                          onChange={(e) => setFormat(e.target.value as ExportFormat)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          Markdown (.md)
                        </span>
                      </label>
                      <p className="ml-6 text-xs text-gray-500 dark:text-gray-400">
                        読みやすい形式でエクスポートします
                      </p>
                    </div>
                    <div>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="json"
                          checked={format === 'json'}
                          onChange={(e) => setFormat(e.target.value as ExportFormat)}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          JSON (.json)
                        </span>
                      </label>
                      <p className="ml-6 text-xs text-gray-500 dark:text-gray-400">
                        構造化データとして保存します
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      セッション情報とすべての会話履歴が含まれます。個人情報が含まれる可能性があるため、取り扱いにご注意ください。
                    </p>
                  </div>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-md transition-colors disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      エクスポート中...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      ダウンロード
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}