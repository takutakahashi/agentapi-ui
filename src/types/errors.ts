/**
 * エラーの種類を定義する列挙型
 */
export enum ErrorType {
  // LocalStorage 関連のエラー
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_INVALID_DATA = 'STORAGE_INVALID_DATA',
  STORAGE_OPERATION_FAILED = 'STORAGE_OPERATION_FAILED',
  
  // プロファイル関連のエラー
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  PROFILE_INVALID_DATA = 'PROFILE_INVALID_DATA',
  PROFILE_VALIDATION_FAILED = 'PROFILE_VALIDATION_FAILED',
  PROFILE_CREATION_FAILED = 'PROFILE_CREATION_FAILED',
  PROFILE_UPDATE_FAILED = 'PROFILE_UPDATE_FAILED',
  PROFILE_DELETE_FAILED = 'PROFILE_DELETE_FAILED',
  PROFILE_MIGRATION_FAILED = 'PROFILE_MIGRATION_FAILED',
  
  // ネットワーク関連のエラー（将来の暗号化対応）
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNAUTHORIZED = 'NETWORK_UNAUTHORIZED',
  NETWORK_FORBIDDEN = 'NETWORK_FORBIDDEN',
  NETWORK_NOT_FOUND = 'NETWORK_NOT_FOUND',
  NETWORK_SERVER_ERROR = 'NETWORK_SERVER_ERROR',
  
  // 非同期処理エラー
  ASYNC_OPERATION_FAILED = 'ASYNC_OPERATION_FAILED',
  CONCURRENT_OPERATION_CONFLICT = 'CONCURRENT_OPERATION_CONFLICT',
  
  // 一般的なエラー
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * エラーの重要度レベル
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * エラーが回復可能かどうかを示す
 */
export enum ErrorRecoveryType {
  RECOVERABLE = 'recoverable',      // ユーザーの操作で回復可能
  RETRY = 'retry',                  // 再試行で回復可能
  NON_RECOVERABLE = 'non_recoverable' // 回復不可能
}

/**
 * 統一されたエラーの基底クラス
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly recoveryType: ErrorRecoveryType;
  public readonly userMessage: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly originalCause?: Error;

  constructor(
    type: ErrorType,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    recoveryType: ErrorRecoveryType = ErrorRecoveryType.NON_RECOVERABLE,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.severity = severity;
    this.recoveryType = recoveryType;
    this.userMessage = userMessage;
    this.context = context;
    this.timestamp = new Date();
    this.originalCause = cause;

    // スタックトレースを適切に設定
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * エラーの詳細情報を取得
   */
  getErrorDetails(): Record<string, unknown> {
    return {
      type: this.type,
      severity: this.severity,
      recoveryType: this.recoveryType,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
      originalCause: this.originalCause
    };
  }

  /**
   * ログ用のフォーマット済みメッセージを取得
   */
  getLogMessage(): string {
    const contextStr = this.context ? ` | Context: ${JSON.stringify(this.context)}` : '';
    return `[${this.severity.toUpperCase()}] ${this.type}: ${this.message}${contextStr}`;
  }
}

/**
 * ストレージ関連のエラー
 */
export class StorageError extends AppError {
  constructor(
    type: ErrorType,
    message: string,
    userMessage: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    const severity = type === ErrorType.STORAGE_QUOTA_EXCEEDED 
      ? ErrorSeverity.HIGH 
      : ErrorSeverity.MEDIUM;
    
    const recoveryType = type === ErrorType.STORAGE_ACCESS_DENIED
      ? ErrorRecoveryType.NON_RECOVERABLE
      : ErrorRecoveryType.RETRY;

    super(type, message, userMessage, severity, recoveryType, context, cause);
  }
}

/**
 * プロファイル関連のエラー
 */
export class ProfileError extends AppError {
  constructor(
    type: ErrorType,
    message: string,
    userMessage: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    const severity = type === ErrorType.PROFILE_NOT_FOUND 
      ? ErrorSeverity.LOW 
      : ErrorSeverity.MEDIUM;
    
    const recoveryType = type === ErrorType.PROFILE_VALIDATION_FAILED
      ? ErrorRecoveryType.RECOVERABLE
      : ErrorRecoveryType.RETRY;

    super(type, message, userMessage, severity, recoveryType, context, cause);
  }
}

/**
 * ネットワーク関連のエラー
 */
export class NetworkError extends AppError {
  constructor(
    type: ErrorType,
    message: string,
    userMessage: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    const severity = type === ErrorType.NETWORK_UNAUTHORIZED
      ? ErrorSeverity.HIGH
      : ErrorSeverity.MEDIUM;
    
    const recoveryType = type === ErrorType.NETWORK_TIMEOUT
      ? ErrorRecoveryType.RETRY
      : ErrorRecoveryType.RECOVERABLE;

    super(type, message, userMessage, severity, recoveryType, context, cause);
  }
}

/**
 * 既知のエラーからAppErrorに変換するヘルパー関数
 */
export function convertToAppError(error: unknown, context?: Record<string, unknown>): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // DOMException (localStorage related)
    if (error.name === 'QuotaExceededError') {
      return new StorageError(
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error.message,
        'ストレージの容量が不足しています。不要なデータを削除してください。',
        context,
        error
      );
    }

    if (error.name === 'SecurityError' || error.message.includes('localStorage')) {
      return new StorageError(
        ErrorType.STORAGE_ACCESS_DENIED,
        error.message,
        'ブラウザの設定によりデータの保存ができません。プライベートモードを無効にするか、設定を確認してください。',
        context,
        error
      );
    }

    // JSON parse errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return new StorageError(
        ErrorType.STORAGE_INVALID_DATA,
        error.message,
        '保存されたデータが破損しています。設定をリセットする必要があります。',
        context,
        error
      );
    }

    // Network errors (for future use)
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new NetworkError(
        ErrorType.NETWORK_CONNECTION_FAILED,
        error.message,
        'ネットワークに接続できません。インターネット接続を確認してください。',
        context,
        error
      );
    }

    // その他のError
    return new AppError(
      ErrorType.UNKNOWN_ERROR,
      error.message,
      '予期しないエラーが発生しました。',
      ErrorSeverity.MEDIUM,
      ErrorRecoveryType.RETRY,
      context,
      error
    );
  }

  // Error以外の場合
  return new AppError(
    ErrorType.UNKNOWN_ERROR,
    String(error),
    '予期しないエラーが発生しました。',
    ErrorSeverity.MEDIUM,
    ErrorRecoveryType.RETRY,
    context
  );
}

/**
 * ユーザーフレンドリーなエラーメッセージのマッピング
 */
export const ERROR_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.STORAGE_ACCESS_DENIED]: 'ブラウザの設定によりデータの保存ができません。プライベートモードを無効にするか、設定を確認してください。',
  [ErrorType.STORAGE_QUOTA_EXCEEDED]: 'ストレージの容量が不足しています。不要なデータを削除してください。',
  [ErrorType.STORAGE_INVALID_DATA]: '保存されたデータが破損しています。設定をリセットする必要があります。',
  [ErrorType.STORAGE_OPERATION_FAILED]: 'データの保存に失敗しました。再度お試しください。',
  
  [ErrorType.PROFILE_NOT_FOUND]: 'プロファイルが見つかりません。',
  [ErrorType.PROFILE_INVALID_DATA]: 'プロファイルのデータが無効です。',
  [ErrorType.PROFILE_VALIDATION_FAILED]: '入力内容に問題があります。必須項目を確認してください。',
  [ErrorType.PROFILE_CREATION_FAILED]: 'プロファイルの作成に失敗しました。',
  [ErrorType.PROFILE_UPDATE_FAILED]: 'プロファイルの更新に失敗しました。',
  [ErrorType.PROFILE_DELETE_FAILED]: 'プロファイルの削除に失敗しました。',
  [ErrorType.PROFILE_MIGRATION_FAILED]: 'プロファイルの移行に失敗しました。',
  
  [ErrorType.NETWORK_CONNECTION_FAILED]: 'ネットワークに接続できません。インターネット接続を確認してください。',
  [ErrorType.NETWORK_TIMEOUT]: '接続がタイムアウトしました。再度お試しください。',
  [ErrorType.NETWORK_UNAUTHORIZED]: '認証に失敗しました。ログイン情報を確認してください。',
  [ErrorType.NETWORK_FORBIDDEN]: 'アクセスが許可されていません。',
  [ErrorType.NETWORK_NOT_FOUND]: 'リソースが見つかりません。',
  [ErrorType.NETWORK_SERVER_ERROR]: 'サーバーエラーが発生しました。時間をおいて再度お試しください。',
  
  [ErrorType.ASYNC_OPERATION_FAILED]: '非同期処理に失敗しました。',
  [ErrorType.CONCURRENT_OPERATION_CONFLICT]: '同時実行による競合が発生しました。再度お試しください。',
  
  [ErrorType.VALIDATION_ERROR]: '入力内容に問題があります。',
  [ErrorType.UNKNOWN_ERROR]: '予期しないエラーが発生しました。'
};