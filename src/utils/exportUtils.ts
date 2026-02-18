import { Session, SessionMessage } from '../types/agentapi';

export type ExportFormat = 'markdown' | 'json';

/**
 * Convert session data to Markdown format
 */
export function convertToMarkdown(session: Session, messages: SessionMessage[]): string {
  const title = session.description || `Session ${session.session_id}`;
  const content: string[] = [];

  // Header section
  content.push(`# Session Export - ${title}`);
  content.push('');
  content.push(`**Session ID**: ${session.session_id}`);
  content.push(`**User**: ${session.user_id}`);
  content.push(`**Started**: ${session.started_at}`);
  content.push(`**Status**: ${session.status}`);

  if (session.team_id) {
    content.push(`**Team**: ${session.team_id}`);
  }

  if (session.scope) {
    content.push(`**Scope**: ${session.scope}`);
  }

  content.push('');
  content.push('---');
  content.push('');

  // Messages section
  content.push('## Messages');
  content.push('');

  // Sort messages by timestamp/id
  const sortedMessages = [...messages].sort((a, b) => {
    // Use timestamp if available, otherwise use ID
    if (a.time && b.time) {
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    }
    return a.id - b.id;
  });

  for (const message of sortedMessages) {
    const timestamp = message.time ? new Date(message.time).toLocaleString('ja-JP') : `Message ${message.id}`;
    const roleLabel = getRoleLabel(message.role);

    content.push(`### [${timestamp}] ${roleLabel}`);
    content.push('');
    content.push(message.content);
    content.push('');
  }

  return content.join('\n');
}

/**
 * Convert session data to JSON format
 */
export function convertToJSON(session: Session, messages: SessionMessage[]): string {
  const exportData = {
    session,
    messages: messages.sort((a, b) => {
      if (a.time && b.time) {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
      }
      return a.id - b.id;
    }),
    exported_at: new Date().toISOString(),
    format_version: '1.0'
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Generate filename for export
 */
export function generateFilename(sessionId: string, format: ExportFormat): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const extension = format === 'markdown' ? 'md' : 'json';
  return `session-${sessionId}-${timestamp}.${extension}`;
}

/**
 * Download file content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get human-readable role label
 */
function getRoleLabel(role: string): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
    case 'agent':
      return 'AgentAPI';
    case 'system':
      return 'System';
    case 'tool_result':
      return 'Tool Result';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

/**
 * Get MIME type for export format
 */
export function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'markdown':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    default:
      return 'text/plain';
  }
}