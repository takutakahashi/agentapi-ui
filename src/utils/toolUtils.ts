/**
 * Utility functions for tool name display
 *
 * Handles both Claude Code tool names (Bash, Read, Write, etc.) and
 * ACP (Agent Communication Protocol) ToolKind values
 * (execute, other, read, edit, bash, search, fetch, think, etc.)
 */

/**
 * Maps a tool name (which may be an ACP ToolKind) to a user-friendly display name.
 * ACP ToolKinds are lowercase category labels; this function normalizes them into
 * readable names and tries to extract more specific info from input fields when
 * the kind is generic ("execute" or "other").
 */
export function getToolDisplayName(
  name: string,
  input: Record<string, unknown> | null | undefined
): string {
  const inp = input ?? {};

  // Handle generic ACP "other" kind: try to find a meaningful name in input fields
  if (name === 'other') {
    if (inp.tool_name && typeof inp.tool_name === 'string') return inp.tool_name;
    if (inp.name && typeof inp.name === 'string') return inp.name;
    if (inp.title && typeof inp.title === 'string') return inp.title;
    return 'Other';
  }

  // Handle ACP "execute" kind: try to be more specific from command
  if (name === 'execute') {
    if (inp.command && typeof inp.command === 'string') {
      const firstWord = inp.command.trim().split(/\s+/)[0];
      if (firstWord) {
        // Capitalize first letter of the command for display
        return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
      }
    }
    return 'Execute';
  }

  // Known ACP ToolKind → display name mappings
  const acpKindMap: Record<string, string> = {
    'read': 'Read',
    'edit': 'Edit',
    'write': 'Write',
    'delete': 'Delete',
    'move': 'Move',
    'search': 'Search',
    'think': 'Think',
    'fetch': 'Fetch',
    'switch_mode': 'SwitchMode',
    'bash': 'Bash',
    'str_replace': 'Edit',
    'create': 'Write',
    'list': 'List',
    'run': 'Execute',
  };

  if (name in acpKindMap) {
    return acpKindMap[name];
  }

  // Default: capitalize the first letter (handles unknown names gracefully)
  if (name.length === 0) return '(tool)';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Returns a brief info string for a tool call based on the tool name and input.
 * This is displayed as secondary text next to the tool name.
 */
export function getToolBriefInfo(
  name: string,
  input: Record<string, unknown> | null | undefined
): string | null {
  if (!input) return null;
  const maxLength = 40;

  const truncate = (s: string, max: number = maxLength) =>
    s.length > max ? s.substring(0, max) + '...' : s;

  // description があれば優先
  if (input.description && typeof input.description === 'string') {
    return truncate(input.description);
  }

  // title (ACP specific)
  if (input.title && typeof input.title === 'string') {
    return truncate(input.title);
  }

  // ファイル系のツール
  if (input.file_path && typeof input.file_path === 'string') {
    const path = input.file_path;
    return path.length > maxLength ? '...' + path.substring(path.length - maxLength) : path;
  }

  // ACP edit/str_replace tools use "path" instead of "file_path"
  if (input.path && typeof input.path === 'string') {
    const path = input.path;
    return path.length > maxLength ? '...' + path.substring(path.length - maxLength) : path;
  }

  // パターン検索系
  if (input.pattern && typeof input.pattern === 'string') {
    return truncate(input.pattern);
  }

  // 検索クエリ
  if (input.query && typeof input.query === 'string') {
    return truncate(input.query);
  }

  // コマンド系
  if (input.command && typeof input.command === 'string') {
    return truncate(input.command);
  }

  // URL
  if (input.url && typeof input.url === 'string') {
    return truncate(input.url);
  }

  return null;
}

/**
 * Returns a longer description of a tool call for display in the ToolExecutionPane.
 */
export function getToolDescription(
  name: string,
  input: Record<string, unknown> | null | undefined
): string {
  const inp = input ?? {};
  const displayName = getToolDisplayName(name, inp);
  const description = inp.description as string | undefined;
  const title = inp.title as string | undefined;

  // Prefer description or title if available
  if (description) return description;
  if (title) return title;

  // Tool-specific descriptions
  const lowerName = name.toLowerCase();
  switch (lowerName) {
    case 'task':
    case 'agent': {
      const subagentType = inp.subagent_type as string | undefined;
      if (subagentType) return `${subagentType}を実行中`;
      return 'サブエージェントを実行中';
    }
    case 'read':
      return `ファイル "${inp.file_path ?? inp.path ?? ''}" を読み込み中`;
    case 'write':
    case 'create':
      return `ファイル "${inp.file_path ?? inp.path ?? ''}" を作成中`;
    case 'edit':
    case 'str_replace':
      return `ファイル "${inp.file_path ?? inp.path ?? ''}" を編集中`;
    case 'bash':
    case 'execute':
    case 'run': {
      const cmd = inp.command as string | undefined;
      if (cmd) return truncateStr(cmd, 60);
      return 'コマンドを実行中';
    }
    case 'glob':
    case 'search':
    case 'list':
      return `"${inp.pattern ?? inp.query ?? ''}" を検索中`;
    case 'grep':
      return `"${inp.pattern ?? ''}" を検索中`;
    case 'webfetch':
    case 'fetch':
      return `"${inp.url ?? ''}" を取得中`;
    case 'websearch':
      return `"${inp.query ?? ''}" を検索中`;
    case 'think':
      return '思考中...';
    case 'other':
      if (inp.tool_name) return `${inp.tool_name} を実行中`;
      return 'ツールを実行中';
    default:
      return `${displayName}を実行中`;
  }
}

function truncateStr(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + '...' : s;
}
