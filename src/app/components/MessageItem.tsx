'use client';

import { SessionMessage } from '../../types/agentapi';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

// Markdown の特徴的な記法をチェックする関数
function hasMarkdownSyntax(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  // よくある Markdown の記法をチェック
  const markdownPatterns = [
    /^#{1,6}\s/m,                    // 見出し (# ## ### など)
    /\*\*[^*]+\*\*/,                // 太字 (**text**)
    /\*[^*]+\*/,                    // イタリック (*text*)
    /`[^`]+`/,                      // インラインコード (`code`)
    /```[\s\S]*?```/,               // コードブロック (```code```)
    /^\s*[-*+]\s/m,                 // リスト (- * +)
    /^\s*\d+\.\s/m,                 // 番号付きリスト (1. 2. など)
    /\[[^\]]+\]\([^)]+\)/,          // リンク [text](url)
    /!\[[^\]]*\]\([^)]+\)/,         // 画像 ![alt](url)
    /^\s*>\s/m,                     // 引用 (>)
    /^\s*---+\s*$/m,                // 水平線 (---)
    /\|.*\|/,                       // テーブル (| col |)
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

// Markdown をレンダリングするコンポーネント
function MarkdownContent({ content }: { content: string }): JSX.Element {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // リンクに適切なスタイルを追加
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            />
          ),
          // コードブロックのスタイリング
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          code: ({ node, className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // プリフォーマット済みテキストのスタイリング
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// テキストコンテンツをレンダリングする関数
function formatTextWithLinks(text: string): JSX.Element {
  if (!text || typeof text !== 'string') {
    return <>{text || ''}</>;
  }

  const urlRegex = /(https?:\/\/[^\s<>"'()[\]{}]+)/g;
  const parts = text.split(urlRegex);

  return (
    <>
      {parts.map((part, index) => {
        if (/^https?:\/\//.test(part)) {
          const cleanUrl = part.replace(/[.,;!?]+$/, '');
          return (
            <a
              key={index}
              href={cleanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline whitespace-nowrap"
            >
              {cleanUrl}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

// コンテンツをレンダリングする関数（Markdown か通常のテキストかを判断）
function renderContent(content: string): JSX.Element {
  if (hasMarkdownSyntax(content)) {
    return <MarkdownContent content={content} />;
  }
  return <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">{formatTextWithLinks(content)}</div>;
}

interface MessageItemProps {
  message: SessionMessage;
  formatTimestamp: (timestamp: string) => string;
  fontSettings: {
    fontSize: number;
    fontFamily: string;
  };
  onShowPlanModal?: () => void;
}

export default function MessageItem({
  message,
  formatTimestamp,
  fontSettings,
  onShowPlanModal
}: MessageItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ツール実行の場合
  if (message.role === 'agent' && message.toolUseId) {
    const toolUse = parseToolUseContent(message.content);

    if (toolUse) {
      return (
        <div className="relative">
          <div className="flex items-center px-4 sm:px-6 py-1.5 my-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
            {/* 左の細い縦線 */}
            <div className="w-0.5 h-5 bg-purple-300 dark:bg-purple-600 mr-3 opacity-40 group-hover:opacity-70"></div>

            {/* ツールアイコンとコンパクトな情報 */}
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <svg className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
              </svg>

              <span className="text-xs font-medium text-purple-600 dark:text-purple-400 truncate">
                {toolUse.name}
              </span>

              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {formatTimestamp(message.timestamp || message.time || '')}
              </span>

              {/* 展開ボタン */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 ml-auto flex-shrink-0 px-1"
                aria-label={isExpanded ? 'Hide details' : 'Show details'}
              >
                {isExpanded ? '▲' : '▼'}
              </button>
            </div>
          </div>

          {/* 展開された詳細 */}
          {isExpanded && (
            <div className="px-4 sm:px-6 pb-2">
              <div className="ml-6 bg-purple-50 dark:bg-purple-900/20 rounded-md p-3 border-l-2 border-purple-400">
                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">
                  Input Parameters:
                </div>
                <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded overflow-x-auto">
                  {JSON.stringify(toolUse.input, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  // ツール結果の場合
  if (message.role === 'tool_result') {
    const result = parseToolResultContent(message.content);
    const isSuccess = message.status === 'success';

    return (
      <div className="relative">
        <div className="flex items-center px-4 sm:px-6 py-1.5 my-0.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors group">
          {/* 左の細い縦線 */}
          <div className={`w-0.5 h-5 mr-3 opacity-40 group-hover:opacity-70 ${
            isSuccess
              ? 'bg-green-300 dark:bg-green-600'
              : 'bg-red-300 dark:bg-red-600'
          }`}></div>

          {/* ツール結果のアイコンとコンパクトな情報 */}
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <svg className={`w-3.5 h-3.5 flex-shrink-0 ${
              isSuccess
                ? 'text-green-500 dark:text-green-400'
                : 'text-red-500 dark:text-red-400'
            }`} fill="currentColor" viewBox="0 0 24 24">
              {isSuccess ? (
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              ) : (
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              )}
            </svg>

            <span className={`text-xs font-medium truncate ${
              isSuccess
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isSuccess ? '✓' : '✗'} Result
            </span>

            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {formatTimestamp(message.timestamp || message.time || '')}
            </span>

            {/* 展開ボタン */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-xs ml-auto flex-shrink-0 px-1 ${
                isSuccess
                  ? 'text-green-500 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300'
                  : 'text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
              }`}
              aria-label={isExpanded ? 'Hide result' : 'Show result'}
            >
              {isExpanded ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* 展開された詳細 */}
        {isExpanded && (
          <div className="px-4 sm:px-6 pb-2">
            <div className={`ml-6 rounded-md p-3 border-l-2 ${
              isSuccess
                ? 'bg-green-50 dark:bg-green-900/20 border-green-400'
                : 'bg-red-50 dark:bg-red-900/20 border-red-400'
            }`}>
              {result?.error ? (
                <div className="text-xs">
                  <div className="font-semibold text-red-700 dark:text-red-300 mb-2">Error:</div>
                  <div className="bg-white dark:bg-gray-800 p-2 rounded overflow-x-auto text-red-600 dark:text-red-400">
                    {result.error}
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  <div className={`font-semibold mb-2 ${
                    isSuccess
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    Result:
                  </div>
                  <pre className="bg-white dark:bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
                    {result?.result || message.content}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // プランモードメッセージの場合
  if (message.type === 'plan') {
    return (
      <div className="px-4 sm:px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500">
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 2v2H7v2H5v2H3v12h18V8h-2V6h-2V4h-2V2H9zm0 2h6v2h2v2h2v10H5V8h2V6h2V4zm2 4v2h2V8h-2zm-4 4v2h10v-2H7z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                📋 Plan Ready for Approval
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(message.timestamp || message.time || '')}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              A plan is ready for your review.
            </div>
            <button
              onClick={onShowPlanModal}
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium"
            >
              📋 View plan details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 質問メッセージの場合（将来の拡張用）
  if (message.type === 'question') {
    return (
      <div className="px-4 sm:px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
        <div className="flex items-start space-x-2">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                ❓ Question
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(message.timestamp || message.time || '')}
              </span>
            </div>
            <div className="text-gray-700 dark:text-gray-300">
              {renderContent(message.content)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 通常のメッセージ (ユーザー or アシスタント)
  const role = message.role === 'assistant' || message.role === 'agent' ? 'agent' : message.role;

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="flex items-start space-x-2 sm:space-x-3">
        <div className="flex-shrink-0">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
            role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-purple-500 text-white'
          }`}>
            {role === 'user' ? (
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {role === 'user' ? 'You' : 'AgentAPI'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimestamp(message.timestamp || message.time || '')}
            </span>
          </div>
          <div
            className={`text-gray-700 dark:text-gray-300 ${
              fontSettings.fontFamily === 'monospace' ? 'font-mono' : ''
            }`}
            style={{ fontSize: `${fontSettings.fontSize}px` }}
          >
            {renderContent(message.content)}
          </div>
        </div>
      </div>
    </div>
  );
}
