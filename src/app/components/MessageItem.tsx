'use client';

import { SessionMessage } from '../../types/agentapi';
import React, { useState, memo } from 'react';
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
          // 見出しのスタイリング - 既存UIのパターンに合わせる
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h1: ({ node, ...props }) => (
            <h1
              className="text-2xl font-bold text-gray-900 dark:text-white mt-6 mb-4 pb-2 border-b-2 border-gray-200 dark:border-gray-700"
              {...props}
            />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h2: ({ node, ...props }) => (
            <h2
              className="text-xl font-bold text-gray-900 dark:text-white mt-5 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700"
              {...props}
            />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h3: ({ node, ...props }) => (
            <h3
              className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2"
              {...props}
            />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h4: ({ node, ...props }) => (
            <h4
              className="text-base font-semibold text-gray-800 dark:text-gray-100 mt-3 mb-2"
              {...props}
            />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h5: ({ node, ...props }) => (
            <h5
              className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-3 mb-2"
              {...props}
            />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          h6: ({ node, ...props }) => (
            <h6
              className="text-sm font-medium text-gray-600 dark:text-gray-300 mt-2 mb-1"
              {...props}
            />
          ),
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
          // 水平線のスタイリング - より目立つように
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          hr: ({ node, ...props }) => (
            <hr className="my-8 border-t-2 border-gray-200 dark:border-gray-700" {...props} />
          ),
          // テーブルのスタイリング - 既存UIのカードスタイルに合わせる
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 -mx-2 px-2">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg" {...props} />
            </div>
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          thead: ({ node, ...props }) => (
            <thead className="bg-gray-50 dark:bg-gray-800" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          th: ({ node, ...props }) => (
            <th className="px-3 py-2 text-left text-xs sm:text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800 whitespace-nowrap" {...props} />
          ),
          // リストのスタイリング
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside my-3 space-y-1.5 text-gray-700 dark:text-gray-300" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside my-3 space-y-1.5 text-gray-700 dark:text-gray-300" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          li: ({ node, ...props }) => (
            <li className="text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />
          ),
          // 引用のスタイリング - 既存の通知カードスタイルに合わせる
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-gray-200 dark:border-gray-700 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-r" {...props} />
          ),
          // 段落のスタイリング
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          p: ({ node, ...props }) => (
            <p className="my-3 text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />
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

// コンテンツをレンダリングする関数（enableMarkdown が true のときのみ Markdown 変換を行う）
function renderContent(content: string, enableMarkdown: boolean = false): JSX.Element {
  if (!enableMarkdown || !hasMarkdownSyntax(content)) {
    return <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere max-w-full">{formatTextWithLinks(content)}</div>;
  }
  return <MarkdownContent content={content} />;
}

interface MessageItemProps {
  message: SessionMessage;
  toolResult?: SessionMessage; // 対応するツール結果（オプショナル）
  formatTimestamp: (timestamp: string) => string;
  fontSettings: {
    fontSize: number;
    fontFamily: string;
  };
  onShowPlanModal?: () => void;
  isClaudeAgent?: boolean;
}

function MessageItem({
  message,
  toolResult,
  formatTimestamp,
  fontSettings,
  onShowPlanModal,
  isClaudeAgent,
}: MessageItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ツール実行の場合（ツール結果も含めて表示）
  if (message.role === 'agent' && message.toolUseId) {
    const toolUse = parseToolUseContent(message.content);
    const result = toolResult ? parseToolResultContent(toolResult.content) : null;
    const isSuccess = toolResult?.status === 'success';
    const hasResult = !!toolResult;

    if (toolUse) {
      // ツールの簡易情報を抽出（description, file_path, pattern など）
      const getBriefInfo = (): string | null => {
        const input = toolUse.input;
        const maxLength = 40;

        // description があれば優先
        if (input.description && typeof input.description === 'string') {
          return input.description.length > maxLength
            ? input.description.substring(0, maxLength) + '...'
            : input.description;
        }

        // ファイル系のツール
        if (input.file_path && typeof input.file_path === 'string') {
          const path = input.file_path;
          return path.length > maxLength
            ? '...' + path.substring(path.length - maxLength)
            : path;
        }

        // パターン検索系
        if (input.pattern && typeof input.pattern === 'string') {
          return input.pattern.length > maxLength
            ? input.pattern.substring(0, maxLength) + '...'
            : input.pattern;
        }

        // コマンド系
        if (input.command && typeof input.command === 'string') {
          return input.command.length > maxLength
            ? input.command.substring(0, maxLength) + '...'
            : input.command;
        }

        return null;
      };

      const briefInfo = getBriefInfo();

      return (
        <div className="px-4 sm:px-6 py-0.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center py-1 hover:opacity-80 transition-opacity group text-left"
          >
            {/* 細い縦線 */}
            <div className={`w-px h-4 mr-2 flex-shrink-0 ${
              hasResult
                ? isSuccess
                  ? 'bg-green-400 dark:bg-green-500'
                  : 'bg-red-400 dark:bg-red-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}></div>

            {/* ツール名 */}
            <span className={`text-xs flex-shrink-0 ${
              hasResult
                ? isSuccess
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {toolUse.name}
            </span>

            {/* 結果インジケーター */}
            {hasResult && (
              <span className={`ml-1 text-xs flex-shrink-0 ${
                isSuccess
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isSuccess ? '✓' : '✗'}
              </span>
            )}

            {/* 簡易情報 */}
            {briefInfo && (
              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 truncate">
                {briefInfo}
              </span>
            )}

            {/* タイムスタンプ */}
            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              {formatTimestamp(message.timestamp || message.time || '')}
            </span>

            {/* 展開アイコン */}
            <span className="ml-2 text-xs text-gray-400 flex-shrink-0">
              {isExpanded ? '−' : '+'}
            </span>
          </button>

          {/* 展開された詳細 */}
          {isExpanded && (
            <div className="ml-3 mt-1 mb-2 text-xs">
              {/* ツール入力 */}
              <div className="mb-2">
                <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Input:</div>
                <pre className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-gray-600 dark:text-gray-400 overflow-x-auto">
                  {JSON.stringify(toolUse.input, null, 2)}
                </pre>
              </div>

              {/* ツール結果 */}
              {hasResult && (
                <div>
                  <div className={`font-semibold mb-1 ${
                    isSuccess
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {isSuccess ? 'Result:' : 'Error:'}
                  </div>
                  <pre className={`p-2 rounded overflow-x-auto ${
                    isSuccess
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  }`}>
                    {result?.error || result?.result || toolResult.content}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
  }

  // スタンドアロンの tool_result（parentToolUseId なし、codex-agentapi など）
  if (message.role === 'tool_result') {
    const isSuccess = message.status === 'success';
    const contentPreview =
      message.content.length > 60
        ? message.content.substring(0, 60) + '...'
        : message.content;

    return (
      <div className="px-4 sm:px-6 py-0.5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center py-1 hover:opacity-80 transition-opacity group text-left"
        >
          {/* 細い縦線 */}
          <div className={`w-px h-4 mr-2 flex-shrink-0 ${
            isSuccess
              ? 'bg-green-400 dark:bg-green-500'
              : 'bg-red-400 dark:bg-red-500'
          }`}></div>

          {/* ステータスアイコン */}
          <span className={`text-xs flex-shrink-0 ${
            isSuccess
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isSuccess ? '✓' : '✗'}
          </span>

          {/* 内容プレビュー */}
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 truncate">
            {contentPreview}
          </span>

          {/* タイムスタンプ */}
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {formatTimestamp(message.timestamp || message.time || '')}
          </span>

          {/* 展開アイコン */}
          <span className="ml-2 text-xs text-gray-400 flex-shrink-0">
            {isExpanded ? '−' : '+'}
          </span>
        </button>

        {/* 展開された詳細 */}
        {isExpanded && (
          <div className="ml-3 mt-1 mb-2 text-xs">
            <pre className={`p-2 rounded overflow-x-auto whitespace-pre-wrap break-words ${
              isSuccess
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}>
              {message.content}
            </pre>
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
              {renderContent(message.content, isClaudeAgent)}
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
            {renderContent(message.content, isClaudeAgent)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom comparison function for React.memo
function areEqual(prevProps: MessageItemProps, nextProps: MessageItemProps): boolean {
  // Compare message object - only the fields that affect rendering
  const messageEqual =
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.type === nextProps.message.type &&
    prevProps.message.toolUseId === nextProps.message.toolUseId &&
    prevProps.message.parentToolUseId === nextProps.message.parentToolUseId &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.message.time === nextProps.message.time &&
    prevProps.message.status === nextProps.message.status;

  // Compare toolResult if present
  const toolResultEqual =
    prevProps.toolResult?.id === nextProps.toolResult?.id &&
    prevProps.toolResult?.content === nextProps.toolResult?.content &&
    prevProps.toolResult?.status === nextProps.toolResult?.status;

  // Compare fontSettings
  const fontSettingsEqual =
    prevProps.fontSettings.fontSize === nextProps.fontSettings.fontSize &&
    prevProps.fontSettings.fontFamily === nextProps.fontSettings.fontFamily;

  // Compare other props
  const otherPropsEqual =
    prevProps.isClaudeAgent === nextProps.isClaudeAgent;

  // formatTimestamp and onShowPlanModal are functions - we assume they're stable
  // (they should be wrapped with useCallback in the parent component)

  return messageEqual && toolResultEqual && fontSettingsEqual && otherPropsEqual;
}

// Export memoized component
export default memo(MessageItem, areEqual);
