'use client';

import { SessionMessage } from '../../types/agentapi';

interface ToolUseContent {
  type: 'tool_use';
  name: string;
  id: string;
  input: Record<string, unknown>;
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

  // 何も表示するものがない場合は非表示
  if (runningTools.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border-t border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="px-4 sm:px-6 py-2">
        {/* 実行中のツール */}
        <div className="flex items-center space-x-3">
          {runningTools.map(({ toolUse, message }) => (
            <div
              key={message.toolUseId}
              className="flex items-center space-x-2 text-xs"
            >
              <svg className="w-3 h-3 text-yellow-600 dark:text-yellow-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-gray-600 dark:text-gray-400">
                {getToolDescription(toolUse.name, toolUse.input)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
