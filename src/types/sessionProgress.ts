// Session creation progress types

export type SessionCreationStatus =
  | 'creating'
  | 'waiting-agent'
  | 'sending-message'
  | 'completed'
  | 'failed';

export interface SessionCreationProgress {
  status: SessionCreationStatus;
  message: string;
  repository?: string;
  errorMessage?: string;
  startTime: Date;
  waitingProgress?: {
    current: number;  // 現在の待機秒数
    max: number;      // 最大待機秒数 (120)
  };
}

export interface ProgressStepConfig {
  status: SessionCreationStatus;
  label: string;
  activeLabel: string;
  completedLabel: string;
  percentage: number;
}

// ステップ設定の定数
export const SESSION_CREATION_STEPS: ProgressStepConfig[] = [
  {
    status: 'creating',
    label: 'セッション作成',
    activeLabel: 'セッション作成中...',
    completedLabel: '作成完了',
    percentage: 33,
  },
  {
    status: 'waiting-agent',
    label: 'エージェント起動',
    activeLabel: 'エージェント起動待機中...',
    completedLabel: '起動完了',
    percentage: 66,
  },
  {
    status: 'sending-message',
    label: 'メッセージ送信',
    activeLabel: 'メッセージ送信中...',
    completedLabel: '送信完了',
    percentage: 90,
  },
];

// ステータスに応じたパーセンテージを取得
export function getProgressPercentage(status: SessionCreationStatus): number {
  if (status === 'completed') return 100;
  if (status === 'failed') {
    // 失敗した場合は、その時点のパーセンテージを返す
    return 0;
  }
  const step = SESSION_CREATION_STEPS.find((s) => s.status === status);
  return step?.percentage ?? 0;
}

// ステータスに応じたステップインデックスを取得
export function getStepIndex(status: SessionCreationStatus): number {
  if (status === 'completed') return SESSION_CREATION_STEPS.length;
  if (status === 'failed') return -1;
  return SESSION_CREATION_STEPS.findIndex((s) => s.status === status);
}
