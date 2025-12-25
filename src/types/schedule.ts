// Schedule status types
export type ScheduleStatus = 'active' | 'paused' | 'completed';

// Session configuration for scheduled execution
export interface ScheduleSessionConfig {
  environment?: Record<string, string>;
  tags?: Record<string, string>;
  params?: {
    message?: string;
    github_token?: string;
    [key: string]: unknown;
  };
}

// Schedule entity
export interface Schedule {
  id: string;
  name: string;
  status: ScheduleStatus;
  scheduled_at?: string;  // ISO8601 for one-time execution
  cron_expr?: string;     // Cron expression for recurring execution
  timezone?: string;      // IANA timezone (e.g., "Asia/Tokyo")
  session_config?: ScheduleSessionConfig;
  next_execution_at?: string;
  last_execution_at?: string;
  execution_count?: number;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

// Create schedule request
export interface CreateScheduleRequest {
  name: string;
  scheduled_at?: string;
  cron_expr?: string;
  timezone?: string;
  session_config?: ScheduleSessionConfig;
}

// Update schedule request
export interface UpdateScheduleRequest {
  name?: string;
  scheduled_at?: string;
  cron_expr?: string;
  timezone?: string;
  session_config?: ScheduleSessionConfig;
  status?: ScheduleStatus;
}

// Schedule list parameters
export interface ScheduleListParams {
  status?: ScheduleStatus;
  page?: number;
  limit?: number;
}

// Schedule list response
export interface ScheduleListResponse {
  schedules: Schedule[];
  total?: number;
  page?: number;
  limit?: number;
}

// Trigger schedule response
export interface TriggerScheduleResponse {
  session_id: string;
}

// Cron preset for UI
export interface CronPreset {
  label: string;
  value: string;
  description?: string;
}

// Common cron presets
export const CRON_PRESETS: CronPreset[] = [
  { label: '毎時', value: '0 * * * *', description: '毎時0分に実行' },
  { label: '毎日 9:00', value: '0 9 * * *', description: '毎日午前9時に実行' },
  { label: '毎日 18:00', value: '0 18 * * *', description: '毎日午後6時に実行' },
  { label: '毎週月曜 9:00', value: '0 9 * * 1', description: '毎週月曜日午前9時に実行' },
  { label: '毎週金曜 17:00', value: '0 17 * * 5', description: '毎週金曜日午後5時に実行' },
  { label: '毎月1日 9:00', value: '0 9 1 * *', description: '毎月1日午前9時に実行' },
];

// Common timezones
export const COMMON_TIMEZONES = [
  { label: '日本標準時 (JST)', value: 'Asia/Tokyo' },
  { label: '協定世界時 (UTC)', value: 'UTC' },
  { label: '米国東部時間 (EST/EDT)', value: 'America/New_York' },
  { label: '米国太平洋時間 (PST/PDT)', value: 'America/Los_Angeles' },
  { label: '中央ヨーロッパ時間 (CET/CEST)', value: 'Europe/Paris' },
  { label: 'シンガポール時間 (SGT)', value: 'Asia/Singapore' },
];
