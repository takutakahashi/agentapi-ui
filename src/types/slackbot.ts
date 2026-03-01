import { ResourceScope } from './agentapi';

// SlackBot status types
export type SlackBotStatus = 'active' | 'paused';

// Session parameters for SlackBot sessions
export interface SlackBotSessionParams {
  agent_type?: string;
  oneshot?: boolean;
}

// Session configuration for SlackBot
export interface SlackBotSessionConfig {
  initial_message_template?: string;
  reuse_message_template?: string;
  tags?: Record<string, string>;
  environment?: Record<string, string>;
  params?: SlackBotSessionParams;
}

// SlackBot entity
export interface SlackBot {
  id: string;
  name: string;
  user_id?: string;
  scope?: ResourceScope;
  team_id?: string;
  status: SlackBotStatus;
  bot_token_secret_name?: string;
  bot_token_secret_key?: string;
  allowed_event_types?: string[];
  allowed_channel_names?: string[];
  session_config?: SlackBotSessionConfig;
  max_sessions?: number;
  /** セッション作成時に Slack へ通知メッセージを投稿するかどうか。デフォルト true */
  notify_on_session_created?: boolean;
  created_at: string;
  updated_at: string;
}

// Create SlackBot request
export interface CreateSlackBotRequest {
  name: string;
  scope?: ResourceScope;
  team_id?: string;
  bot_token_secret_name?: string;
  bot_token_secret_key?: string;
  allowed_event_types?: string[];
  allowed_channel_names?: string[];
  session_config?: SlackBotSessionConfig;
  max_sessions?: number;
  /** セッション作成時に Slack へ通知メッセージを投稿するかどうか。デフォルト true */
  notify_on_session_created?: boolean;
}

// Update SlackBot request
export interface UpdateSlackBotRequest {
  name?: string;
  status?: SlackBotStatus;
  bot_token_secret_name?: string;
  bot_token_secret_key?: string;
  allowed_event_types?: string[];
  allowed_channel_names?: string[];
  session_config?: SlackBotSessionConfig;
  max_sessions?: number;
  /** セッション作成時に Slack へ通知メッセージを投稿するかどうか。デフォルト true */
  notify_on_session_created?: boolean;
}

// SlackBot list parameters
export interface SlackBotListParams {
  status?: SlackBotStatus;
  scope?: ResourceScope;
  team_id?: string;
  page?: number;
  limit?: number;
}

// SlackBot list response
export interface SlackBotListResponse {
  slackbots: SlackBot[];
  total?: number;
  page?: number;
  limit?: number;
}

// Common Slack event types for UI
export const SLACK_EVENT_TYPES = [
  { label: 'メッセージ (message)', value: 'message', description: 'チャンネルにメッセージが投稿された時' },
  { label: 'アプリメンション (app_mention)', value: 'app_mention', description: 'ボットがメンションされた時' },
  { label: 'ダイレクトメッセージ (message.im)', value: 'message.im', description: 'DMが送られた時' },
  { label: 'チャンネルメッセージ (message.channels)', value: 'message.channels', description: 'パブリックチャンネルにメッセージが届いた時' },
  { label: 'グループメッセージ (message.groups)', value: 'message.groups', description: 'プライベートチャンネルにメッセージが届いた時' },
  { label: 'リアクション追加 (reaction_added)', value: 'reaction_added', description: 'メッセージにリアクションが追加された時' },
  { label: 'メンバー参加 (member_joined_channel)', value: 'member_joined_channel', description: 'メンバーがチャンネルに参加した時' },
];
