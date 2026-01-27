'use client';

import { SessionMessage } from '../../types/agentapi';
import { useState } from 'react';

interface ToolUseContent {
  type: 'tool_use';
  name: string;
  id: string;
  input: Record<string, unknown>;
}

interface ToolResultContent {
  result?: string;
  error?: string;
}

function parseToolUseContent(content: string): ToolUseContent | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'tool_use' && parsed.name && parsed.id) {
      return parsed as ToolUseContent;
    }
  } catch {
    // Not a valid tool_use JSON
  }
  return null;
}

function parseToolResultContent(content: string): ToolResultContent | null {
  try {
    return JSON.parse(content) as ToolResultContent;
  } catch {
    // Not a valid JSON
  }
  return null;
}

// ツール名から概要を生成
function getToolDescription(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
      return `ファイル "${input.file_path}" を読み込んでいます`;
    case 'Write':
      return `ファイル "${input.file_path}" を作成しています`;
    case 'Edit':
      return `ファイル "${input.file_path}" を編集しています`;
    case 'Bash':
      return `コマンドを実行しています`;
    case 'Glob':
      return `パターン "${input.pattern}" でファイルを検索しています`;
    case 'Grep':
      return `"${input.pattern}" を検索しています`;
    case 'Task':
      return `サブエージェント "${input.description}" を実行しています`;
    case 'WebFetch':
      return `Webページを取得しています`;
    case 'WebSearch':
      return `"${input.query}" を検索しています`;
    default:
      return `${toolName} を実行しています`;
  }
}

interface ToolExecutionPaneProps {
  messages: SessionMessage[];
}

export default function ToolExecutionPane({ messages }: ToolExecutionPaneProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 実行中のツールを特定
  const runningTools: Array<{ toolUse: ToolUseContent; message: SessionMessage }> = [];
  const completedToolIds = new Set(
    messages
      .filter(m => m.role === 'tool_result' && m.parentToolUseId)
      .map(m => m.parentToolUseId)
  );

  messages.forEach(message => {
    if (message.role === 'agent' && message.toolUseId) {
      const toolUse = parseToolUseContent(message.content);
      if (toolUse && !completedToolIds.has(message.toolUseId)) {
        runningTools.push({ toolUse, message });
      }
    }
  });

  // 最新の完了したツール実行を取得（最大3件）
  const recentCompletedTools: Array<{
    toolUse: ToolUseContent | null;
    result: SessionMessage;
    toolUseMessage: SessionMessage | null;
  }> = [];

  messages
    .filter(m => m.role === 'tool_result')
    .reverse()
    .slice(0, 3)
    .forEach(result => {
      const toolUseMessage = messages.find(
        m => m.role === 'agent' && m.toolUseId === result.parentToolUseId
      ) || null;
      const toolUse = toolUseMessage ? parseToolUseContent(toolUseMessage.content) : null;
      recentCompletedTools.push({ toolUse, result, toolUseMessage });
    });

  // 何も表示するものがない場合は非表示
  if (runningTools.length === 0 && recentCompletedTools.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border-t border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            ツール実行状況
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {isExpanded ? '折りたたむ' : '詳細を表示'}
          </button>
        </div>

        {/* 実行中のツール */}
        {runningTools.length > 0 && (
          <div className="space-y-2 mb-3">
            {runningTools.map(({ toolUse, message }) => (
              <div
                key={message.toolUseId}
                className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3"
              >
                <div className="flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                        実行中
                      </span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {toolUse.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {getToolDescription(toolUse.name, toolUse.input)}
                    </p>
                    {isExpanded && (
                      <pre className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
                        {JSON.stringify(toolUse.input, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 最近完了したツール */}
        {recentCompletedTools.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              最近の実行
            </div>
            {recentCompletedTools.map(({ toolUse, result }) => {
              const isSuccess = result.status === 'success';
              const resultContent = parseToolResultContent(result.content);

              return (
                <div
                  key={result.id}
                  className={`border rounded p-2 ${
                    isSuccess
                      ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg
                      className={`w-3 h-3 flex-shrink-0 ${
                        isSuccess
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {isSuccess ? (
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      ) : (
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                      )}
                    </svg>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {toolUse?.name || 'Unknown'}
                    </span>
                    <span className={`text-xs ${
                      isSuccess
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isSuccess ? '成功' : '失敗'}
                    </span>
                  </div>
                  {isExpanded && resultContent && (
                    <div className="mt-2 text-xs bg-white dark:bg-gray-900 p-2 rounded overflow-x-auto">
                      {resultContent.error ? (
                        <div className="text-red-600 dark:text-red-400">
                          {resultContent.error}
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                          {typeof resultContent.result === 'string'
                            ? resultContent.result.slice(0, 200) + (resultContent.result.length > 200 ? '...' : '')
                            : JSON.stringify(resultContent.result, null, 2).slice(0, 200)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
